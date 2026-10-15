const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
function setup() {
  let clock = 0, next = 0, confirmed = true;
  const intervals = new Map(), notices = [];
  const context = {structuredClone,console,performance:{now:() => clock},
    setInterval:fn => {const id = ++next; intervals.set(id,fn); return id;},
    clearInterval:id => intervals.delete(id),confirm:() => confirmed};
  context.window = context; vm.createContext(context);
  for (const name of ['ui','config','blocks']) vm.runInContext(fs.readFileSync(path.join(root,`js/${name}.js`),'utf8'),context);
  context.FRC.ui.report = error => notices.push(error.message);
  const c = JSON.parse(fs.readFileSync(path.join(root,'config/examples/charged-up-2023.json'),'utf8'));
  const answers = context.FRC.config.defaults(c), nodes = [];
  const html = context.FRC.config.fields(c).map(f => context.FRC.blocks.render(f,answers[f.id])).join('');
  for (const [opening] of html.matchAll(/<(?:button|input|span)\b[^>]*>/g)) {
    const attrs = Object.fromEntries([...opening.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1],m[2]]));
    const dataset = Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-')).map(([key,v]) => [key.slice(5).replace(/-(.)/g,(_,letter) => letter.toUpperCase()),v]));
    const classes = new Set((attrs.class || '').split(' '));
    const node = {attrs,dataset,value:attrs.value || '',disabled:opening.includes(' disabled'),textContent:'',
      classList:{toggle:(key,on) => on ? classes.add(key) : classes.delete(key)},
      setAttribute:(key,v) => attrs[key] = v,focus:() => page.focused = node};
    nodes.push(node);
  }
  const page = {
    querySelectorAll(selector) {
      const conditions = [...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
      return nodes.filter(node => {
        if (selector.startsWith('#')) return node.attrs.id === selector.slice(1);
        if (selector.startsWith('.choice-grid') && node.dataset.value === '') return false;
        return conditions.every(([,key,v]) => key in node.attrs && (v === undefined || node.attrs[key] === v));
      });
    },
    querySelector(selector) {return this.querySelectorAll(selector)[0] || null;}
  };
  let saves = 0;
  const controls = context.FRC.blocks.bind(page,c,answers,() => saves++);
  return {context,c,answers,page,controls,intervals,notices,
    saves:() => saves,confirm:value => confirmed = value,
    tick(milliseconds) {clock += milliseconds; for (const fn of [...intervals.values()]) fn();}};
}
test('multi-select controls toggle typed IDs and honor maximum selection without trapping deselection',() => {
  const b = setup(), [floor,substation] = b.page.querySelectorAll('[data-multi="pickup"]');
  b.c.sections[1].fields[1].maxSelections = 1;
  floor.onclick();
  assert.equal(JSON.stringify(b.answers.pickup),'["floor"]');
  assert.equal(floor.attrs['aria-pressed'],true);
  assert.equal(substation.disabled,true);
  substation.onclick();
  assert.equal(JSON.stringify(b.answers.pickup),'["floor"]');
  floor.onclick();
  assert.equal(b.answers.pickup.length,0);
  assert.equal(substation.disabled,false);
  assert.equal(b.saves(),2);
});
test('counter cells update independent values, clamp counts, and preserve invalid direct values for validation',() => {
  const b = setup(), plus = b.page.querySelector('[data-grid-count="pieces"][data-cell="highCone"][data-dir="1"]');
  plus.onclick();
  assert.equal(b.answers.pieces.highCone,1);
  assert.equal(b.answers.pieces.highCube,0);
  const input = b.page.querySelector('[data-grid="pieces"][data-cell="highCone"]');
  input.value = '99'; input.oninput(); plus.onclick();
  assert.equal(b.answers.pieces.highCone,99);
  input.value = ''; input.oninput();
  assert.equal(b.answers.pieces.highCone,null);
  assert.ok(b.context.FRC.config.valueError(b.c.sections[1].fields[0],b.answers.pieces));
});
test('duration binding has one interval, preserves seconds across tabs, confirms reset and pauses before saving/navigation',() => {
  const b = setup(), start = b.page.querySelector('[data-duration="balanceSeconds"][data-action="start"]');
  const reset = b.page.querySelector('[data-duration="balanceSeconds"][data-action="reset"]');
  start.onclick(); assert.equal(b.intervals.size,1);
  b.tick(1278);
  assert.equal(b.answers.balanceSeconds,1.2);
  // Section tabs hide panels without rebinding; elapsed clock time stays correct.
  b.tick(1022); assert.equal(b.answers.balanceSeconds,2.3);
  start.onclick(); assert.equal(b.intervals.size,0);
  b.confirm(false); reset.onclick(); assert.equal(b.answers.balanceSeconds,2.3);
  b.confirm(true); reset.onclick(); assert.equal(b.answers.balanceSeconds,0);
  const input = b.page.querySelector('#field-balanceSeconds');
  input.value = '4.5'; input.oninput(); assert.equal(b.answers.balanceSeconds,4.5);
  start.onclick(); b.tick(300); assert.equal(b.answers.balanceSeconds,4.8);
  b.controls.pause(); assert.equal(b.intervals.size,0);
  b.tick(10000); assert.equal(b.answers.balanceSeconds,4.8);
  start.onclick(); assert.equal(b.intervals.size,1);
  b.controls.destroy(); assert.equal(b.intervals.size,0);
  input.value = ''; input.oninput(); start.onclick();
  assert.equal(b.intervals.size,0); assert.match(b.notices.at(-1),/valid seconds/);
});
test('grid choice arrow keys move focus without shifting positions for the separate empty action',() => {
  const b = setup(), choices = b.page.querySelectorAll('.choice-grid [data-choice="start"]');
  assert.equal(choices.length,3);
  choices[0].onkeydown({key:'ArrowRight',preventDefault() {}});
  assert.equal(b.page.focused,choices[1]);
  choices[1].onkeydown({key:'End',preventDefault() {}});
  assert.equal(b.page.focused,choices[2]);
  assert.equal(b.answers.start,'');
});
test('hyphenated field/cell combinations cannot collide with another cell or ordinary field DOM IDs',() => {
  const b = setup(), f = structuredClone(b.c.sections[1].fields[0]);
  f.id = 'a-b'; f.cells[0].id = 'c';
  const other = structuredClone(f); other.id = 'a'; other.cells[0].id = 'b-c';
  const first = b.context.FRC.blocks.render(f,f.default), second = b.context.FRC.blocks.render(other,other.default);
  const ids = [...(first+second).matchAll(/<input[^>]*\sid="([^"]*)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.every(id => !id.startsWith('field-')));
});