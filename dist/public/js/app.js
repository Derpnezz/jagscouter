window.FRC = window.FRC || {};
FRC.app = {
  toast(title,description,type = '') {
    const container = document.getElementById('toast-container'), toast = document.createElement('div');
    toast.className = `toast ${type}`; toast.setAttribute('role',type === 'error' ? 'alert' : 'status');
    toast.innerHTML = `<div class="toast-title">${FRC.ui.escape(title)}</div><div class="toast-desc">${FRC.ui.escape(description || '')}</div>`;
    container.appendChild(toast); setTimeout(() => toast.remove(),5000);
  }
};
document.addEventListener('DOMContentLoaded',async () => {
  const root = document.getElementById('root');
  function errorPage(error) {
    root.innerHTML = `${FRC.ui.header('Home')}<main class="page-content"><div class="card card-body"><h1>We couldn’t open JagScouter</h1><p class="error">${FRC.ui.escape(error.message)}</p><p class="hint">Your existing device data has not been removed.</p><button class="btn btn-secondary" id="recovery">Download recovery backup</button><button class="btn btn-primary" id="retry">Try again</button></div></main>`;
    root.querySelector('#recovery').onclick = () => { try { FRC.ui.download(FRC.storage.recoveryBackup(),'scouting-recovery.json'); } catch(error) {FRC.ui.report(error);} };
    root.querySelector('#retry').onclick = () => location.reload();
  }
  async function route() {
    try {
      FRC.pages.scouter._cleanup();
      await FRC.pages.manager._cleanup();
      const hash = location.hash.slice(1) || '/';
      document.title = `${hash === '/scouter' ? 'Scout match · ' : hash === '/manager' ? 'Manager · ' : ''}JagScouter | JagBots4638`;
      if (hash === '/') FRC.pages.home.render(root);
      else if (hash === '/scouter') FRC.pages.scouter.render(root);
      else if (hash === '/manager') FRC.pages.manager.render(root);
      else root.innerHTML = `${FRC.ui.header('Home')}<main class="page-content"><h1>Page not found</h1><a class="btn btn-primary" href="#/">Go home</a></main>`;
    } catch(error) {errorPage(error);}
  }
  root.innerHTML = '<main class="page-content"><p class="hint">Opening scouting…</p></main>';
  try {
    await FRC.offline.init();
    await FRC.config.load();
    window.addEventListener('hashchange',route);
    await route();
    if (navigator.onLine) FRC.offline.check();
  } catch(error) {errorPage(error);}
});