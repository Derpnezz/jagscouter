window.FRC = window.FRC || {};
FRC.blocks = (() => {
  const e = FRC.ui.escape;
  const gridInputId = (field,cell) => `grid-${field.length}-${field}-${cell}`;
  const numeric = (f,v) => `<input class="input counter-val" id="field-${f.id}" data-field="${f.id}" type="number" inputmode="decimal" min="${f.min}" max="${f.max}" step="${FRC.config.step(f)}" value="${e(v)}" aria-label="${e(f.label)}">`;
  const registry = {
    counter: (f,v) => `<div class="counter"><button type="button" class="counter-btn" data-count="${f.id}" data-dir="-1" aria-label="Decrease ${e(f.label)}">−</button>${numeric(f,v)}<button type="button" class="counter-btn" data-count="${f.id}" data-dir="1" aria-label="Increase ${e(f.label)}">+</button></div>`,
    number: numeric,
    toggle: (f,v) => `<label class="toggle-row" for="field-${f.id}"><span>${e(f.label)}</span><input id="field-${f.id}" data-field="${f.id}" type="checkbox" role="switch" ${v ? 'checked' : ''}></label>`,
    choice: (f,v) => {
      const button = o => `<button type="button" class="choice-btn ${o.value === v ? 'active' : ''}" data-choice="${f.id}" data-value="${e(o.value)}" aria-pressed="${o.value === v}">${e(o.label)}</button>`;
      const empty = f.allowEmpty ? button({value:'',label:f.emptyLabel || 'Not observed'}) : '';
      return `<div class="choice-group${f.layout === 'grid' ? ' choice-grid' : ''}"${f.layout === 'grid' ? ` style="--choice-columns:${f.columns}"` : ''} role="group" aria-label="${e(f.label)}">${f.layout === 'grid' ? '' : empty}${f.options.map(button).join('')}</div>${f.layout === 'grid' && empty ? `<div class="choice-group choice-clear">${empty}</div>` : ''}`;
    },
    multiSelect: (f,v) => `<div class="choice-group" role="group" aria-label="${e(f.label)}">${f.options.map(o => `<button type="button" class="choice-btn ${v.includes(o.value) ? 'active' : ''}" data-multi="${f.id}" data-value="${e(o.value)}" aria-pressed="${v.includes(o.value)}"${!v.includes(o.value) && v.length >= f.maxSelections ? ' disabled' : ''}>${e(o.label)}</button>`).join('')}</div><p class="hint">Select ${Math.max(f.minSelections,f.required ? 1 : 0)}–${f.maxSelections} options.</p>`,
    duration: (f,v) => `<div class="duration-controls">${numeric(f,v)}<span class="hint">seconds</span><button type="button" class="btn btn-secondary" data-duration="${f.id}" data-action="start">Start</button><button type="button" class="btn btn-ghost" data-duration="${f.id}" data-action="reset">Reset</button><span class="hint" id="timer-status-${f.id}">Paused</span></div>`,
    counterGrid: (f,v) => `<div class="counter-grid" role="group" aria-label="${e(f.label)}" style="--counter-columns:${f.columns.length};--counter-mobile-columns:${Math.min(f.columns.length,2)}">${f.rows.map(row => `<div class="counter-grid-row"><h4>${e(row.label)}</h4>${f.columns.map(col => {
      const cell = f.cells.find(cell => cell.row === row.id && cell.column === col.id);
      const label = `${f.label}: ${row.label} / ${col.label}`;
      const id = gridInputId(f.id,cell.id);
      return `<div class="counter-grid-cell"><label for="${id}">${e(col.label)}</label><div class="counter"><button type="button" class="counter-btn" data-grid-count="${f.id}" data-cell="${cell.id}" data-dir="-1" aria-label="Decrease ${e(label)}">−</button><input class="input counter-val" id="${id}" data-grid="${f.id}" data-cell="${cell.id}" type="number" inputmode="numeric" min="${cell.min}" max="${cell.max}" step="${cell.step}" value="${e(v[cell.id])}" aria-label="${e(label)}"><button type="button" class="counter-btn" data-grid-count="${f.id}" data-cell="${cell.id}" data-dir="1" aria-label="Increase ${e(label)}">+</button></div></div>`;
    }).join('')}</div>`).join('')}</div>`,
    rating: (f,v) => registry.choice({...f,options:Array.from({length:Math.floor((f.max-f.min)/f.step)+1},(_,i) => {
      const n = Number((f.min+i*f.step).toFixed(6)); return {value:String(n),label:String(n)};
    })},String(v)),
    text: (f,v) => f.multiline
      ? `<textarea class="textarea" id="field-${f.id}" data-field="${f.id}" maxlength="${f.maxLength}" placeholder="${e(f.placeholder || '')}">${e(v)}</textarea>`
      : `<input class="input" id="field-${f.id}" data-field="${f.id}" maxlength="${f.maxLength}" value="${e(v)}" placeholder="${e(f.placeholder || '')}">`
  };
  function render(f,v) {
    const content = registry[f.type](f,v);
    return `<div class="form-group field-row" data-field-row="${f.id}">${f.type !== 'toggle' ? `<label class="form-label" ${['counter','number','text','duration'].includes(f.type) ? `for="field-${f.id}"` : ''}>${e(f.label)}${f.required ? ' *' : ''}</label>` : ''}${content}${f.help ? `<p class="hint">${e(f.help)}</p>` : ''}<p class="error hidden" id="error-${f.id}" role="alert"></p></div>`;
  }
  // Only elapsed seconds belong to an answer/draft; clocks never get serialized.
  function createDuration(f,initial,onValue,now = () => performance.now()) {
    let base = initial, started = 0, running = false, last = initial;
    const value = () => {
      if (!running) return base;
      const raw = Math.min(f.max,base+(now()-started)/1000), increment = FRC.config.step(f);
      return Number((f.min+Math.floor((raw-f.min)/increment+0.000001)*increment).toFixed(f.precision));
    };
    const emit = v => {if (v !== last) {last = v; onValue(v);}};
    function pause() {base = value(); running = false; emit(base); return base;}
    return {
      get running() {return running;}, value,
      start() {if (FRC.config.valueError(f,base)) throw new Error(`${f.label}: enter valid seconds before starting.`); if (!running) {started = now(); running = true;}},
      pause,
      set(v) {pause(); base = v; last = v;},
      reset() {pause(); base = f.min; emit(base);},
      tick() {const v = value(); emit(v); if (running && v >= f.max) pause(); return v;}
    };
  }
  function bind(root,config,answers,changed) {
    const fields = FRC.config.fields(config), timers = new Map();
    let interval = null;
    const notify = (id,v) => {answers[id] = v; changed(id,v);};
    root.querySelectorAll('[data-multi]').forEach(button => button.onclick = () => {
      const f = fields.find(f => f.id === button.dataset.multi), selected = answers[f.id];
      const values = selected.includes(button.dataset.value) ? selected.filter(v => v !== button.dataset.value) : [...selected,button.dataset.value];
      if (values.length > f.maxSelections) return;
      notify(f.id,f.options.filter(o => values.includes(o.value)).map(o => o.value));
      root.querySelectorAll(`[data-multi="${f.id}"]`).forEach(btn => {
        const on = answers[f.id].includes(btn.dataset.value);
        btn.classList.toggle('active',on); btn.setAttribute('aria-pressed',on);
        btn.disabled = !on && answers[f.id].length >= f.maxSelections;
      });
    });
    root.querySelectorAll('[data-grid]').forEach(input => input.oninput = () => {
      const id = input.dataset.grid;
      notify(id,{...answers[id],[input.dataset.cell]:input.value === '' ? null : Number(input.value)});
    });
    root.querySelectorAll('[data-grid-count]').forEach(button => button.onclick = () => {
      const f = fields.find(f => f.id === button.dataset.gridCount), cell = f.cells.find(cell => cell.id === button.dataset.cell);
      const previous = answers[f.id][cell.id];
      const value = Math.max(cell.min,Math.min(cell.max,(Number.isFinite(previous) ? previous : cell.min)+Number(button.dataset.dir)*cell.step));
      notify(f.id,{...answers[f.id],[cell.id]:value});
      root.querySelector(`#${gridInputId(f.id,cell.id)}`).value = value;
    });
    for (const f of fields.filter(f => f.type === 'choice' && f.layout === 'grid')) {
      const buttons = [...root.querySelectorAll(`.choice-grid [data-choice="${f.id}"]`)];
      buttons.forEach((btn,i) => btn.onkeydown = event => {
        const deltas = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-f.columns,ArrowDown:f.columns};
        if (!(event.key in deltas) && !['Home','End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : Math.max(0,Math.min(buttons.length-1,i+deltas[event.key]));
        buttons[next].focus();
      });
    }
    const showTimer = (f,timer) => {
      const button = root.querySelector(`[data-duration="${f.id}"][data-action="start"]`), status = root.querySelector(`#timer-status-${f.id}`);
      if (button) button.textContent = timer.running ? 'Pause' : 'Start';
      if (status) status.textContent = timer.running ? 'Running' : 'Paused';
    };
    function schedule() {
      if ([...timers.values()].some(timer => timer.running)) {
        if (interval === null) interval = setInterval(() => {
          for (const [f,timer] of timers) {timer.tick(); showTimer(f,timer);}
          schedule();
        },250);
      } else if (interval !== null) {clearInterval(interval); interval = null;}
    }
    for (const f of fields.filter(f => f.type === 'duration')) {
      const input = root.querySelector(`#field-${f.id}`);
      const timer = createDuration(f,answers[f.id],value => {
        input.value = value; notify(f.id,value);
      });
      timers.set(f,timer);
      input.oninput = () => {
        const value = input.value === '' ? null : Number(input.value);
        timer.pause(); timer.set(value);
        input.value = value === null ? '' : value;
        notify(f.id,value); showTimer(f,timer); schedule();
      };
      root.querySelectorAll(`[data-duration="${f.id}"]`).forEach(button => button.onclick = () => {
        try {
          if (button.dataset.action === 'reset') {
            if (!window.confirm(`Reset ${f.label} to ${f.min} seconds?`)) return;
            timer.reset();
          } else if (timer.running) timer.pause();
          else timer.start();
          showTimer(f,timer); schedule();
        } catch(error) {FRC.ui.report(error);}
      });
    }
    function pause() {
      for (const [f,timer] of timers) {timer.pause(); showTimer(f,timer);}
      schedule();
    }
    return {pause,destroy:pause};
  }
  return {registry,render,bind,createDuration};
})();