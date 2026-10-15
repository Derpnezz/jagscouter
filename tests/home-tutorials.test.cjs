const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const source = name => fs.readFileSync(path.join(root,name),'utf8');
function renderHome() {
  const matches = '[{"id":"existing"}]', drafts = '[{"state":{"answers":{"autoFuel":7}}}]';
  const stored = new Map([['matches',matches],['drafts',drafts]]);
  let offlineRenders = 0;
  const context = {console,location:{hash:'#/'},
    fetch:() => assert.fail('Tutorials must not request network content'),
    localStorage:{
      getItem:key => stored.get(key),
      setItem:() => assert.fail('Tutorials must not write device data'),
      removeItem:() => assert.fail('Tutorials must not delete device data')
    }};
  context.window = context; vm.createContext(context);
  vm.runInContext(source('js/ui.js'),context);
  context.FRC.config = {active:{name:'REBUILT',season:2026,version:'1'}};
  context.FRC.storage = {getMatches:() => JSON.parse(stored.get('matches'))};
  context.FRC.offline = {render:() => offlineRenders++};
  vm.runInContext(source('js/pages/home.js'),context);
  const page = {innerHTML:''};
  context.FRC.pages.home.render(page);
  return {html:page.innerHTML,stored,matches,drafts,offlineRenders};
}
test('homepage tutorials use native disclosure sections with complete numbered instructions',() => {
  const {html} = renderHome();
  const guides = [...html.matchAll(/<details class="home-prep home-tutorial" id="([^"]+)">([\s\S]*?)<\/details>/g)];
  assert.equal(guides.length,2);
  assert.deepEqual(guides.map(g => g[1]),['scouter-tutorial','data-tutorial']);
  for (const [,id,body] of guides) {
    assert.match(body,/<summary>How to use /,id);
    assert.match(body,/<ol>[\s\S]*<\/ol>/,id);
    assert.equal((body.match(/<li>/g) || []).length,6,id);
    assert.doesNotMatch(body,/<summary[^>]*(?:tabindex="-1"|role=)|aria-hidden|<iframe|<video|<script/);
  }
  assert.match(html,/aria-labelledby="tutorial-heading"/);
  assert.match(html,/id="tutorial-heading"/);
  assert.doesNotMatch(html,/<details[^>]*\bopen(?:\s|>)/);
});
test('Scouter guide covers actual controls, drafts, conditional blocks and manual handoff',() => {
  const {html} = renderHome();
  const guide = html.match(/id="scouter-tutorial">([\s\S]*?)<\/details>/)[1];
  for (const text of ['Setup','team number','match number','alliance','section tabs freely',
    'Draft saved on this device','Draft not saved','Save match &amp; show QR',
    'Download CSV backup','Import CSV','Back to form','Next match',
    "If included in your season's form",'multiple selections','grid counters',
    'Start','Pause','Reset','editable seconds','Recovered draft timers are paused',
    "does not update a manager's previous copy"]) assert.ok(guide.includes(text),text);
});
test('Data guide covers collection, correct form selection, review, Insights and backups',() => {
  const {html} = renderHome();
  const guide = html.match(/id="data-tutorial">([\s\S]*?)<\/details>/)[1];
  for (const text of ['Manager','Data','Collect','camera access','Paste a QR transfer code',
    'Collect match','Import CSV','Matches','duplicates','not overwritten',
    'Game &amp; form version','Different form definitions stay separate','Find a team',
    'column headings to sort','Details','Insights','Team view','What these metrics mean',
    'Export this form','Backup all records','Recovery backup','Delete all'])
    assert.ok(guide.includes(text),text);
  assert.match(html,/stored only on this device, not automatically shared or synced/);
  assert.match(html,/before deleting data/);
  assert.match(html,/observations are not official scores/);
});
test('tutorial rendering retains navigation, readiness, saved count and byte-identical stored data offline',() => {
  const {html,stored,matches,drafts,offlineRenders} = renderHome();
  assert.match(html,/href="#\/scouter"[^>]*data-testid="link-scouter"/);
  assert.match(html,/href="#\/manager"[^>]*data-testid="link-manager"/);
  assert.match(html,/id="offline-status"/);
  assert.match(html,/Get ready for the venue/);
  assert.match(html,/data-testid="text-saved-count">1 match saved on this device/);
  assert.equal(offlineRenders,1);
  assert.equal(stored.get('matches'),matches);
  assert.equal(stored.get('drafts'),drafts);
  assert.doesNotMatch(html,/(?:href|src)="https?:/);
  const worker = source('sw.js');
  assert.match(worker,/'js\/pages\/home.js'/);
  assert.match(worker,/'css\/style.css'/);
  const css = source('css/style.css');
  assert.match(css,/:focus-visible\{outline:2px solid var\(--accent\)/);
});