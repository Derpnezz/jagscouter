window.FRC = window.FRC || {};
FRC.records = (() => {
  const legacyFields = [
    ['autoFuel','Auto fuel','counter',20], ['autoTower','Auto tower','toggle'],
    ['teleop1Fuel','Teleop phase 1 fuel','counter',50], ['teleop2Fuel','Teleop phase 2 fuel','counter',50],
    ['climbLevel','Climb level','choice'], ['defenseRating','Defense rating','rating',5],
    ['minorFouls','Minor fouls','counter',10], ['majorFouls','Major fouls','counter',5], ['notes','Notes','text']
  ].map(([id,label,type,max]) => {
    const f = {id,label,type,default: 0};
    if (['counter','rating'].includes(type)) Object.assign(f,{min:0,max,step:1});
    if (type === 'toggle') f.default = false;
    if (type === 'choice') Object.assign(f,{default:'none',options:['none','level1','level2','level3'].map(value => ({value,label:value}))});
    if (type === 'text') Object.assign(f,{default:'',maxLength:2000,multiline:true});
    return f;
  });
  const legacy = {schemaVersion:1,gameId:'rebuilt-2026-legacy',name:'REBUILT (legacy)',season:2026,version:'legacy',sections:[{id:'legacy',label:'Original form',fields:legacyFields}],metrics:[
    {id:'fuel',label:'Fuel per match',operation:'sum',fields:['autoFuel','teleop1Fuel','teleop2Fuel'],description:'Sum of the original auto, phase 1, and phase 2 fuel fields; not official score.'}
  ]};
  function validate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Match must be an object.');
    const r = structuredClone(raw);
    if (typeof r.id !== 'string' || !r.id || r.id.length > 100 || !Number.isFinite(r.timestamp) || r.timestamp < 0) throw new Error('Invalid match ID or timestamp.');
    for (const k of ['teamNumber','matchNumber']) if (!Number.isInteger(r[k]) || r[k] <= 0 || r[k] > 100000) throw new Error(`${k} must be a positive integer.`);
    if (!['red','blue'].includes(r.alliance) || typeof r.scouterName !== 'string' || r.scouterName.length > 100) throw new Error('Invalid alliance or scouter name.');
    if (r.recordVersion === undefined) {
      if (!legacyFields.some(f => Object.prototype.hasOwnProperty.call(r,f.id))) throw new Error('Not a recognized legacy match.');
      r.recordVersion = 1;
      r.definition = structuredClone(legacy);
      r.answers = Object.fromEntries(legacyFields.map(f => [f.id, r[f.id] ?? f.default]));
      r.gameId = legacy.gameId;
      r.formVersion = legacy.version;
    }
    if (r.recordVersion !== 1) throw new Error('Unsupported record version.');
    FRC.config.validate(r.definition);
    if (r.gameId !== r.definition.gameId || r.formVersion !== r.definition.version) throw new Error('Game identity does not match the saved form.');
    if (!r.answers || typeof r.answers !== 'object' || Array.isArray(r.answers)) throw new Error('Missing match answers.');
    const fields = FRC.config.fields(r.definition);
    if (Object.keys(r.answers).some(k => !fields.some(f => f.id === k))) throw new Error('Answers contain unrecognized fields.');
    for (const f of fields) {
      const problem = FRC.config.valueError(f, r.answers[f.id]);
      if (problem) throw new Error(`${f.label} ${problem}.`);
    }
    if (JSON.stringify(r).length > 150000) throw new Error('Match is too large.');
    return r;
  }
  function decode(text) {
    if (typeof text !== 'string' || text.length > 10000) throw new Error('QR payload is too large.');
    const json = LZString.decompressFromEncodedURIComponent(text);
    if (!json || json.length > 150000) throw new Error('Not a scouting QR code.');
    return validate(JSON.parse(json));
  }
  function encode(raw) {
    const text = LZString.compressToEncodedURIComponent(JSON.stringify(validate(raw)));
    if (text.length > 2900) throw new Error('This form is too large for one QR code. Use the CSV backup for transfer; all match data is saved.');
    return text;
  }
  function groups(rawRecords) {
    const result = new Map();
    for (const raw of rawRecords) {
      try {
        const record = validate(raw), key = FRC.config.key(record.definition);
        if (!result.has(key)) result.set(key,{key,definition:record.definition,records:[]});
        result.get(key).records.push(record);
      } catch (_) {
        if (!result.has('unrecognized')) result.set('unrecognized',{key:'unrecognized',definition:null,records:[]});
        result.get('unrecognized').records.push(raw);
      }
    }
    return [...result.values()];
  }
  return {validate, decode, encode, groups, legacy};
})();