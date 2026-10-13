function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushSubscribeResult = "subscribed" | "denied" | "unsupported" | "error";

/**
 * Demande la permission de notifications et abonne l'appareil. Le deviceKey
 * est facultatif : un visiteur peut s'abonner avant de s'identifier ; son
 * abonnement recevra alors les notifications générales du site.
 */
export async function requestPushSubscription(deviceKey?: string): Promise<PushSubscribeResult> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return "error";

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    const json = subscription.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        ...(deviceKey ? { deviceKey } : {}),
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });
    if (!res.ok) return "error";

    return "subscribed";
  } catch {
    return "error";
  }
}
