/**
 * firebase-messaging-sw.js — disabled stub.
 * The real service worker requires Firebase CDN scripts (importScripts from gstatic.com)
 * which fail when offline or blocked. This stub prevents the error entirely.
 */

self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
// No Firebase messaging — push notifications are not enabled in this build.