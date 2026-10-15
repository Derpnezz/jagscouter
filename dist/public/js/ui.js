window.FRC = window.FRC || {};
FRC.ui = {
  escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  download(content, filename, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const a = Object.assign(document.createElement('a'), {href: url, download: filename});
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  header(title, detail = '') {
    const hash = window.location?.hash || '#/';
    return `<header class="app-header"><div class="header-inner">
      <a href="#/" class="site-brand" aria-label="JagScouter by JagBots4638 — Home">
        <img class="brand-mark" src="icon.svg" width="28" height="28" alt="">
        <span class="brand-copy"><strong>JagScouter</strong><small>JagBots4638</small></span>
      </a>
      <nav class="header-nav" aria-label="Main navigation">
        <a href="#/scouter"${hash === '#/scouter' ? ' aria-current="page"' : ''}>Scout</a>
        <a href="#/manager"${hash === '#/manager' ? ' aria-current="page"' : ''}>Data</a>
      </nav>
    </div></header>${title === 'Home' ? '' : `<div class="page-heading"><h1>${FRC.ui.escape(title)}</h1>${detail ? `<span class="badge">${FRC.ui.escape(detail)}</span>` : ''}</div>`}`;
  },
  report(error) { FRC.app.toast('Could not complete action', error.message || String(error), 'error'); },
  confirm(title, message, action) {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.innerHTML = `<h2>${FRC.ui.escape(title)}</h2><p>${FRC.ui.escape(message)}</p><div class="dialog-actions"><button class="btn btn-secondary" data-cancel>Cancel</button><button class="btn btn-danger" data-confirm>Delete</button></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
    dialog.querySelector('[data-confirm]').onclick = () => { dialog.close(); try { action(); } catch (e) { FRC.ui.report(e); } };
    dialog.onclose = () => dialog.remove();
    dialog.showModal();
  }
};