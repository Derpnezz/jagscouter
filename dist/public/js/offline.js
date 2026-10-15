window.FRC = window.FRC || {};
FRC.offline = (() => {
  // State belongs to the website, not the home-page element (which unmounts).
  let ready = false, update = false, note = '', failed = false, busy = false;
  let operation = null, registration = null;
  const supported = () => 'serviceWorker' in navigator && window.isSecureContext;
  function timeout(promise, milliseconds, text) {
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error(text)),milliseconds);
      promise.then(value => {clearTimeout(timer); resolve(value);},error => {clearTimeout(timer); reject(error);});
    });
  }
  function message(type) {
    return new Promise((resolve,reject) => {
      const worker = navigator.serviceWorker?.controller;
      if (!worker) return reject(new Error('Offline storage is not controlling this page yet. Reopen online to prepare.'));
      const channel = new MessageChannel();
      const close = () => {clearTimeout(timer); channel.port1.close(); channel.port2.close();};
      const timer = setTimeout(() => {close(); reject(new Error('Offline preparation timed out. Try again while online.'));},30000);
      channel.port1.onmessage = event => {
        close();
        event.data.error ? reject(new Error(event.data.error)) : resolve(event.data);
      };
      try { worker.postMessage({type},[channel.port2]); }
      catch(error) {close(); reject(error);}
    });
  }
  function render() {
    const panel = document.getElementById('offline-status');
    if (!panel) return;
    const text = note || (ready
      ? navigator.onLine ? 'Ready for offline use' : 'Offline · ready to scout'
      : 'Not yet ready offline. Open online to prepare.');
    panel.innerHTML = `<p class="offline-message${failed ? ' error' : ''}" role="status" aria-live="polite">${FRC.ui.escape(text)}</p>
      <p class="hint">Internet is required to refresh. Saved matches and drafts are kept.</p>
      <div class="offline-actions" aria-busy="${busy}">
        <button type="button" class="btn btn-secondary" id="refresh-website"${busy ? ' disabled' : ''}>Refresh downloaded website</button>
        ${update ? `<button type="button" class="btn btn-primary" id="apply-update"${busy ? ' disabled' : ''}>Apply update &amp; reload</button>` : ''}
      </div>`;
    panel.querySelector('#refresh-website').addEventListener('click',refresh);
    panel.querySelector('#apply-update')?.addEventListener('click',apply);
  }
  function showFailure(error) {
    failed = true;
    note = `${ready ? 'Cached website remains available. ' : ''}${error.message || String(error)}`;
  }
  async function status(type) {
    const result = await message(type);
    // Reject an invalid candidate before exposing any apply button.
    if (result.definition) {
      try { FRC.config.validate(result.definition); }
      catch(error) { update = false; throw error; }
    }
    ready = result.ready;
    update = result.update;
    failed = false;
    note = update ? 'Update ready to apply. Your saved matches and drafts will be kept.' : '';
  }
  async function connect() {
    if (!supported()) throw new Error('Offline downloads require HTTPS and service worker support in this browser.');
    registration = await navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'});
    await timeout(navigator.serviceWorker.ready,15000,'Offline preparation failed. Reconnect and refresh.');
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve,reject) => {
        const changed = () => {clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange',changed); resolve();};
        const timer = setTimeout(() => {
          navigator.serviceWorker.removeEventListener('controllerchange',changed);
          reject(new Error('Reopen online to finish preparing offline access.'));
        },5000);
        navigator.serviceWorker.addEventListener('controllerchange',changed);
        if (navigator.serviceWorker.controller) changed();
      });
    }
  }
  async function refreshWorker() {
    registration = registration || await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error('Offline storage is not registered yet. Reopen online to prepare.');
    // Also check the worker itself, not only the files cached by its old version.
    await registration.update();
    const worker = registration.installing || registration.waiting;
    if (!worker || worker.state === 'activated') return;
    await new Promise((resolve,reject) => {
      const finish = error => {
        clearTimeout(timer);
        worker.removeEventListener('statechange',changed);
        error ? reject(error) : resolve();
      };
      const changed = () => {
        if (worker.state === 'activated') finish();
        else if (worker.state === 'redundant') finish(new Error('The updated website worker could not be installed. Try refreshing again.'));
      };
      const timer = setTimeout(() => finish(new Error('Website worker update timed out. Try refreshing again.')),30000);
      worker.addEventListener('statechange',changed);
      changed();
    });
  }
  function run(kind) {
    if (operation) return operation;
    busy = true;
    failed = false;
    note = kind === 'init' ? 'Preparing offline access…' : 'Checking and downloading the latest website…';
    render();
    operation = Promise.resolve().then(async () => {
      if (!supported()) throw new Error('Offline downloads require HTTPS and service worker support in this browser.');
      if (kind === 'refresh' && !navigator.onLine) throw new Error('Connect to the internet to refresh the downloaded website.');
      if (kind === 'init' || !navigator.serviceWorker.controller) await connect();
      if (kind !== 'init' && navigator.onLine) {
        await refreshWorker();
        await status('CHECK');
        if (!update) note = ready ? 'Already up to date · ready for offline use' : 'Downloaded website is not yet ready offline. Reopen online and try again.';
      } else await status('STATUS');
      if (kind === 'init') navigator.storage?.persist?.().catch(() => {});
      return true;
    }).catch(error => {showFailure(error); return false;}).finally(() => {
      busy = false;
      operation = null;
      render();
    });
    return operation;
  }
  function init() {return run('init');}
  function check() {return run('check');}
  function refresh() {return run('refresh');}
  function apply() {
    if (operation || !update) return operation || Promise.resolve(false);
    if (!window.confirm('Apply the downloaded website update and reload? Your saved matches and drafts will be preserved. A changed form will keep the old draft separately.')) return Promise.resolve(false);
    busy = true;
    failed = false;
    note = 'Applying downloaded update…';
    render();
    operation = Promise.resolve().then(async () => {
      await message('APPLY');
      location.reload();
      return true;
    }).catch(error => {showFailure(error); return false;}).finally(() => {
      busy = false;
      operation = null;
      render();
    });
    return operation;
  }
  window.addEventListener('online',check);
  window.addEventListener('offline',() => {
    if (!busy && !failed) note = update ? 'Downloaded update ready. You can apply it without internet.' : '';
    render();
  });
  return {init,check,refresh,apply,render};
})();