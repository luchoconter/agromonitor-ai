
// ESTE ARCHIVO ESTÁ OBSOLETO Y DEBE SER ELIMINADO.
// La aplicación ahora utiliza vite-plugin-pwa para generar un Service Worker optimizado (sw.js) en la carpeta de distribución.
// Mantener este archivo vacío evita conflictos si el navegador intenta cargarlo desde la caché antigua.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Forzar la invalidación de este SW antiguo para que el navegador tome el nuevo generado por Vite
  self.registration.unregister().then(() => {
    return self.clients.matchAll();
  }).then((clients) => {
    clients.forEach(client => client.navigate(client.url));
  });
});
