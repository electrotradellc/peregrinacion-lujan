import { defaultCache } from "@serwist/next/worker";
import { ExpirationPlugin, NetworkFirst, Serwist, type PrecacheEntry, type RuntimeCaching, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Páginas del referente y del peregrino: red primero, pero si la red no
// contesta en unos segundos se abre la copia guardada. La regla por defecto de
// Serwist no tiene tiempo límite, así que con "una rayita" de señal la página
// se quedaba cargando en vez de abrir la copia. Se limita a estas rutas a
// propósito: en el admin una copia vieja mostraría datos desactualizados.
// Incluye también los pedidos de "precarga" que hace la planilla (no son
// navegaciones) para que la copia quede en este mismo cache.
const PAGE_NETWORK_TIMEOUT_SECONDS = 4;
const pageFallback: RuntimeCaching = {
  matcher: ({ request, sameOrigin, url: { pathname } }) =>
    sameOrigin &&
    request.headers.get("RSC") !== "1" &&
    (pathname.startsWith("/capitan") || pathname.startsWith("/mi-inscripcion")),
  handler: new NetworkFirst({
    cacheName: "pages-offline",
    networkTimeoutSeconds: PAGE_NETWORK_TIMEOUT_SECONDS,
    plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 7 * 24 * 60 * 60 })],
  }),
};

// Precachea el shell de la app (HTML/JS/CSS/estáticos) para que /capitan y
// /mi-inscripcion carguen con cero red. Los datos en sí (roster, check-ins)
// viven en IndexedDB (lib/offline/db.ts), no en este cache — esta es la capa
// que hace que la app abra offline, no la que sincroniza datos.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [pageFallback, ...defaultCache],
});

serwist.addEventListeners();
