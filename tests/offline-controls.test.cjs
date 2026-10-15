const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const source = file => fs.readFileSync(path.join(root,file),'utf8');
function browser({unsupported = false, online = true} = {}) {
  let panel = null, reply = {ready:true,update:false}, confirmed = false, reloads = 0;
  let messageHandler = async () => reply, workerUpdate = async () => {};
  const messages = [], events = {}, updates = [];
  const registration = {update:async () => {updates.push('worker'); await workerUpdate();}};
  class Channel {
    constructor() {
      this.port1 = {close() {}};
      this.port2 = {close() {},respond:data => queueMicrotask(() => this.port1.onmessage({data}))};
    }
  }
  const serviceWorker = {
    controller:{postMessage:({type},[port]) => {
      messages.push(type);
      Promise.resolve(messageHandler(type)).then(data => port.respond(data),error => port.respond({error:error.message}));
    }},
    register:async (url,options) => {assert.equal(url,'sw.js'); assert.equal(options.updateViaCache,'none'); return registration;},
    ready:Promise.resolve(registration),
    getRegistration:async () => registration
  };
  const context = {
    console,setTimeout,clearTimeout,MessageChannel:Channel,isSecureContext:true,
    navigator:{onLine:online,...(unsupported ? {} : {serviceWorker})},
    location:{reload:() => reloads++},
    document:{getElementById:() => panel},
    confirm:() => confirmed,
    addEventListener:(name,fn) => events[name] = fn,
    localStorage:{clear:() => assert.fail('Device data must not be cleared'),removeItem:() => assert.fail('Device data must not be removed')}
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['js/ui.js','js/config.js','js/offline.js']) vm.runInContext(source(file),context);
  context.FRC.config.active = JSON.parse(source('config/game.json'));
  context.FRC.storage = {getMatches:() => []};
  vm.runInContext(source('js/pages/home.js'),context);
  function newPanel() {
    let html = '', buttons = {};
    return {
      get innerHTML() {return html;},
      set innerHTML(value) {
        html = value;
        buttons = {};
        for (const id of ['refresh-website','apply-update']) if (html.includes(`id="${id}"`)) buttons[id] = {addEventListener:(_,fn) => buttons[id].click = fn};
      },
      querySelector:selector => buttons[selector.slice(1)] || null
    };
  }
  const page = {
    set innerHTML(html) {panel = html.includes('id="offline-status"') ? newPanel() : null;}
  };
  return {
    FRC:context.FRC, context, messages, updates, registration,
    home() {context.FRC.pages.home.render(page);},
    leave() {page.innerHTML = '<main>Scout</main>';},
    text:() => panel?.innerHTML || '',
    online(value) {context.navigator.onLine = value;},
    reply(value) {reply = value;},
    handle(fn) {messageHandler = fn;},
    updateWorker(fn) {workerUpdate = fn;},
    confirm(value) {confirmed = value;},
    reloads:() => reloads,
    event:name => events[name]()
  };
}
test('controls mount only on home and restore background state after navigation',async () => {
  const b = browser();
  await b.FRC.offline.init();
  assert.equal(b.text(),'');
  b.home();
  assert.match(b.text(),/Ready for offline use/);
  assert.match(b.text(),/Refresh downloaded website/);
  b.leave();
  b.online(false);
  b.event('offline');
  assert.equal(b.text(),'');
  b.home();
  assert.match(b.text(),/Offline · ready to scout/);
  assert.doesNotMatch(source('index.html'),/id="offline-status"/);
  for (const file of ['js/pages/scouter.js','js/pages/manager.js']) assert.doesNotMatch(source(file),/id="offline-status"/);
});
test('refresh checks worker and full bundle, reports no update, and ignores double clicks',async () => {
  const b = browser();
  await b.FRC.offline.init(); b.home();
  let finish;
  b.updateWorker(() => new Promise(resolve => finish = resolve));
  const first = b.FRC.offline.refresh(), second = b.FRC.offline.refresh();
  assert.equal(first,second);
  assert.match(b.text(),/Checking and downloading/);
  assert.match(b.text(),/id="refresh-website" disabled/);
  await new Promise(resolve => setImmediate(resolve));
  finish();
  await first;
  assert.deepEqual(b.updates,['worker']);
  assert.deepEqual(b.messages,['STATUS','CHECK']);
  assert.match(b.text(),/Already up to date/);
  assert.doesNotMatch(b.text(),/id="refresh-website" disabled/);
});
test('ready update requires confirmation; cancel preserves candidate and apply reloads only once',async () => {
  const b = browser();
  await b.FRC.offline.init(); b.home();
  b.reply({ready:true,update:true,definition:JSON.parse(source('config/game.json'))});
  await b.FRC.offline.refresh();
  assert.match(b.text(),/Apply update &amp; reload/);
  assert.equal(await b.FRC.offline.apply(),false);
  assert.equal(b.reloads(),0);
  assert.doesNotMatch(b.messages.join(','),/APPLY/);
  assert.match(b.text(),/Update ready/);
  b.confirm(true);
  const first = b.FRC.offline.apply(), second = b.FRC.offline.apply();
  assert.equal(first,second);
  assert.equal(await first,true);
  assert.equal(b.reloads(),1);
  assert.equal(b.messages.filter(x => x === 'APPLY').length,1);
});
test('offline refresh fails explicitly without worker requests; cached update can apply offline',async () => {
  const b = browser();
  await b.FRC.offline.init(); b.home();
  b.reply({ready:true,update:true});
  await b.FRC.offline.refresh();
  const count = b.messages.length;
  b.online(false); b.event('offline');
  assert.equal(await b.FRC.offline.refresh(),false);
  assert.match(b.text(),/Cached website remains available.*Connect to the internet/);
  assert.equal(b.messages.length,count);
  assert.match(b.text(),/Apply update/);
  b.confirm(true);
  assert.equal(await b.FRC.offline.apply(),true);
});
test('download/quota/apply failures preserve readiness and do not reload',async () => {
  const b = browser();
  await b.FRC.offline.init(); b.home();
  b.handle(async () => {throw new Error('Storage quota exceeded');});
  assert.equal(await b.FRC.offline.refresh(),false);
  assert.match(b.text(),/Cached website remains available.*Storage quota exceeded/);
  b.leave(); b.home();
  assert.match(b.text(),/Storage quota exceeded/);
  b.handle(async () => ({ready:true,update:true}));
  await b.FRC.offline.refresh();
  b.confirm(true);
  b.handle(async () => {throw new Error('Downloaded update is incomplete');});
  assert.equal(await b.FRC.offline.apply(),false);
  assert.equal(b.reloads(),0);
  assert.match(b.text(),/incomplete/);
});
test('unsupported browsers retain a discoverable refresh button and useful explanation',async () => {
  const b = browser({unsupported:true});
  await b.FRC.offline.init(); b.home();
  assert.match(b.text(),/HTTPS and service worker support/);
  assert.match(b.text(),/Refresh downloaded website/);
  assert.equal(await b.FRC.offline.refresh(),false);
  assert.equal(b.reloads(),0);
});
test('invalid candidate cannot expose an apply button or trigger a reload',async () => {
  const b = browser();
  await b.FRC.offline.init(); b.home();
  b.reply({ready:true,update:true,definition:{schemaVersion:999}});
  assert.equal(await b.FRC.offline.refresh(),false);
  assert.doesNotMatch(b.text(),/id="apply-update"/);
  assert.match(b.text(),/Game definition/);
  assert.equal(b.reloads(),0);
  b.reply({ready:true,update:true,definition:JSON.parse(source('config/game.json'))});
  await b.FRC.offline.refresh();
  assert.match(b.text(),/id="apply-update"/);
  b.reply({ready:true,update:true,definition:{schemaVersion:999}});
  assert.equal(await b.FRC.offline.refresh(),false);
  assert.doesNotMatch(b.text(),/id="apply-update"/);
});
test('refresh waits for updated worker activation before checking the candidate bundle',async () => {
  const b = browser();
  await b.FRC.offline.init(); b.home();
  let changed;
  b.registration.installing = {state:'installing',addEventListener:(_,fn) => changed = fn,removeEventListener() {}};
  const pending = b.FRC.offline.refresh();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.messages.includes('CHECK'),false);
  b.registration.installing.state = 'activated'; changed();
  assert.equal(await pending,true);
  assert.equal(b.messages.includes('CHECK'),true);
});