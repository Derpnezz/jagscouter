window.FRC = window.FRC || {};
FRC.config = (() => {
  const types = ['counter', 'number', 'toggle', 'choice', 'rating', 'text', 'multiSelect', 'duration', 'counterGrid'];
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const idOK = x => typeof x === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/.test(x) && !['__proto__', 'constructor', 'prototype'].includes(x);
  const textOK = (x, max = 250) => typeof x === 'string' && x.length <= max;
  const fields = c => c.sections.flatMap(s => s.fields);
  const object = x => x && typeof x === 'object' && !Array.isArray(x);
  const numericTypes = ['counter','number','rating','duration'];
  const step = f => f.type === 'duration' ? 10 ** -f.precision : f.step;
  function numericError(f,v) {
    if (!Number.isFinite(v) || v < f.min || v > f.max) return `must be between ${f.min} and ${f.max}`;
    const increment = step(f);
    if (Math.abs((v-f.min)/increment-Math.round((v-f.min)/increment)) > 0.000001) return `must use increments of ${increment}`;
    return '';
  }
  function valueError(f, v) {
    if (numericTypes.includes(f.type)) return numericError(f,v);
    if (f.type === 'multiSelect') {
      if (!Array.isArray(v) || new Set(v).size !== v.length || v.some(id => !f.options.some(o => o.value === id))) return 'must contain unique configured option IDs';
      const min = Math.max(f.minSelections,f.required ? 1 : 0);
      if (v.length < min || v.length > f.maxSelections) return `must select ${min}–${f.maxSelections} options`;
    } else if (f.type === 'counterGrid') {
      if (!object(v) || Object.keys(v).length !== f.cells.length || Object.keys(v).some(id => !f.cells.some(cell => cell.id === id))) return 'must contain exactly the configured cell IDs';
      for (const cell of f.cells) {
        const error = !own(v,cell.id) ? 'is missing' : numericError(cell,v[cell.id]);
        if (error) return `${cell.id} ${error}`;
      }
    } else if (f.type === 'toggle' && typeof v !== 'boolean') return 'must be true or false';
    else if (f.type === 'choice' && !(v === '' && f.allowEmpty && !f.required) && !f.options.some(o => o.value === v)) return 'must be one of the configured choices';
    else if (f.type === 'text' && (!textOK(v, f.maxLength) || (f.required && !v.trim()))) return `must contain ${f.required ? '1' : '0'}–${f.maxLength} characters`;
    return '';
  }
  function validate(c) {
    const fail = msg => { throw new Error(`Game definition: ${msg}`); };
    const keys = (value,allowed,label) => {
      if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(`${label}: unknown properties or invalid object.`);
    };
    if (!c || c.schemaVersion !== 1) fail('schemaVersion must be 1.');
    keys(c,['schemaVersion','gameId','name','season','version','description','sections','metrics','sources'],'form');
    if (!idOK(c.gameId) || !textOK(c.name, 80) || !c.name || !Number.isInteger(c.season) || !textOK(c.version, 40) || !c.version) fail('provide gameId, name, integer season, and version.');
    if (!Array.isArray(c.sections) || !c.sections.length || c.sections.length > 12) fail('provide 1–12 sections.');
    const ids = new Set(), sections = new Set();
    for (const s of c.sections) {
      keys(s,['id','label','description','fields'],'section');
      if (!idOK(s.id) || sections.has(s.id) || s.id === 'setup' || !textOK(s.label, 60) || !s.label) fail('section IDs must be unique (setup is reserved) and labels must be nonempty.');
      sections.add(s.id);
      if (s.description !== undefined && !textOK(s.description, 400)) fail(`${s.id}: description is too long.`);
      if (!Array.isArray(s.fields) || !s.fields.length) fail(`${s.id}: provide fields.`);
      for (const f of s.fields) {
        const settings = {
          counter:['min','max','step'],number:['min','max','step'],rating:['min','max','step'],
          toggle:[],text:['maxLength','multiline'],
          choice:['options','layout','columns','allowEmpty','emptyLabel'],
          multiSelect:['options','minSelections','maxSelections'],
          duration:['min','max','precision'],counterGrid:['rows','columns','cells']
        };
        keys(f,['id','type','label','default','help','placeholder','required',...(settings[f?.type] || [])],'field');
        if (!idOK(f.id) || ids.has(f.id)) fail('field IDs must be unique, safe identifiers.');
        ids.add(f.id);
        if (!types.includes(f.type) || !textOK(f.label, 100) || !f.label) fail(`${f.id}: invalid type or label.`);
        if (f.help !== undefined && !textOK(f.help, 400)) fail(`${f.id}: help is too long.`);
        if (f.placeholder !== undefined && !textOK(f.placeholder, 250)) fail(`${f.id}: placeholder is too long.`);
        if (f.required !== undefined && typeof f.required !== 'boolean') fail(`${f.id}: required must be boolean.`);
        if (['counter', 'number', 'rating'].includes(f.type)) {
          if (![f.min, f.max, f.step].every(Number.isFinite) || f.max < f.min || f.step <= 0 || f.max > 100000 || f.min < -100000) fail(`${f.id}: provide valid min, max, and positive step.`);
          if (f.type === 'rating' && (f.max - f.min) / f.step > 10) fail(`${f.id}: rating has too many options.`);
        }
        if (f.type === 'text' && (!Number.isInteger(f.maxLength) || f.maxLength < 1 || f.maxLength > 2000 || (f.multiline !== undefined && typeof f.multiline !== 'boolean'))) fail(`${f.id}: text requires maxLength 1–2000 and optional boolean multiline.`);
        if (f.type === 'duration') {
          if (!Number.isInteger(f.precision) || f.precision < 0 || f.precision > 3 ||
            ![f.min,f.max].every(Number.isFinite) || f.min < 0 || f.max > 3600 || f.max < f.min ||
            numericError(f,f.min) || numericError(f,f.max)) fail(`${f.id}: duration needs bounds 0–3600 aligned to precision 0–3.`);
          if (Math.abs(f.min * 10 ** f.precision - Math.round(f.min * 10 ** f.precision)) > 0.000001) fail(`${f.id}: min must align to precision.`);
        }
        if (f.type === 'choice' || f.type === 'multiSelect') {
          if (!Array.isArray(f.options) || !f.options.length || f.options.length > 12) fail(`${f.id}: provide 1–12 options.`);
          const choices = new Set();
          for (const o of f.options) {
            keys(o,['value','label'],`${f.id} option`);
            if (!textOK(o.value, 60) || !o.value || !textOK(o.label, 80) || !o.label || choices.has(o.value)) fail(`${f.id}: options need unique string values and labels.`);
            if (f.type === 'multiSelect' && !idOK(o.value)) fail(`${f.id}: multi-select option values must be safe IDs.`);
            choices.add(o.value);
          }
          if (f.type === 'multiSelect' && (!Number.isInteger(f.minSelections) || !Number.isInteger(f.maxSelections) ||
            f.minSelections < 0 || f.maxSelections < Math.max(f.minSelections,f.required ? 1 : 0) || f.maxSelections > f.options.length)) fail(`${f.id}: invalid selection bounds.`);
          if (f.type === 'choice') {
            if (f.layout !== undefined && !['buttons','grid'].includes(f.layout)) fail(`${f.id}: layout must be buttons or grid.`);
            if (f.columns !== undefined && (f.layout !== 'grid' || !Number.isInteger(f.columns) || f.columns < 1 || f.columns > 4)) fail(`${f.id}: grid columns must be 1–4.`);
            if (f.layout === 'grid' && f.columns === undefined) fail(`${f.id}: grid layout requires columns.`);
            if (f.allowEmpty !== undefined && typeof f.allowEmpty !== 'boolean') fail(`${f.id}: allowEmpty must be boolean.`);
            if (f.emptyLabel !== undefined && (!f.allowEmpty || !textOK(f.emptyLabel,80) || !f.emptyLabel)) fail(`${f.id}: emptyLabel requires allowEmpty and a nonempty label.`);
          }
        }
        if (f.type === 'counterGrid') {
          const dimension = (items,max,label) => {
            if (!Array.isArray(items) || !items.length || items.length > max) fail(`${f.id}: ${label} require 1–${max} items.`);
            const seen = new Set();
            for (const item of items) {
              keys(item,['id','label'],`${f.id} ${label}`);
              if (!idOK(item.id) || seen.has(item.id) || !textOK(item.label,80) || !item.label) fail(`${f.id}: invalid or duplicate ${label} ID/label.`);
              seen.add(item.id);
            }
          };
          dimension(f.rows,6,'rows'); dimension(f.columns,4,'columns');
          if (!Array.isArray(f.cells) || f.cells.length !== f.rows.length*f.columns.length) fail(`${f.id}: provide one cell for every row/column pair (maximum 24).`);
          const cells = new Set(), positions = new Set();
          for (const cell of f.cells) {
            keys(cell,['id','row','column','min','max','step'],`${f.id} cell`);
            const position = `${cell.row}/${cell.column}`;
            if (!idOK(cell.id) || cells.has(cell.id) || positions.has(position) || !f.rows.some(r => r.id === cell.row) || !f.columns.some(col => col.id === cell.column)) fail(`${f.id}: invalid or duplicate cell ID/position.`);
            if (![cell.min,cell.max,cell.step].every(Number.isInteger) || cell.min < 0 || cell.max > 100000 || cell.max < cell.min || cell.step <= 0 || numericError(cell,cell.max)) fail(`${f.id}: cell bounds must be aligned nonnegative integers with positive step.`);
            cells.add(cell.id); positions.add(position);
          }
        }
        const initial = {...f,required:false};
        if (f.type === 'multiSelect' && Array.isArray(f.default) && !f.default.length) initial.minSelections = 0;
        if (!own(f, 'default') || valueError(initial, f.default)) fail(`${f.id}: invalid or missing default.`);
      }
    }
    if (ids.size > 60) fail('maximum 60 fields.');
    if (!Array.isArray(c.metrics) || c.metrics.length > 12) fail('metrics must be an array with at most 12 items.');
    const mids = new Set();
    for (const m of c.metrics) {
      keys(m,['id','label','description','operation',...(m?.operation === 'sum' ? ['fields'] : ['field','values'])],'metric');
      if (!idOK(m.id) || mids.has(m.id) || !textOK(m.label, 80) || !m.label || !textOK(m.description, 400) || !m.description) fail('metrics need unique IDs, labels, and descriptions.');
      mids.add(m.id);
      if (m.operation === 'sum') {
        if (!Array.isArray(m.fields) || !m.fields.length || m.fields.some(id => !fields(c).some(f => f.id === id && numericTypes.includes(f.type)))) fail(`${m.id}: sums must reference numeric fields.`);
      } else if (m.operation === 'rate') {
        const f = fields(c).find(f => f.id === m.field);
        if (!f || ['multiSelect','counterGrid'].includes(f.type) || !Array.isArray(m.values) || !m.values.length || m.values.some(v => valueError({...f, required: false}, v))) fail(`${m.id}: rate values must be valid scalar values of its field (structured-answer metrics are unsupported).`);
      } else fail(`${m.id}: operation must be sum or rate.`);
    }
    return c;
  }
  // Canonical order makes a definition's identity independent of JSON key order.
  function canonical(x) {
    if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
    if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
    return JSON.stringify(x);
  }
  function key(c) { return canonical(snapshot(c)); }
  function snapshot(c) {
    return {
      schemaVersion: c.schemaVersion, gameId: c.gameId, name: c.name, season: c.season, version: c.version,
      sections: c.sections.map(s => ({id: s.id, label: s.label, fields: s.fields.map(f => {
        const result = {};
        for (const k of ['id','type','label','default','min','max','step','maxLength','multiline','required','options','minSelections','maxSelections','precision','rows','columns','cells','layout','allowEmpty','emptyLabel']) if (own(f, k)) result[k] = structuredClone(f[k]);
        if ((['multiSelect','duration','counterGrid'].includes(f.type) || f.layout === 'grid') && own(f,'help')) result.help = f.help;
        return result;
      })})), metrics: structuredClone(c.metrics)
    };
  }
  function defaults(c) { return Object.fromEntries(fields(c).map(f => [f.id, structuredClone(f.default)])); }
  function format(f,v) {
    if (f.type === 'multiSelect') return f.options.filter(o => v.includes(o.value)).map(o => o.label).join('; ') || 'None';
    if (f.type === 'counterGrid') return f.rows.flatMap(row => f.columns.map(col => {
      const cell = f.cells.find(cell => cell.row === row.id && cell.column === col.id);
      return `${row.label} / ${col.label}: ${v[cell.id]}`;
    })).join('; ');
    if (f.type === 'duration') return `${v.toFixed(f.precision)} s`;
    if (f.type === 'choice') return f.options.find(o => o.value === v)?.label ?? (v === '' ? f.emptyLabel || 'Not observed' : v);
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return v;
  }
  async function load() {
    const response = await fetch('config/game.json');
    if (!response.ok) throw new Error('Cannot load config/game.json. Prepare this device online first.');
    const c = validate(await response.json());
    api.active = c;
    return c;
  }
  const api = {validate, valueError, fields, defaults, snapshot, canonical, key, load, types, numericTypes, step, format, active: null};
  return api;
})();