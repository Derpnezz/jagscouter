const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const root = path.join(__dirname,'..');
test('offline bundles reopen, JSON-only updates wait for approval, and old tabs stay pinned',async () => {
  const stores = new Map(), handlers = {};
  let online = true, changed = false, missing = false, quota = false;
  const original = JSON.parse(fs.readFileSync(path.join(root,'config/game.json')));
  const updated = structuredClone(original); updated.version = 'test-next';
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name,new Map());
      const map = stores.get(name);
      return {
        async put(key,response) {
          if (quota && !name.includes('metadata')) throw new Error('Storage quota exceeded');
          map.set(String(key),response.clone());
        },
        async match(key) {return map.get(String(key))?.clone();}
      };
    }
  };
  const ctx = {
    URL,Response,TextEncoder,crypto:webcrypto,caches,console,
    self:{location:'https://example.test/repo/sw.js',clients:{claim:async()=>{}},addEventListener:(name,fn) => handlers[name] = fn},
    fetch:async address => {
      if (!online) throw new Error('Offline');
      const relative = new URL(address).pathname.replace('/repo/','') || 'index.html';
      if (missing && relative === 'js/blocks.js') return new Response('not found',{status:404});
      let data = fs.readFileSync(path.join(root,relative));
      if (changed && relative === 'config/game.json') data = JSON.stringify(updated);
      return new Response(data,{headers:{'Content-Type':relative.endsWith('.js') ? 'application/javascript' : relative.endsWith('.json') ? 'application/json' : 'text/plain'}});
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),ctx);
  let install;
  handlers.install({waitUntil:p => install = p});
  ctx.self.skipWaiting = async () => {};
  await install;
  async function message(type,client='old-tab') {
    let work,result;
    handlers.message({data:{type},source:{id:client},ports:[{postMessage:x => result = x}],waitUntil:p => work=p});
    await work;
    return result;
  }
  async function get(relative,client='old-tab',navigation=false) {
    let result;
    handlers.fetch({
      request:{url:'https://example.test/repo/'+relative,method:'GET',mode:navigation ? 'navigate' : 'same-origin'},
      clientId:client,resultingClientId:client,respondWith:p => result=p
    });
    return await result;
  }
  assert.equal((await message('STATUS')).ready,true);
  online = false;
  assert.match(await (await get('', 'reopened-tab',true)).text(),/JagScouter/);
  assert.equal((await (await get('config/game.json')).json()).version,original.version);
  assert.equal((await message('CHECK')).error,'Offline');
  assert.equal((await message('STATUS')).ready,true);
  online = true; changed = true; missing = true;
  assert.match((await message('CHECK')).error,/Could not download/);
  assert.equal((await message('STATUS')).update,false);
  missing = false;
  quota = true;
  assert.match((await message('CHECK')).error,/quota/);
  assert.equal((await message('STATUS')).ready,true);
  assert.equal((await message('STATUS')).update,false);
  quota = false;
  const pending = await message('CHECK');
  assert.equal(pending.update,true);
  assert.equal(pending.definition.version,'test-next');
  assert.equal((await (await get('config/game.json')).json()).version,original.version);
  // A browser eviction between download and apply must not activate partial data.
  const metadata = stores.get('frc-metadata-/repo/');
  const pendingName = (await metadata.get('https://example.test/repo/__offline/pending').clone().json()).name;
  const candidate = stores.get(pendingName), missingURL = 'https://example.test/repo/js/blocks.js';
  const savedAsset = candidate.get(missingURL);
  candidate.delete(missingURL);
  assert.match((await message('APPLY')).error,/incomplete/);
  assert.equal((await (await get('config/game.json')).json()).version,original.version);
  candidate.set(missingURL,savedAsset);
  await message('APPLY');
  assert.equal((await (await get('config/game.json')).json()).version,original.version);
  await get('','new-tab',true);
  assert.equal((await (await get('config/game.json','new-tab')).json()).version,'test-next');
  assert.equal((await message('STATUS','old-tab')).update,true);
  online = false;
  await get('','old-tab',true);
  assert.equal((await (await get('config/game.json')).json()).version,'test-next');
  let intercepted = false;
  handlers.fetch({
    request:{url:'https://example.test/repo/another-artifact/',method:'GET',mode:'navigate'},
    respondWith:() => intercepted=true
  });
  assert.equal(intercepted,false);
});