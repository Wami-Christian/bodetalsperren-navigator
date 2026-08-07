"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/"
        });

        // Prüft beim Öffnen der App, ob eine neue Version bereitsteht.
        await registration.update();

        // Falls bereits ein neuer Worker wartet, sofort übernehmen.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      } catch (error) {
        console.warn("Service Worker konnte nicht registriert werden:", error);
      }
    };

    register();

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  return null;
}
