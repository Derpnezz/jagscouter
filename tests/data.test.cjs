const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const QR = require('qrcode');
const root = path.join(__dirname,'..');
function runtime() {
  const data = new Map();
  const context = {structuredClone,console,localStorage:{
    getItem:key => data.get(key) ?? null,
    setItem:(key,value) => data.set(key,value),
    removeItem:key => data.delete(key)
  }};
  context.window = context;
  vm.createContext(context);
  for (const file of ['js/lib/lz-string.min.js','js/ui.js','js/config.js','js/records.js','js/storage.js','js/analytics.js','js/csv.js','js/blocks.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  return {FRC:context.FRC,context,data};
}
const config = JSON.parse(fs.readFileSync(path.join(root,'config/game.json'),'utf8'));
function record(FRC,c=config) {
  return {recordVersion:1,id:'test-match',timestamp:1770000000000,gameId:c.gameId,formVersion:c.version,definition:FRC.config.snapshot(c),teamNumber:254,matchNumber:7,alliance:'blue',scouterName:'Test scout',answers:FRC.config.defaults(c)};
}
const equal = (a,b) => assert.equal(JSON.stringify(a),JSON.stringify(b));
const example = name => JSON.parse(fs.readFileSync(path.join(root,`config/examples/${name}.json`),'utf8'));
test('active REBUILT definition identity is unchanged by the expanded library',() => {
  const {FRC} = runtime();
  assert.equal(createHash('sha256').update(FRC.config.key(config)).digest('hex'),'67e328f140093e313c4a59496d1923663cd421fd90c905be1fe29055c5ff708f');
});
test('extended definitions strictly validate bounds, IDs, positions, defaults and unknown keys',() => {
  const {FRC} = runtime();
  for (const mutate of [
    c => c.unrecognized = true,
    c => c.sections[0].unknown = true,
    c => c.sections[0].fields[0].layout = 'map',
    c => c.sections[0].fields[0].columns = 5,
    c => c.sections[0].fields[0].allowEmpty = 'yes',
    c => c.sections[0].fields[0].options[0].unknown = true,
    c => c.sections[0].fields[0].options[1].value = 'left',
    c => c.sections[1].fields[1].options[1].value = 'floor',
    c => c.sections[1].fields[1].options[0].value = '__proto__',
    c => c.sections[1].fields[1].maxSelections = 3,
    c => c.sections[1].fields[1].minSelections = -1,
    c => c.sections[1].fields[1].default = ['floor','floor'],
    c => c.sections[1].fields[0].default.highCone = Infinity,
    c => delete c.sections[1].fields[0].default.highCone,
    c => c.sections[1].fields[0].default.extra = 0,
    c => c.sections[1].fields[0].cells[1].id = 'highCone',
    c => c.sections[1].fields[0].cells[1].column = 'cone',
    c => c.sections[1].fields[0].cells[0].row = 'missing',
    c => c.sections[1].fields[0].cells[0].unknown = true,
    c => c.sections[1].fields[0].cells[0].step = 0,
    c => c.sections[1].fields[0].cells[0].max = 1.5,
    c => c.sections[1].fields[0].rows[1].id = 'high',
    c => c.sections[1].fields[0].rows[0].unknown = true,
    c => c.sections[1].fields[0].rows = Array.from({length:7},(_,i) => ({id:`row${i}`,label:'Row'})),
    c => c.sections[2].fields[0].precision = 4,
    c => c.sections[2].fields[0].default = 0.01,
    c => c.sections[2].fields[0].max = 3601,
    c => c.sections[2].fields[0].min = 0.01,
    c => c.sections[2].fields[0].max = 1.01,
    c => c.sections[2].fields[0].step = 0.1,
    c => c.metrics[0].fields = ['pieces'],
    c => Object.assign(c.metrics[1],{field:'pickup',values:[['floor']]}),
    c => Object.assign(c.metrics[1],{field:'pieces',values:[c.sections[1].fields[0].default]})
  ]) {
    const c = example('charged-up-2023'); mutate(c);
    assert.throws(() => FRC.config.validate(c),/Game definition:/);
  }
});
test('new snapshots and defaults are deep copies and retain all interpretation metadata',() => {
  const {FRC} = runtime(), c = example('charged-up-2023');
  const one = FRC.config.defaults(c), two = FRC.config.defaults(c);
  one.pickup.push('floor'); one.pieces.highCone = 7;
  assert.equal(two.pickup.length,0); assert.equal(two.pieces.highCone,0);
  assert.equal(c.sections[1].fields[0].default.highCone,0);
  const snapshot = FRC.config.snapshot(c);
  snapshot.sections[1].fields[0].rows[0].label = 'Changed';
  snapshot.sections[1].fields[0].cells[0].max = 1;
  snapshot.sections[0].fields[0].options[0].label = 'Elsewhere';
  snapshot.metrics[0].fields.push('unknown');
  assert.equal(c.sections[1].fields[0].rows[0].label,'High');
  assert.equal(c.sections[1].fields[0].cells[0].max,99);
  assert.equal(c.sections[0].fields[0].options[0].label,'Left');
  assert.equal(c.metrics[0].fields.length,1);
  const oldKey = FRC.config.key(c), changed = structuredClone(c);
  changed.sections[1].fields[0].cells[0].max = 98;
  assert.notEqual(FRC.config.key(changed),oldKey);
  const start = FRC.config.snapshot(c).sections[0].fields[0];
  assert.equal(start.layout,'grid'); assert.equal(start.columns,3); assert.equal(start.allowEmpty,true);
});
test('new typed answers transfer through QR, CSV, backups and separate-definition draft recovery',() => {
  const {FRC} = runtime(), c = example('charged-up-2023'), r = record(FRC,c);
  r.answers.pickup = ['floor','substation']; r.answers.pieces.highCone = 3; r.answers.pieces.midCube = 2;
  r.answers.balanceSeconds = 12.3; r.answers.notes = 'Comma, "quote"\nUnicode →';
  equal(FRC.records.decode(FRC.records.encode(r)),r);
  const csv = FRC.csv.exportRecords([r]);
  assert.match(csv,/Floor; Substation/);
  assert.match(csv,/High \/ Cone: 3/);
  const rows = FRC.csv.parse(csv), header = rows[0];
  assert.equal(rows[1][header.indexOf('answer:pieces.highCone')],'3');
  assert.equal(rows[1][header.indexOf('answer:balanceSeconds')],'12.3');
  equal(FRC.csv.importRecords(csv),[r]);
  FRC.storage.saveMatch(r);
  equal(JSON.parse(FRC.storage.recoveryBackup()).matches,JSON.stringify([r]));
  const draft = {teamNumber:254,answers:structuredClone(r.answers)};
  FRC.storage.saveDraft(c,draft);
  const changed = structuredClone(c); changed.sections[1].fields[0].rows[0].label = 'New meaning';
  assert.equal(FRC.storage.getDraft(changed),null);
  assert.equal(FRC.storage.otherDrafts(changed).length,1);
  equal(FRC.storage.getDraft(c),draft);
  for (const mutate of [
    r => r.answers.pickup = ['unknown'],
    r => r.answers.pickup = ['floor','floor'],
    r => r.answers.pickup = 'floor',
    r => r.answers.pieces.highCone = NaN,
    r => r.answers.pieces.highCone = 0.5,
    r => r.answers.pieces.extra = 1,
    r => delete r.answers.pieces.highCone,
    r => r.answers.balanceSeconds = '12.3'
  ]) {const bad = structuredClone(r); mutate(bad); assert.throws(() => FRC.records.validate(bad));}
});
test('selection bounds and optional grid choices distinguish initial blanks from required observations',() => {
  const {FRC} = runtime(), c = example('charged-up-2023'), choice = c.sections[0].fields[0], multi = c.sections[1].fields[1];
  choice.required = true; multi.minSelections = 1;
  FRC.config.validate(c);
  assert.ok(FRC.config.valueError(choice,''));
  assert.equal(FRC.config.valueError({...choice,required:false},''),'');
  assert.ok(FRC.config.valueError(multi,[]));
  assert.equal(FRC.config.valueError(multi,['floor']),'');
  assert.equal(FRC.config.format({...choice,required:false},''),'Not observed');
});
test('CSV cell projections stay blank when another form reuses the field ID with a scalar type',() => {
  const {FRC} = runtime(), c = example('charged-up-2023');
  const grid = c.sections[1].fields[0];
  grid.cells[0].id = 'length'; delete grid.default.highCone; grid.default.length = 0;
  const scalar = structuredClone(c);
  scalar.sections[1].fields[0] = {id:'pieces',type:'text',label:'Pieces notes',maxLength:100,default:''};
  const first = record(FRC,c), second = record(FRC,scalar); second.id = 'second';
  second.answers.pieces = 'ABC';
  const csv = FRC.csv.exportRecords([first,second]), rows = FRC.csv.parse(csv);
  const index = rows[0].indexOf('answer:pieces.length');
  assert.equal(rows[1][index],'0');
  assert.equal(rows[2][index],'');
  equal(FRC.csv.importRecords(csv),[first,second]);
});
test('duration clock pauses/restores, corrects manually, resets, rounds and stops at maximum',() => {
  const {FRC} = runtime(), f = {id:'time',label:'Time',type:'duration',min:0,max:10,precision:1,default:0};
  let clock = 0; const values = [];
  const timer = FRC.blocks.createDuration(f,0,v => values.push(v),() => clock);
  timer.start(); clock = 1278;
  assert.equal(timer.tick(),1.2);
  clock = 1599; assert.equal(timer.pause(),1.5);
  clock = 9000; assert.equal(timer.value(),1.5);
  const reopened = FRC.blocks.createDuration(f,timer.value(),() => {},() => clock);
  assert.equal(reopened.running,false); assert.equal(reopened.value(),1.5);
  timer.set(3.2); timer.start(); clock = 9999;
  assert.equal(timer.tick(),4.1);
  clock = 25000; assert.equal(timer.tick(),10); assert.equal(timer.running,false);
  timer.reset(); assert.equal(timer.value(),0); assert.equal(values.at(-1),0);
  timer.set(null); assert.throws(() => timer.start(),/valid seconds/);
});
test('readable structured presentation and duration analytics do not change existing scalar semantics',() => {
  const {FRC} = runtime(), c = example('charged-up-2023'), r = record(FRC,c);
  r.answers.balanceSeconds = 12.3; r.answers.pickup = ['substation','floor'];
  assert.equal(FRC.config.format(c.sections[1].fields[1],r.answers.pickup),'Floor; Substation');
  assert.equal(FRC.config.format(c.sections[2].fields[0],12.3),'12.3 s');
  assert.equal(FRC.analytics.teamStats([r],c)[0].metrics.balanceTime,12.3);
  assert.equal(FRC.analytics.teamStats([r],c)[0].metrics.balanced,0);
});
test('oversize new-form QR fails without truncation while saved data and CSV remain lossless',() => {
  const {FRC} = runtime(), c = example('charged-up-2023');
  c.sections[2].fields.at(-1).maxLength = 2000;
  const r = record(FRC,c);
  r.answers.notes = Array.from({length:2000},(_,i) => String.fromCodePoint(0x1000+i)).join('');
  FRC.storage.saveMatch(r);
  assert.throws(() => FRC.records.encode(r),/too large.*CSV backup/);
  equal(FRC.storage.getMatches(),[r]);
  equal(FRC.csv.importRecords(FRC.csv.exportRecords([r])),[r]);
});
test('JagScouter branding stays consistent across headers, metadata and the offline manifest',() => {
  const {FRC,context} = runtime();
  context.location = {hash:'#/scouter'};
  const header = FRC.ui.header('Scout match','REBUILT 2026');
  assert.match(header,/JagScouter/);
  assert.match(header,/JagBots4638/);
  assert.match(header,/href="#\/scouter" aria-current="page"/);
  assert.match(header,/src="icon.svg"/);
  assert.match(header,/<h1>Scout match<\/h1>/);
  assert.doesNotMatch(FRC.ui.header('Home'),/<h1>/);
  assert.match(FRC.ui.header('<unsafe>'),/&lt;unsafe&gt;/);
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.short_name,'JagScouter');
  assert.equal(manifest.theme_color,'#090909');
  assert.equal(manifest.start_url,'./');
  assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/<title>JagScouter \| JagBots4638<\/title>/);
  assert.match(fs.readFileSync(path.join(root,'icon.svg'),'utf8'),/fill="#ff8500"/);
});
test('all source definitions validate and compose every reusable block',() => {
  const {FRC} = runtime();
  const definitions = [config,...fs.readdirSync(path.join(root,'config/examples')).map(f => JSON.parse(fs.readFileSync(path.join(root,'config/examples',f),'utf8')))];
  const used = new Set();
  for (const c of definitions) {
    FRC.config.validate(c);
    FRC.config.validate(FRC.config.snapshot(c));
    for (const f of FRC.config.fields(c)) {
      used.add(f.type);
      assert.match(FRC.blocks.render(f,f.default),new RegExp(f.id));
    }
  }
  equal([...used].sort(),FRC.config.types.slice().sort());
});
test('bad configuration types, duplicate IDs, metric references, and defaults fail explicitly',() => {
  const {FRC} = runtime();
  for (const mutate of [
    c => c.schemaVersion = 2,
    c => c.sections[0].fields[0].type = 'unknown',
    c => c.sections[1].fields[0].id = 'autoFuel',
    c => c.sections[0].fields[0].default = -1,
    c => c.sections[0].fields[0].step = 0,
    c => c.metrics[0].fields = ['notes'],
    c => c.metrics[2].values = ['impossible'],
    c => c.sections[0].id = 'setup'
  ]) { const c = structuredClone(config); mutate(c); assert.throws(() => FRC.config.validate(c),/Game definition:/); }
});
test('required notes allow a blank initial form but fail submission',() => {
  const {FRC} = runtime(), c = structuredClone(config);
  const f = c.sections.at(-1).fields.at(-1); f.required = true;
  FRC.config.validate(c);
  assert.ok(FRC.config.valueError(f,''));
  assert.equal(FRC.config.valueError(f,'Observed issue'),'');
});
test('numeric constraints, typed answers, identity, and QR validation',() => {
  const {FRC,context} = runtime(), r = record(FRC);
  r.answers.notes = 'A comma, a "quote"\nand Unicode → 🤖';
  r.answers.autoTower = true;
  r.answers.autoFuel = 24;
  equal(FRC.records.validate(r),r);
  const code = context.LZString.compressToEncodedURIComponent(JSON.stringify(r));
  equal(FRC.records.decode(code),r);
  const qr = QR.create(code,{errorCorrectionLevel:'L'});
  assert.ok(qr.version <= 40);
  console.log(`Active form QR: ${code.length} characters, version ${qr.version}`);
  for (const mutate of [
    r => r.answers.autoFuel = -1,
    r => r.answers.autoFuel = 0.5,
    r => r.answers.autoFuel = '5',
    r => r.answers.climbLevel = 'impossible',
    r => r.answers.autoTower = 'true',
    r => r.answers.notes = 'x'.repeat(401),
    r => r.formVersion = 'different',
    r => r.recordVersion = 2
  ]) { const invalid = structuredClone(r); mutate(invalid); assert.throws(() => FRC.records.validate(invalid)); }
  assert.throws(() => FRC.records.decode('not scouting data'));
});
test('CSV round-trip preserves commas, quotes, newlines, Unicode and typed data',() => {
  const {FRC} = runtime(), r = record(FRC);
  r.answers.notes = 'Defense, "excellent"\r\n🤖 very reliable';
  r.scouterName = '=1+1';
  equal(FRC.csv.importRecords(FRC.csv.exportRecords([r]))[0],r);
  assert.throws(() => FRC.csv.importRecords('"a","b"\r\n"unclosed'),/unclosed/);
  assert.throws(() => FRC.csv.importRecords('recordJson,recordJson\n{},{}'),/duplicate columns/);
});
test('legacy records and legacy CSV retain original fields without mixing forms',() => {
  const {FRC,data} = runtime();
  const old = {id:'old',timestamp:1700000000000,teamNumber:111,matchNumber:1,alliance:'red',scouterName:'Old',autoFuel:3,autoTower:true,teleop1Fuel:4,teleop2Fuel:5,climbLevel:'level2',defenseRating:2,minorFouls:1,majorFouls:0,notes:'original'};
  const original = JSON.stringify([old]);
  data.set('frc_scouting_matches',original);
  const groups = FRC.records.groups(FRC.storage.getMatches());
  assert.equal(groups[0].records[0].answers.teleop2Fuel,5);
  assert.equal(data.get('frc_scouting_matches'),original);
  const header = Object.keys(old);
  const csv = header.join(',')+'\n'+header.map(k => old[k]).join(',');
  assert.equal(FRC.csv.importRecords(csv)[0].answers.autoTower,true);
  const r = record(FRC);
  assert.equal(FRC.records.groups([old,r]).length,2);
  assert.throws(() => FRC.analytics.teamStats([FRC.records.validate(old),r],config),/Cannot mix/);
});
test('same version with changed fields separates records and preserves drafts',() => {
  const {FRC} = runtime(), changed = structuredClone(config);
  changed.sections[0].fields[0].label = 'Different meaning';
  assert.notEqual(FRC.config.key(config),FRC.config.key(changed));
  FRC.storage.saveDraft(config,{answers:{autoFuel:42}});
  assert.equal(FRC.storage.getDraft(changed),null);
  assert.equal(FRC.storage.otherDrafts(changed)[0].state.answers.autoFuel,42);
  assert.equal(FRC.storage.getDraft(config).answers.autoFuel,42);
  assert.equal(FRC.records.groups([record(FRC),{...record(FRC,changed),id:'changed'}]).length,2);
  const reordered = Object.fromEntries(Object.entries(config).reverse());
  assert.equal(FRC.config.key(config),FRC.config.key(reordered));
});
test('storage errors are not mistaken for duplicates, and failed batch imports are atomic',() => {
  const {FRC,context,data} = runtime(), r = record(FRC);
  assert.equal(FRC.storage.saveMatch(r),true);
  assert.equal(FRC.storage.saveMatch(r),false);
  const before = data.get('frc_scouting_matches');
  const invalid = {...record(FRC),id:'invalid',matchNumber:-1};
  assert.throws(() => FRC.storage.saveBatch([{...r,id:'valid'},invalid]));
  assert.equal(data.get('frc_scouting_matches'),before);
  context.localStorage.setItem = () => {throw new Error('Quota exceeded');};
  assert.throws(() => FRC.storage.saveMatch({...r,id:'new'}),/Nothing was saved/);
  assert.throws(() => FRC.storage.saveDraft(config,{}),/Nothing was saved/);
  data.set('frc_scouting_matches','malformed');
  assert.throws(() => FRC.storage.getMatches(),/unreadable/);
  assert.equal(JSON.parse(FRC.storage.recoveryBackup()).matches,'malformed');
});
test('configured sum and rate metrics have the documented meaning',() => {
  const {FRC} = runtime(), a = record(FRC), b = record(FRC);
  b.id = 'second';
  a.answers.autoFuel = 10; a.answers.teleopFuel = 30; a.answers.climbLevel = 'level2';
  b.answers.autoFuel = 20; b.answers.teleopFuel = 40;
  const stats = FRC.analytics.teamStats([a,b],config)[0];
  assert.equal(stats.metrics.fuel,50);
  assert.equal(stats.metrics.auto,15);
  assert.equal(stats.metrics.climb,50);
});
test('unrecognized saved entries stay preserved while new valid matches are collected',() => {
  const {FRC,data} = runtime();
  data.set('frc_scouting_matches',JSON.stringify([null,42,{unknown:'kept'}]));
  assert.equal(FRC.storage.saveMatch(record(FRC)),true);
  const groups = FRC.records.groups(FRC.storage.getMatches());
  assert.equal(groups.find(g => g.key === 'unrecognized').records.length,3);
  FRC.storage.deleteMatch('test-match');
  equal(FRC.storage.getMatches(),[null,42,{unknown:'kept'}]);
});