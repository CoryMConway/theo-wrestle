type RegisterServiceWorkerOptions = {
  updateIntervalMs?: number;
  windowRef?: Window;
  navigatorRef?: Navigator;
  setIntervalRef?: typeof setInterval;
};

/**
 * Registers the service worker and eagerly applies updates for installed PWAs.
 */
export function registerServiceWorker({
  updateIntervalMs = 60_000,
  windowRef = window,
  navigatorRef = navigator,
  setIntervalRef = setInterval,
}: RegisterServiceWorkerOptions = {}) {
  if (!("serviceWorker" in navigatorRef)) return;

  windowRef.addEventListener("load", () => {
    navigatorRef.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        let refreshed = false;

        navigatorRef.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshed) return;
          refreshed = true;
          windowRef.location.reload();
        });

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigatorRef.serviceWorker.controller
            ) {
              installingWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        void registration.update();
        setIntervalRef(() => {
          void registration.update();
        }, updateIntervalMs);
      })
      .catch(() => {
        // SW registration failed — non-critical
      });
  });
}
