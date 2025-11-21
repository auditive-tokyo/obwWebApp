// Service Worker for Push Notifications

self.addEventListener('push', (event) => {
  console.log('📩 Push notification received');

  if (!event.data) {
    console.log('Push event but no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Push data:', data);

    const options = {
      body: data.body,
      icon: '/icons8-bot-64.png',
      badge: '/vite.svg',
      data: data.data,
      requireInteraction: true, // 重要な通知は自動的に消えない
      vibrate: [200, 100, 200], // バイブレーションパターン
      tag: 'room-notification' // 同じタグの通知は1つだけ表示
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked');
  event.notification.close();

  if (event.notification.data?.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Service Worker のインストール時
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting(); // 即座にアクティブ化
});

// Service Worker のアクティベーション時
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim()); // すぐに制御を取得
});
