import { checkConnection, countPending, syncPendingCheckins } from "./syncQueue";

// Estado de señal y de envío de marcas, compartido por todas las pantallas del
// referente. Un único ciclo en segundo plano (startSyncLoop) hace el envío y
// el chequeo de señal, con reintentos cada vez más espaciados mientras falla,
// y lo publica acá para que el indicador fijo y los avisos lo muestren.

export type SignalState = "unknown" | "online" | "offline";

export interface SyncStatus {
  signal: SignalState;
  syncing: boolean;
  // Hubo una caída de señal y ya volvió (el servidor respondió de verdad, no
  // solo "el celular dice conectado"). Sigue en true hasta acknowledgeRecovered.
  recovered: boolean;
}

const SIGNAL_LOST_KEY = "peregrinacion_signal_lost";
const HEALTHY_INTERVAL_MS = 20000;
const RETRY_DELAYS_MS = [4000, 8000, 15000, 30000];

let status: SyncStatus = { signal: "unknown", syncing: false, recovered: false };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const getSnapshot = () => status;
const serverSnapshot: SyncStatus = status;
export const getServerSnapshot = () => serverSnapshot;

// Se guarda también en sessionStorage: si la página se recarga por cualquier
// motivo, no se pierde que la señal se había cortado.
let everLost = false;
try {
  everLost = typeof sessionStorage !== "undefined" && !!sessionStorage.getItem(SIGNAL_LOST_KEY);
} catch {}

function markSignalLost() {
  everLost = true;
  try {
    sessionStorage.setItem(SIGNAL_LOST_KEY, "1");
  } catch {}
}

// El referente ya vio el aviso de "volvió la señal" (o volvió a la planilla).
export function acknowledgeRecovered() {
  everLost = false;
  try {
    sessionStorage.removeItem(SIGNAL_LOST_KEY);
  } catch {}
  setStatus({ recovered: false });
}

// Con el celular en el bolsillo, en la ruta, el aviso visual no alcanza.
function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let rerun = false;
let failures = 0;

function schedule(delayMs: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(tick, delayMs);
}

// Pide un ciclo ya (después de una marca, al volver la señal, a mano). Si hay
// uno en curso, se encadena otro apenas termine.
export function kickSync() {
  if (running) {
    rerun = true;
    return;
  }
  schedule(0);
}

async function tick() {
  if (running) return;
  running = true;
  setStatus({ syncing: true });
  let nextDelay = HEALTHY_INTERVAL_MS;
  try {
    const pendingBefore = await countPending();
    let reachable: boolean;
    let allSent = true;

    if (pendingBefore > 0) {
      // Enviar las marcas ya sirve de chequeo de señal.
      const result = await syncPendingCheckins();
      reachable = result.synced > 0 || result.failed === 0;
      allSent = result.failed === 0;
    } else {
      reachable = await checkConnection(5000);
    }

    if (!reachable) {
      markSignalLost();
      setStatus({ signal: "offline", recovered: false });
      nextDelay = RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)];
      failures += 1;
    } else {
      const wasLost = status.signal === "offline" || everLost;
      if (wasLost && status.signal !== "online") vibrate([200, 100, 200]);
      setStatus({ signal: "online", recovered: everLost });
      if (pendingBefore > 0 && allSent) vibrate([120]);
      if (allSent) {
        failures = 0;
      } else {
        // Hay señal pero el servidor no aceptó algunas marcas: se reintenta
        // con espera creciente en vez de insistir cada pocos segundos.
        nextDelay = RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)];
        failures += 1;
      }
    }
  } catch {
    // IndexedDB no disponible u otro error inesperado: no se rompe el ciclo.
    nextDelay = RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  } finally {
    running = false;
    setStatus({ syncing: false });
    if (rerun) {
      rerun = false;
      schedule(0);
    } else {
      schedule(nextDelay);
    }
  }
}

// Idempotente: se puede llamar desde cada pantalla, el ciclo es uno solo.
export function startSyncLoop() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("online", () => {
    failures = 0;
    kickSync();
  });
  window.addEventListener("offline", () => {
    markSignalLost();
    setStatus({ signal: "offline", recovered: false });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kickSync();
  });

  if (!navigator.onLine) {
    markSignalLost();
    setStatus({ signal: "offline" });
  }
  schedule(0);
}
