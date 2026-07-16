// Service worker: el "portero" de la PWA. Guarda una copia de los archivos
// de la app (el "cascarón") para que abra incluso sin internet.
// Los DATOS (/portal/...) siempre se piden frescos a la red.

const CACHE = "mi-taller-v2";
const ARCHIVOS = ["/app/", "/app/index.html", "/app/manifest.json", "/app/icono.svg"];

// Al instalarse, guarda el cascarón de la app.
self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
});

// Al pedir un archivo: si está en la copia local, úsalo; si no, ve a la red.
self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);
  if (url.pathname.startsWith("/portal/")) return; // datos: siempre a la red
  evento.respondWith(
    caches.match(evento.request).then((r) => r || fetch(evento.request))
  );
});

// FASE 3 (push): cuando el servidor manda una notificación, el navegador
// despierta este service worker (¡aunque la app esté cerrada!) y aquí la
// mostramos en pantalla.
self.addEventListener("push", (evento) => {
  const datos = evento.data ? evento.data.json() : {};
  evento.waitUntil(
    self.registration.showNotification(datos.titulo || "Mi Taller", {
      body: datos.cuerpo || "",
      icon: "/app/icono.svg",
      badge: "/app/icono.svg",
      lang: "es",
    })
  );
});

// Al tocar la notificación, se abre (o se enfoca) la app.
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  evento.waitUntil(clients.openWindow("/app/"));
});

// Al activarse una versión nueva, borra las copias viejas.
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((llaves) =>
      Promise.all(llaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});
