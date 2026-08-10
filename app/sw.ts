import { defaultCache } from "@serwist/next/worker";
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Precachea el shell de la app (HTML/JS/CSS/estáticos) para que /capitan y
// /mi-inscripcion carguen con cero red. Los datos en sí (roster, check-ins)
// viven en IndexedDB (lib/offline/db.ts), no en este cache — esta es la capa
// que hace que la app abra offline, no la que sincroniza datos.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
