window.FRC = window.FRC || {};
FRC.csv = (() => {
  function parse(text) {
    const rows = [], row = [];
    let value = '', quoted = false, closed = false;
    text = text.replace(/^\uFEFF/,'');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i+1] === '"') { value += '"'; i++; }
        else if (c === '"') { quoted = false; closed = true; }
        else value += c;
      } else if (c === '"' && value === '' && !closed) quoted = true;
      else if (c === ',' || c === '\n' || c === '\r') {
        row.push(value); value = ''; closed = false;
        if (c !== ',') { if (row.some(x => x !== '')) rows.push(row.slice()); row.length = 0; if (c === '\r' && text[i+1] === '\n') i++; }
      } else {
        if (closed || c === '"') throw new Error('Malformed CSV quoting.');
        value += c;
      }
    }
    if (quoted) throw new Error('CSV contains an unclosed quoted value.');
    row.push(value);
    if (row.some(x => x !== '')) rows.push(row);
    return rows;
  }
  const quote = x => '"' + String(x ?? '').replace(/"/g,'""') + '"';
  const base = ['id','timestamp','teamNumber','matchNumber','alliance','scouterName'];
  function exportRecords(records) {
    const normalized = records.map(FRC.records.validate);
    const fieldIds = [...new Set(normalized.flatMap(r => Object.keys(r.answers)))];
    const cells = new Map();
    for (const r of normalized) for (const f of FRC.config.fields(r.definition).filter(f => f.type === 'counterGrid')) {
      for (const cell of f.cells) cells.set(`${f.id}.${cell.id}`,{field:f.id,cell:cell.id});
    }
    const header = [...base,'gameId','formVersion',...fieldIds.map(id => `answer:${id}`),...[...cells.keys()].map(id => `answer:${id}`),'recordJson'];
    const lines = normalized.map(r => [
      ...base.map(k => r[k]),r.gameId,r.formVersion,
      ...fieldIds.map(id => {
        const f = FRC.config.fields(r.definition).find(f => f.id === id), value = r.answers[id];
        return f && ['multiSelect','counterGrid'].includes(f.type) ? FRC.config.format(f,value) : value ?? '';
      }),
      ...[...cells.values()].map(({field,cell}) => {
        const f = FRC.config.fields(r.definition).find(f => f.id === field && f.type === 'counterGrid');
        return f?.cells.some(c => c.id === cell) ? r.answers[field][cell] : '';
      }), JSON.stringify(r)
    ].map(quote).join(','));
    return [header.map(quote).join(','),...lines].join('\r\n');
  }
  function importRecords(text) {
    const rows = parse(text);
    if (rows.length < 2) throw new Error('CSV has no match rows.');
    const header = rows.shift();
    if (new Set(header).size !== header.length) throw new Error('CSV has duplicate columns.');
    const index = header.indexOf('recordJson');
    return rows.map((row,i) => {
      try {
        if (row.length !== header.length) throw new Error('column count does not match header');
        if (index >= 0) return FRC.records.validate(JSON.parse(row[index]));
        const r = Object.fromEntries(header.map((k,n) => [k,row[n]]));
        for (const k of ['timestamp','teamNumber','matchNumber','autoFuel','teleop1Fuel','teleop2Fuel','defenseRating','minorFouls','majorFouls']) if (k in r) r[k] = Number(r[k]);
        if ('autoTower' in r) {
          if (!['true','false'].includes(r.autoTower)) throw new Error('invalid autoTower boolean');
          r.autoTower = r.autoTower === 'true';
        }
        return FRC.records.validate(r);
      } catch(e) { throw new Error(`CSV row ${i+2}: ${e.message}`); }
    });
  }
  return {parse,exportRecords,importRecords};
})();