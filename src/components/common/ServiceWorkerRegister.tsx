"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "development") {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log("[Service Worker] Unregistered active service worker for development.");
              }
            });
          }
        });
      } else {
        window.addEventListener("load", () => {
          navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
              console.log("ServiceWorker registered successfully with scope: ", registration.scope);
            })
            .catch((err) => {
              console.warn("ServiceWorker registration failed: ", err);
            });
        });
      }
    }
  }, []);

  return null;
}
