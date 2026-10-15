window.FRC.pages = window.FRC.pages || {};
FRC.pages.scouter = (() => {
  let state, tab = 'setup', configKey;
  let controls = {pause() {},destroy() {}};
  const e = FRC.ui.escape;
  function initial(c) {
    return {teamNumber:'',matchNumber:'',alliance:'red',scouterName:FRC.storage.getScouterName(),answers:FRC.config.defaults(c)};
  }
  function persist(root) {
    try {
      FRC.storage.saveDraft(FRC.config.active,state);
      const label = root.querySelector('#draft-status');
      if (label) label.textContent = 'Draft saved on this device';
      return true;
    } catch(error) {
      const label = root.querySelector('#draft-status');
      if (label) label.textContent = 'Draft not saved';
      FRC.ui.report(error);
      return false;
    }
  }
  function render(root) {
    controls.destroy();
    const c = FRC.config.active, key = FRC.config.key(c);
    if (!state || key !== configKey) { state = FRC.storage.getDraft(c) || initial(c); configKey = key; tab = 'setup'; }
    if (state.handoff) { renderQR(root,state.handoff); return; }
    renderForm(root);
  }
  function renderForm(root) {
    controls.destroy();
    const c = FRC.config.active;
    const tabs = [{id:'setup',label:'Setup'},...c.sections];
    const archived = FRC.storage.otherDrafts(c);
    root.innerHTML = `<div class="scouter-page">
      ${FRC.ui.header('Scout match',`${c.name} ${c.season}`)}
      <main class="page-content">
        <div class="scout-intro"><h2>${state.teamNumber ? `Team ${e(state.teamNumber)}` : 'Ready for the next match?'}</h2><p class="hint" id="draft-status">Draft saved on this device · Form ${e(c.version)}</p></div>
        ${archived.length ? `<div class="card card-body"><p>A draft from another form is preserved on this device.</p><button type="button" class="btn btn-secondary" id="archive-drafts">Download preserved drafts</button></div>` : ''}
        <nav class="tabs-nav" aria-label="Scouting sections" role="tablist">${tabs.map(s => `<button type="button" class="tab-btn ${tab === s.id ? 'active' : ''}" id="tab-${s.id}" data-tab="${s.id}" role="tab" aria-selected="${tab === s.id}" aria-controls="panel-${s.id}">${e(s.label)}</button>`).join('')}</nav>
        <form id="scouter-form" novalidate>
          <section role="tabpanel" id="panel-setup" aria-labelledby="tab-setup" ${tab !== 'setup' ? 'hidden' : ''}>
            <div class="card"><div class="section-header"><h3>Match details</h3></div><div class="section-body">
              <div class="grid-2">${[['teamNumber','Team number','254'],['matchNumber','Match number','1']].map(([id,label,placeholder]) => `<div class="form-group"><label class="form-label" for="${id}">${label}</label><input class="input input-lg" id="${id}" data-meta="${id}" type="number" min="1" max="100000" step="1" inputmode="numeric" value="${e(state[id])}" placeholder="${placeholder}" required><p class="error hidden" id="error-${id}" role="alert"></p></div>`).join('')}</div>
              <div class="form-group"><span class="form-label">Alliance</span><div class="choice-group">${['red','blue'].map(a => `<button type="button" class="choice-btn alliance-${a} ${state.alliance === a ? 'active' : ''}" data-alliance="${a}" aria-pressed="${state.alliance === a}">${a === 'red' ? 'Red' : 'Blue'} alliance</button>`).join('')}</div></div>
              <div class="form-group"><label class="form-label" for="scouterName">Scouter name (optional)</label><input class="input" id="scouterName" data-meta="scouterName" maxlength="100" value="${e(state.scouterName)}" autocomplete="name"></div>
            </div></div>
          </section>
          ${c.sections.map(s => `<section role="tabpanel" id="panel-${s.id}" aria-labelledby="tab-${s.id}" ${tab !== s.id ? 'hidden' : ''}><div class="card"><div class="section-header"><h3>${e(s.label)}</h3>${s.description ? `<p class="hint">${e(s.description)}</p>` : ''}</div><div class="section-body">${s.fields.map(f => FRC.blocks.render(f,state.answers[f.id])).join('')}</div></div></section>`).join('')}
        </form>
        <p class="hint scout-footer">Switch sections any time. Your entries stay saved. Counts are observations, not official scores.</p>
      </main>
      <div class="submit-bar"><div class="submit-bar-inner"><button type="button" class="btn btn-primary btn-lg btn-full" id="generate-qr">Save match & show QR</button></div></div>
    </div>`;
    root.querySelector('#archive-drafts')?.addEventListener('click',() => FRC.ui.download(JSON.stringify(archived,null,2),'preserved-drafts.json'));
    root.querySelectorAll('[data-tab]').forEach(btn => {
      btn.onclick = () => {
        tab = btn.dataset.tab;
        root.querySelectorAll('[role=tab]').forEach(b => { const active = b.dataset.tab === tab; b.classList.toggle('active',active); b.setAttribute('aria-selected',active); });
        root.querySelectorAll('[role=tabpanel]').forEach(p => p.hidden = p.id !== `panel-${tab}`);
      };
      btn.onkeydown = event => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...root.querySelectorAll('[role=tab]')], index = buttons.indexOf(btn);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (index+(event.key === 'ArrowRight' ? 1 : -1)+buttons.length)%buttons.length;
        buttons[next].click(); buttons[next].focus();
      };
    });
    root.querySelectorAll('[data-meta]').forEach(input => input.oninput = () => { state[input.dataset.meta] = input.value; state.entryId = null; persist(root); });
    root.querySelectorAll('[data-alliance]').forEach(btn => btn.onclick = () => {
      state.alliance = btn.dataset.alliance; state.entryId = null;
      root.querySelectorAll('[data-alliance]').forEach(b => { const active = b.dataset.alliance === state.alliance; b.classList.toggle('active',active); b.setAttribute('aria-pressed',active); });
      persist(root);
    });
    const fields = FRC.config.fields(c);
    root.querySelectorAll('[data-field]').forEach(input => input.oninput = () => {
      const f = fields.find(f => f.id === input.dataset.field);
      state.answers[f.id] = f.type === 'toggle' ? input.checked : ['counter','number'].includes(f.type) ? (input.value === '' ? null : Number(input.value)) : input.value;
      state.entryId = null; persist(root);
    });
    root.querySelectorAll('[data-count]').forEach(btn => btn.onclick = () => {
      const f = fields.find(f => f.id === btn.dataset.count);
      const value = state.answers[f.id];
      state.answers[f.id] = Number(Math.max(f.min,Math.min(f.max,(Number.isFinite(value) ? value : f.min) + Number(btn.dataset.dir)*f.step)).toFixed(6));
      root.querySelector(`#field-${f.id}`).value = state.answers[f.id];
      state.entryId = null; persist(root);
    });
    root.querySelectorAll('[data-choice]').forEach(btn => btn.onclick = () => {
      const f = fields.find(f => f.id === btn.dataset.choice);
      state.answers[f.id] = f.type === 'rating' ? Number(btn.dataset.value) : btn.dataset.value;
      root.querySelectorAll(`[data-choice="${f.id}"]`).forEach(b => { const active = b.dataset.value === String(state.answers[f.id]); b.classList.toggle('active',active); b.setAttribute('aria-pressed',active); });
      state.entryId = null; persist(root);
    });
    root.querySelector('#scouter-form').onsubmit = event => {event.preventDefault(); generate(root);};
    root.querySelector('#generate-qr').onclick = () => generate(root);
    controls = FRC.blocks.bind(root,c,state.answers,() => {state.entryId = null; persist(root);});
    persist(root);
  }
  function generate(root) {
    controls.pause();
    const c = FRC.config.active, problems = [];
    for (const k of ['teamNumber','matchNumber']) {
      const n = Number(state[k]);
      if (!Number.isInteger(n) || n <= 0 || n > 100000) problems.push({id:k,tab:'setup',message:'Enter a whole number from 1 to 100000.'});
    }
    for (const s of c.sections) for (const f of s.fields) {
      const error = FRC.config.valueError(f,state.answers[f.id]);
      if (error) problems.push({id:f.id,tab:s.id,message:`${f.label} ${error}.`});
    }
    root.querySelectorAll('.error').forEach(el => el.classList.add('hidden'));
    for (const p of problems) { const label = root.querySelector(`#error-${p.id}`); label.textContent = p.message; label.classList.remove('hidden'); }
    if (problems.length) {
      root.querySelector(`#tab-${problems[0].tab}`).click();
      root.querySelector(`#error-${problems[0].id}`).scrollIntoView({block:'center'});
      return;
    }
    try {
      const entry = FRC.records.validate({
        recordVersion:1,id:state.entryId || crypto.randomUUID(),timestamp:state.entryTimestamp || Date.now(),
        gameId:c.gameId,formVersion:c.version,definition:FRC.config.snapshot(c),
        teamNumber:Number(state.teamNumber),matchNumber:Number(state.matchNumber),alliance:state.alliance,
        scouterName:state.scouterName.trim(),answers:structuredClone(state.answers)
      });
      FRC.storage.saveMatch(entry);
      FRC.storage.saveScouterName(entry.scouterName);
      state.entryId = entry.id; state.entryTimestamp = entry.timestamp; state.handoff = entry;
      if (!persist(root)) { state.handoff = null; return; }
      renderQR(root,entry);
    } catch(error) { FRC.ui.report(error); }
  }
  function renderQR(root,entry) {
    root.innerHTML = `<div class="qr-screen">${FRC.ui.header('Match saved')}<h2 class="qr-team">Team ${entry.teamNumber}</h2><p class="qr-match">Match ${entry.matchNumber} · ${e(entry.alliance)} alliance</p><p class="hint">Saved on this device. Ask your manager to scan this code.</p><div class="qr-wrapper"><div id="qr-container"></div></div><p id="qr-error" class="error" role="alert"></p><div class="qr-actions"><button class="btn btn-secondary" id="edit-match">Back to form</button><button class="btn btn-secondary" id="download-match">Download CSV backup</button><button class="btn btn-primary btn-lg" id="next-match">Next match</button></div></div>`;
    const container = root.querySelector('#qr-container');
    requestAnimationFrame(() => {
      try {
        const compressed = FRC.records.encode(entry);
        const size = Math.min(350,Math.max(220,window.innerWidth-80));
        new QRCode(container,{text:compressed,width:size,height:size,correctLevel:QRCode.CorrectLevel.L});
      } catch(error) {
        root.querySelector('#qr-error').textContent = error.message || 'QR is too large. Download the CSV backup for transfer.';
        container.textContent = 'Use CSV backup';
      }
    });
    root.querySelector('#download-match').onclick = () => FRC.ui.download(FRC.csv.exportRecords([entry]),`team-${entry.teamNumber}-match-${entry.matchNumber}.csv`,'text/csv');
    root.querySelector('#edit-match').onclick = () => { state.handoff = null; persist(root); renderForm(root); };
    root.querySelector('#next-match').onclick = () => {
      state = {...initial(FRC.config.active),matchNumber:entry.matchNumber+1,alliance:entry.alliance,scouterName:entry.scouterName};
      tab = 'setup'; persist(root); renderForm(root);
    };
  }
  const cleanup = () => controls.destroy();
  window.addEventListener('pagehide',cleanup);
  return {render,_cleanup:cleanup};
})();