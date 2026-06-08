/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

// `self` is the service worker global scope.
const sw = self as unknown as ServiceWorkerGlobalScope;

// A per-deploy cache name so a new version wipes the old precache.
const CACHE = `supply-admin-${version}`;

const OFFLINE_URL = '/offline.html';

// Static, content-hashed assets (JS/CSS bundles) and files from `static/`.
// These are safe to cache aggressively — they are immutable per deploy.
const PRECACHE = [...build, ...files];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      // Activate this worker as soon as it finishes installing.
      await sw.skipWaiting();
    })()
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous deploys.
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await sw.clients.claim();
    })()
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only deal with GETs; never interfere with auth POSTs, API mutations, etc.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Leave cross-origin requests (e.g. Supabase) entirely to the network.
  if (url.origin !== sw.location.origin) return;

  // Precached, content-hashed assets: serve from cache first for instant loads.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        return cached ?? fetch(request);
      })()
    );
    return;
  }

  // Page navigations: network-first so authenticated, user-specific content is
  // always fresh. When the network is unavailable, fall back to a static
  // offline page. We intentionally do NOT cache navigation or API responses,
  // which could leak one user's data to another on a shared device.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ??
            new Response('You are offline.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            })
          );
        }
      })()
    );
    return;
  }

  // Everything else (same-origin API GETs, etc.): straight to the network.
});
