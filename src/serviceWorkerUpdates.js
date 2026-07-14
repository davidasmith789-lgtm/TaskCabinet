export const SERVICE_WORKER_UPDATE_EVENT = "glowdocket-service-worker-update";

let waitingWorker = null;
let reloadRequested = false;
let reloadStarted = false;
let announcedWorker = null;

function announceUpdate(windowValue, detail) {
  windowValue.dispatchEvent(new CustomEvent(SERVICE_WORKER_UPDATE_EVENT, { detail }));
}

function watchInstallingWorker(worker, navigatorValue, windowValue) {
  worker.addEventListener("statechange", () => {
    if (worker.state !== "installed" || !navigatorValue.serviceWorker.controller || announcedWorker === worker) return;
    waitingWorker = worker;
    announcedWorker = worker;
    announceUpdate(windowValue, { state: "available" });
  });
}

export function applyServiceWorkerUpdate() {
  if (!waitingWorker) return false;
  reloadRequested = true;
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
  return true;
}

export function reloadForServiceWorkerUpdate(windowValue = window) {
  if (reloadStarted) return;
  reloadStarted = true;
  windowValue.location.reload();
}

export function registerServiceWorkerUpdates({ navigatorValue = navigator, windowValue = window } = {}) {
  if (!("serviceWorker" in navigatorValue)) return;
  let hadController = Boolean(navigatorValue.serviceWorker.controller);
  let lastUpdateCheck = 0;

  navigatorValue.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) { hadController = true; return; }
    if (reloadRequested) reloadForServiceWorkerUpdate(windowValue);
    else announceUpdate(windowValue, { state: "reload-ready" });
  });

  windowValue.addEventListener("load", async () => {
    try {
      const registration = await navigatorValue.serviceWorker.register("/sw.js");
      if (registration.waiting && navigatorValue.serviceWorker.controller) {
        waitingWorker = registration.waiting;
        announcedWorker = registration.waiting;
        announceUpdate(windowValue, { state: "available" });
      }
      registration.addEventListener("updatefound", () => {
        if (registration.installing) watchInstallingWorker(registration.installing, navigatorValue, windowValue);
      });

      const checkForUpdate = () => {
        const now = Date.now();
        if (now - lastUpdateCheck < 60000) return;
        lastUpdateCheck = now;
        registration.update().catch((error) => console.error("Service worker update check failed:", error));
      };
      windowValue.addEventListener("online", checkForUpdate);
      windowValue.addEventListener("focus", checkForUpdate);
      windowValue.document.addEventListener("visibilitychange", () => {
        if (windowValue.document.visibilityState === "visible") checkForUpdate();
      });
      windowValue.setInterval(checkForUpdate, 60 * 60 * 1000);
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });
}
