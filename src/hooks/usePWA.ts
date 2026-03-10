import { useEffect, useState, useCallback } from "react";

interface PWAStatus {
  isInstallable: boolean;
  isInstalled: boolean;
  deferredPrompt: Event | null;
  updateAvailable: boolean;
}

export function usePWA() {
  const [status, setStatus] = useState<PWAStatus>({
    isInstallable: false,
    isInstalled: false,
    deferredPrompt: null,
    updateAvailable: false,
  });

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setStatus((prev) => ({ ...prev, isInstalled: true }));
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setStatus((prev) => ({ ...prev, isInstallable: true, deferredPrompt: e }));
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setStatus((prev) => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
        deferredPrompt: null,
      }));
    };

    // Service Worker update handling
    let registration: ServiceWorkerRegistration | null = null;

    const handleSWUpdate = () => {
      setStatus((prev) => ({ ...prev, updateAvailable: true }));
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          registration = reg;

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  handleSWUpdate();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("SW registration failed:", error);
        });
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!status.deferredPrompt) return false;

    const promptEvent = status.deferredPrompt as any;
    promptEvent.prompt();

    const { outcome } = await promptEvent.userChoice;
    setStatus((prev) => ({
      ...prev,
      deferredPrompt: null,
      isInstallable: false,
    }));

    return outcome === "accepted";
  }, [status.deferredPrompt]);

  const update = useCallback(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update();
        window.location.reload();
      });
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === "granted";
  }, []);

  const showNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if ("Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, options);
        });
      }
    },
    []
  );

  return {
    ...status,
    install,
    update,
    requestNotificationPermission,
    showNotification,
  };
}

// Hook for online/offline status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

// Hook for background sync
export function useBackgroundSync() {
  const sync = useCallback(async (tag: string) => {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register(tag);
      return true;
    }
    return false;
  }, []);

  return { sync };
}
