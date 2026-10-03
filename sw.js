/* Carga — service worker
   network-first para o HTML (código sempre fresco quando online),
   stale-while-revalidate para os demais assets do próprio app.
   Requisições ao Google/Drive (cross-origin) passam direto, sem cache. */
const CACHE = "carga-v9";

self.addEventListener("install", e => { self.skipWaiting(); });

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // Google/Drive e outros: direto

  const ehHTML = req.mode === "navigate" ||
                 (req.headers.get("accept") || "").includes("text/html");

  if (ehHTML) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const c = await caches.open(CACHE);
        c.put("./", fresh.clone());
        return fresh;
      } catch (err) {
        return (await caches.match("./")) ||
               (await caches.match(req)) ||
               new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // demais arquivos do app (sw.js não cai aqui; css/js inline já estão no HTML)
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const net = fetch(req).then(r => {
      if (r && r.status === 200) caches.open(CACHE).then(c => c.put(req, r.clone()));
      return r;
    }).catch(() => null);
    return cached || (await net) || new Response("", { status: 504 });
  })());
});
