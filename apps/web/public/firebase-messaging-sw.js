importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

self.firebase.initializeApp({
  apiKey: 'AIzaSyAKvPrhqWTNtjR_kstvAU8jeGTIsBxbTEs',
  authDomain: 'concord-a5aea.firebaseapp.com',
  projectId: 'concord-a5aea',
  messagingSenderId: '463886631922',
  appId: '1:463886631922:web:bdbc823e9b22790af9616b',
});

const messaging = self.firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Concord';
  const body = payload.notification?.body ?? '';
  const link = payload.fcmOptions?.link ?? '/';
  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
    data: { link },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? '/';
  event.waitUntil(self.clients.openWindow(link));
});
