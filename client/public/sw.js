/* eslint-disable no-undef */
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js",
);

if (workbox) {
  // Ensure authenticated API requests are NEVER cached.
  workbox.routing.registerRoute(({ url, request }) => {
    // Exclude requests that include Authorization headers or target protected API endpoints
    if (
      url.pathname.startsWith("/api/") ||
      request.headers.has("Authorization")
    ) {
      return true;
    }
    return false;
  }, new workbox.strategies.NetworkOnly());

  // Continue runtime caching for static assets.
  workbox.routing.registerRoute(
    ({ request }) =>
      request.destination === "script" ||
      request.destination === "style" ||
      request.destination === "image",
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: "static-resources",
    }),
  );

  // Preserve offline support for public resources
  workbox.routing.registerRoute(
    ({ request }) => request.mode === "navigate",
    new workbox.strategies.NetworkFirst({
      cacheName: "pages-cache",
    }),
  );
}
