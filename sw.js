const PREFIXO = 'sollers-work-';
const CACHE = `${PREFIXO}1.4.0`;
const ARQUIVOS = ['./', './index.html', './style.css', './app.js', './manifest.json',
  './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ARQUIVOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // apaga só as versões antigas deste app: os outros apps do mesmo endereço
    // (guilherme2reis.github.io) usam o mesmo espaço de cache e não podem ser tocados
    caches.keys().then((chaves) =>
      Promise.all(chaves
        .filter((k) => k.startsWith(PREFIXO) && k !== CACHE)
        .map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// com internet busca sempre a versão nova (e guarda); sem internet usa a guardada
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // tarefas do arquivo do computador: sempre direto do servidor, nunca de cópia guardada
  if (new URL(event.request.url).pathname.includes('/api/')) return;
  event.respondWith(
    fetch(event.request)
      .then((resposta) => {
        if (resposta.ok && new URL(event.request.url).origin === location.origin) {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
