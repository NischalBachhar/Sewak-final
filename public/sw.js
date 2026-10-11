/* No API, authenticated page or token caching. Notification text is generic. */
self.addEventListener('push', event => {
 let data={};try{data=event.data?.json()||{};}catch{}
 event.waitUntil(self.registration.showNotification('Sewak',{body:'You have a new Sewak notification. Sign in to view it.',icon:'/logo192.png',badge:'/logo192.png',tag:typeof data.tag==='string'?data.tag.slice(0,200):'sewak',data:{url:'/'}}));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const own=clients.find(c=>new URL(c.url).origin===self.location.origin);if(own){await own.focus();return;}await self.clients.openWindow('/');}));
});
