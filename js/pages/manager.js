window.FRC.pages = window.FRC.pages || {};
FRC.pages.manager = (() => {
  let tab = 'scan', selectedKey, filter = '', sort = 'matchNumber', direction = 1, scanner = null, cleanup = Promise.resolve();
  const e = FRC.ui.escape;
  function stopScanner() {
    if (scanner) {
      const old = scanner; scanner = null;
      cleanup = old.clear().catch(() => {});
    }
    return cleanup;
  }
  function render(root) {
    stopScanner();
    const raw = FRC.storage.getMatches();
    const groups = FRC.records.groups(raw), current = FRC.config.key(FRC.config.active);
    if (!groups.some(g => g.key === current)) groups.unshift({key:current,definition:FRC.config.active,records:[]});
    if (!groups.some(g => g.key === selectedKey)) selectedKey = current;
    const selected = groups.find(g => g.key === selectedKey);
    root.innerHTML = `<div class="manager-page">${FRC.ui.header('Manager',`${raw.length} saved`)}
      <main class="page-content wide">
        <div class="data-toolbar"><div class="form-group"><label class="form-label" for="form-select">Game & form version</label><select class="select" id="form-select">${groups.map((g,i) => `<option value="${i}" ${g.key === selectedKey ? 'selected' : ''}>${g.definition ? `${e(g.definition.name)} ${g.definition.season} · ${e(g.definition.version)}` : 'Unrecognized records (preserved)'} · ${g.records.length} matches${g.key === current ? ' · Current' : ''}${groups.filter(x => x.definition?.gameId === g.definition?.gameId && x.definition?.version === g.definition?.version).length > 1 ? ` · Definition ${i+1}` : ''}</option>`).join('')}</select></div><button class="btn btn-secondary" id="recovery-backup">Recovery backup</button></div>
        <nav class="tabs-nav" aria-label="Manager views">${[['scan','Collect'],['data','Matches'],['stats','Insights']].map(([id,label]) => `<button type="button" class="tab-btn ${tab === id ? 'active' : ''}" data-tab="${id}" aria-pressed="${tab === id}">${label}</button>`).join('')}</nav>
        <div id="manager-view"></div>
        <p class="hint">Stored only on this device. Export backups regularly. Insights never combine different form definitions.</p>
      </main></div>`;
    root.querySelector('#form-select').onchange = event => {selectedKey = groups[Number(event.target.value)].key; sort = 'matchNumber'; render(root);};
    root.querySelector('#recovery-backup').onclick = () => FRC.ui.download(FRC.storage.recoveryBackup(),'scouting-recovery.json');
    root.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => {tab = button.dataset.tab; render(root);});
    const view = root.querySelector('#manager-view');
    if (tab === 'scan') renderScan(view,root);
    else if (tab === 'data') renderData(view,root,selected);
    else renderStats(view,selected);
  }
  function renderScan(view,root) {
    view.innerHTML = `<div class="scan-intro"><h2>Collect a match</h2><p class="hint">Scan a scouter’s QR code, or import their CSV backup in Matches. No shared network is needed.</p></div><div class="card card-body"><div id="qr-reader"></div></div><details class="card card-body"><summary>Paste a QR transfer code</summary><p class="hint">Use the compressed text from a scouting QR code if a camera is unavailable.</p><label class="form-label" for="transfer-code">Transfer code</label><textarea id="transfer-code" class="textarea" maxlength="10000"></textarea><button class="btn btn-primary" id="collect-code">Collect match</button></details>`;
    view.querySelector('#collect-code').onclick = () => collect(view.querySelector('#transfer-code').value.trim(),root);
    cleanup.then(() => {
      if (!view.isConnected || tab !== 'scan') return;
      try {
        const instance = new Html5QrcodeScanner('qr-reader',{fps:10,qrbox:{width:220,height:220}},false);
        scanner = instance;
        instance.render(text => {
          try { instance.pause(true); } catch (_) {}
          collect(text,root);
          setTimeout(() => { if (scanner === instance) { try { instance.resume(); } catch (_) {} } },2000);
        },() => {});
      } catch(error) { view.querySelector('#qr-reader').textContent = 'Camera unavailable. Import a CSV backup or paste the transfer code instead.'; }
    });
  }
  function collect(text,root) {
    try {
      const r = FRC.records.decode(text), added = FRC.storage.saveMatch(r);
      FRC.app.toast(added ? 'Match collected' : 'Already collected',`Team ${r.teamNumber} · Match ${r.matchNumber}`,added ? 'success' : '');
      const badge = root.querySelector('.badge'); if (badge) badge.textContent = `${FRC.storage.getMatches().length} saved`;
    } catch(error) { FRC.ui.report(error); }
  }
  function renderData(view,root,group) {
    view.innerHTML = `<div class="data-toolbar"><div class="form-group"><label class="form-label" for="filter-team">Find a team</label><input class="input" id="filter-team" placeholder="Team number" value="${e(filter)}"></div><div class="toolbar-actions"><button class="btn btn-secondary" id="import-csv">Import CSV</button><input type="file" accept=".csv,text/csv" id="csv-file" hidden><button class="btn btn-secondary" id="export-csv">Export this form</button><button class="btn btn-secondary" id="export-json">Backup all records</button><button class="btn btn-danger" id="clear-all">Delete all</button></div></div><div id="match-table"></div>`;
    view.querySelector('#filter-team').oninput = event => { filter = event.target.value.trim(); table(view.querySelector('#match-table'),group,root); };
    view.querySelector('#export-csv').onclick = () => {
      try {
        if (!group.definition) throw new Error('Use Backup all records to preserve unrecognized data.');
        FRC.ui.download(FRC.csv.exportRecords(group.records),`scouting-${group.definition.gameId}-${group.definition.version}.csv`,'text/csv');
      } catch(error) { FRC.ui.report(error); }
    };
    view.querySelector('#export-json').onclick = () => FRC.ui.download(JSON.stringify(FRC.storage.getMatches(),null,2),'scouting-records.json');
    view.querySelector('#import-csv').onclick = () => view.querySelector('#csv-file').click();
    view.querySelector('#csv-file').onchange = async event => {
      const file = event.target.files[0]; event.target.value = ''; if (!file) return;
      try {
        if (file.size > 10000000) throw new Error('CSV exceeds the 10 MB import limit.');
        const records = FRC.csv.importRecords(await file.text()), result = FRC.storage.saveBatch(records);
        selectedKey = FRC.config.key(records[0].definition);
        FRC.app.toast('CSV imported',`${result.added} added · ${result.duplicates} duplicates skipped`,'success');
        render(root);
      } catch(error) { FRC.ui.report(error); }
    };
    view.querySelector('#clear-all').onclick = () => FRC.ui.confirm('Delete all matches?','This removes every saved match on this device, across all forms. Export a backup first. This cannot be undone.',() => {FRC.storage.clearMatches(); render(root);});
    table(view.querySelector('#match-table'),group,root);
  }
  function table(container,group,root) {
    if (!group.definition) {
      container.innerHTML = '<div class="empty-state"><h3>These records are preserved</h3><p>They cannot be interpreted safely. Download a backup of all records to recover them; they have not been changed.</p></div>';
      return;
    }
    const fields = FRC.config.fields(group.definition);
    const columns = [{id:'matchNumber',label:'Match'}, {id:'teamNumber',label:'Team'}, {id:'alliance',label:'Alliance'}, ...fields.map(f => ({id:`answer:${f.id}`,label:f.label})),{id:'scouterName',label:'Scouter'}];
    const value = (r,id) => id.startsWith('answer:') ? r.answers[id.slice(7)] : r[id];
    const records = group.records.filter(r => !filter || String(r.teamNumber).includes(filter)).slice().sort((a,b) => {
      const av = value(a,sort), bv = value(b,sort);
      const sortable = v => v && typeof v === 'object' ? FRC.config.canonical(Array.isArray(v) ? v.slice().sort() : v) : String(v ?? '');
      return (typeof av === 'number' ? av-bv : sortable(av).localeCompare(sortable(bv)))*direction;
    });
    if (!records.length) { container.innerHTML = '<div class="empty-state"><h3>No matches here yet</h3><p>Collect a QR code or import a CSV. Try clearing the team filter if you already have data.</p></div>'; return; }
    container.innerHTML = `<p class="hint">${records.length} matches · Scroll horizontally for all fields.</p><div class="table-wrap"><table><thead><tr>${columns.map(col => `<th><button class="table-sort" data-sort="${e(col.id)}">${e(col.label)}${sort === col.id ? direction === 1 ? ' ↑' : ' ↓' : ''}</button></th>`).join('')}<th>Actions</th></tr></thead><tbody>${records.map((r,i) => `<tr>${columns.map(col => {
      let v = value(r,col.id);
      if (typeof v === 'boolean') v = v ? 'Yes' : 'No';
      const f = fields.find(f => `answer:${f.id}` === col.id);
      if (f) v = FRC.config.format(f,value(r,col.id));
      return `<td${col.id === 'alliance' ? ` class="alliance-${r.alliance}"` : ''}>${e(v)}</td>`;
    }).join('')}<td><button class="btn btn-secondary" data-details="${i}">Details</button><button class="btn btn-ghost" data-delete="${i}" aria-label="Delete team ${r.teamNumber} match ${r.matchNumber}">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
    container.querySelectorAll('[data-sort]').forEach(button => button.onclick = () => {if (sort === button.dataset.sort) direction *= -1; else {sort = button.dataset.sort; direction = 1;} table(container,group,root);});
    container.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => {
      const r = records[Number(button.dataset.delete)];
      FRC.ui.confirm('Delete this match?',`Team ${r.teamNumber}, match ${r.matchNumber} will be removed from this device.`,() => {FRC.storage.deleteMatch(r.id); render(root);});
    });
    container.querySelectorAll('[data-details]').forEach(button => button.onclick = () => showDetails(records[Number(button.dataset.details)]));
  }
  function showDetails(r) {
    const dialog = document.createElement('dialog'); dialog.className = 'modal record-details';
    dialog.innerHTML = `<h2>Team ${r.teamNumber} · Match ${r.matchNumber}</h2><p class="hint">${e(r.definition.name)} · ${e(r.formVersion)} · ${e(r.scouterName || 'Unnamed scout')}</p><dl>${FRC.config.fields(r.definition).map(f => `<dt>${e(f.label)}</dt><dd>${e(FRC.config.format(f,r.answers[f.id]))}</dd>`).join('')}</dl><button class="btn btn-primary btn-full" data-close>Done</button>`;
    document.body.appendChild(dialog); dialog.querySelector('[data-close]').onclick = () => dialog.close(); dialog.onclose = () => dialog.remove(); dialog.showModal();
  }
  function renderStats(view,group) {
    if (!group.definition || !group.records.length) { view.innerHTML = '<div class="empty-state"><h3>Insights start with match data</h3><p>Collect matches for this form to compare teams. Other forms remain separate.</p></div>'; return; }
    const c = group.definition;
    if (!c.metrics.length) {view.innerHTML = '<div class="empty-state">This definition has no summary metrics. All answers remain available in Matches.</div>'; return;}
    const stats = FRC.analytics.teamStats(group.records,c).sort((a,b) => b.metrics[c.metrics[0].id]-a.metrics[c.metrics[0].id]);
    view.innerHTML = `<div class="form-group"><label class="form-label" for="stats-team">Team view</label><select class="select" id="stats-team"><option value="all">All teams</option>${stats.map(s => `<option value="${s.teamNumber}">Team ${s.teamNumber}</option>`).join('')}</select></div><div id="stats-results"></div><div class="card card-body metric-definition"><h3>What these metrics mean</h3>${c.metrics.map(m => `<p><strong>${e(m.label)}:</strong> ${e(m.description)}</p>`).join('')}<p class="hint">Counts and scout ratings are not official scores. Small sample sizes can be misleading.</p></div>`;
    const results = view.querySelector('#stats-results');
    const format = (v,m) => `${v.toFixed(1)}${m.operation === 'rate' ? '%' : ''}`;
    function draw(team) {
      if (team === 'all') results.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Team</th><th>Matches</th>${c.metrics.map(m => `<th>${e(m.label)}${m.operation === 'sum' ? ' (avg)' : ''}</th>`).join('')}</tr></thead><tbody>${stats.map(s => `<tr><td><strong>${s.teamNumber}</strong></td><td>${s.matches}</td>${c.metrics.map(m => `<td>${format(s.metrics[m.id],m)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      else {
        const s = stats.find(s => String(s.teamNumber) === team);
        results.innerHTML = `<h2>Team ${s.teamNumber}</h2><p class="hint">${s.matches} observed matches</p><div class="stat-grid">${c.metrics.map(m => `<div class="stat-card"><div class="stat-label">${e(m.label)}</div><div class="stat-val">${format(s.metrics[m.id],m)}</div></div>`).join('')}</div>`;
      }
    }
    view.querySelector('#stats-team').onchange = event => draw(event.target.value); draw('all');
  }
  return {render,_cleanup:stopScanner};
})();