// Utility function to convert VAPID public key from Base64 to Uint8Array
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Request push notification permission and save subscription to DynamoDB
export async function requestPushNotificationPermission(
  roomNumber: string,
  guestId: string,
  updateGuestFn: (params: { roomNumber: string; guestId: string; pushSubscription: string }) => Promise<void>
): Promise<boolean> {
  // 1. Check browser support
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('❌ Push notifications not supported');
    return false;
  }

  try {
    // 2. Wait for Service Worker to be ready
    const registration = await navigator.serviceWorker.ready;

    // 3. Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log('✅ Already subscribed to push notifications');
      return true; // Already subscribed
    }

    // 4. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('❌ Notification permission denied');
      return false;
    }

    // 5. Get VAPID public key from environment variable
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error('❌ VAPID_PUBLIC_KEY not configured');
      return false;
    }

    // 6. Subscribe to push notifications
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    console.log('✅ Push notification subscription created');

    // 7. Save to DynamoDB
    await updateGuestFn({
      roomNumber,
      guestId,
      pushSubscription: JSON.stringify(subscription),
    });

    console.log('✅ Push notification subscription saved to DynamoDB');
    return true;
  } catch (error) {
    console.error('❌ Failed to subscribe to push notifications:', error);
    return false;
  }
}
