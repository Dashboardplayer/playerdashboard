importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyBCTAzMEf5bokmAJlsVMQOVEI0V2TWzKSQ',
    authDomain: 'player-3a392.firebaseapp.com',
    projectId: 'player-3a392',
    storageBucket: 'player-3a392.firebasestorage.app',
    messagingSenderId: '1065123442162',
    appId: '1:1065123442162:web:8cad6f4fda622fef0c4f6b',
    measurementId: 'G-671RH6QYW9'
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Received background message:', payload);
    
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
}); 