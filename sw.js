/* Offline bundles are content-addressed: JSON-only website changes create a new
 * bundle without editing this worker. A user explicitly applies a ready bundle.
 * Existing tabs stay pinned to their original bundle until navigation/reload. */
const ROOT = new URL('./', self.location);
const PREFIX = `frc-bundle-${ROOT.pathname}-`;
const META = `frc-metadata-${ROOT.pathname}`;
const ASSETS = [
  './','index.html','css/style.css','config/game.json','manifest.webmanifest','icon.svg',
  'js/ui.js','js/config.js','js/records.js','js/storage.js','js/analytics.js',
  'js/csv.js','js/blocks.js','js/offline.js','js/pages/home.js','js/pages/scouter.js',
  'js/pages/manager.js','js/app.js','js/lib/lz-string.min.js','js/lib/qrcode.min.js',
  'js/lib/html5-qrcode.min.js','js/lib/chart.min.js'
];
const url = p => new URL(p, ROOT).href;
async function read(key) {
  const response = await (await caches.open(META)).match(url(`__offline/${key}`));
  return response ? response.json() : null;
}
async function write(key, value) {
  await (await caches.open(META)).put(url(`__offline/${key}`),new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}));
}
let preparing;
async function prepare() {
  if (preparing) return preparing;
  preparing = (async () => {
    const responses = await Promise.all(ASSETS.map(async path => {
      const response = await fetch(url(path),{cache:'no-store'});
      if (!response.ok || response.type === 'opaque') throw new Error(`Could not download ${path}`);
      const contentType = response.headers.get('Content-Type') || '';
      if (path.endsWith('.js') && !contentType.includes('javascript')) throw new Error(`Invalid script: ${path}`);
      if (path.endsWith('.json') && !contentType.includes('json')) throw new Error(`Invalid JSON: ${path}`);
      return response;
    }));
    const definition = await responses[ASSETS.indexOf('config/game.json')].clone().json();
    if (definition.schemaVersion !== 1 || !definition.gameId || !Array.isArray(definition.sections)) throw new Error('Invalid game definition.');
    const digests = await Promise.all(responses.map(async response => {
      const bytes = await response.clone().arrayBuffer();
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n => n.toString(16).padStart(2,'0')).join('');
    }));
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(digests.join(''))))].map(n => n.toString(16).padStart(2,'0')).join('');
    const name = PREFIX + digest, cache = await caches.open(name);
    await Promise.all(ASSETS.map((path,i) => cache.put(url(path),responses[i])));
    const bundle = {name,definition};
    const active = await read('active');
    if (!active) await write('active',bundle);
    else if (active.name !== name) await write('pending',bundle);
    else await write('pending',null);
    return bundle;
  })();
  try { return await preparing; } finally { preparing = null; }
}
self.addEventListener('install',event => {
  event.waitUntil(prepare().then(() => self.skipWaiting()));
});
self.addEventListener('activate',event => event.waitUntil(self.clients.claim()));
async function clientBundle(id, navigation) {
  const active = await read('active');
  if (!id) return active;
  let bundle = navigation ? null : await read(`client-${id}`);
  if (!bundle) { bundle = active; if (bundle) await write(`client-${id}`,bundle); }
  return bundle;
}
self.addEventListener('fetch',event => {
  const requestURL = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestURL.origin !== ROOT.origin || !requestURL.pathname.startsWith(ROOT.pathname)) return;
  const resourceURL = requestURL.origin + requestURL.pathname;
  // Hash routing uses only the app root/index. Never capture another artifact's
  // navigation merely because this app is mounted at the shared origin root.
  if (!ASSETS.some(p => url(p) === resourceURL)) return;
  event.respondWith((async () => {
    const navigation = event.request.mode === 'navigate';
    const bundle = await clientBundle(navigation ? event.resultingClientId : event.clientId,navigation);
    if (bundle) {
      const cache = await caches.open(bundle.name);
      const cached = await cache.match(navigation ? url('./') : resourceURL);
      if (cached) return cached;
    }
    return fetch(event.request);
  })());
});
self.addEventListener('message',event => {
  const port = event.ports[0];
  event.waitUntil((async () => {
    try {
      if (event.data.type === 'CHECK') await prepare();
      if (event.data.type === 'APPLY') {
        const pending = await read('pending');
        if (pending) {
          const candidate = await caches.open(pending.name);
          if (!(await Promise.all(ASSETS.map(path => candidate.match(url(path))))).every(Boolean)) {
            throw new Error('Downloaded update is incomplete. Keep using the cached website and refresh online again.');
          }
          await write('active',pending);
          await write('pending',null);
        }
      }
      const active = await read('active');
      const bundle = await clientBundle(event.source?.id,false);
      const pending = await read('pending');
      // A tab using an earlier active bundle also needs a reload notice.
      const update = pending || (active?.name !== bundle?.name ? active : null);
      const cache = bundle && await caches.open(bundle.name);
      const complete = cache && (await Promise.all(ASSETS.map(path => cache.match(url(path))))).every(Boolean);
      port?.postMessage({ready:!!complete,update:!!update,definition:update?.definition});
    } catch(error) { port?.postMessage({error:error.message}); }
  })());
});