/* Armonía Facial — modo sin conexión.
   Guarda la app, el modelo y el motor de visión la primera vez; después funciona sin internet. */
"use strict";
const CACHE = "armonia-0286de8b01";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icono-192.png", "icono-512.png", "face_landmarker.task",
  "js/config.js", "js/numerics.js", "js/metrics.js", "js/explain.js", "js/detector.js", "js/overlay.js",
  "js/report.js", "js/recursos.js", "js/app.js"];
// Motor de visión, librería y generador de PDF (versiones fijas)
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/";
const EXTERNOS = [MP + "vision_bundle.mjs", MP + "wasm/vision_wasm_internal.js", MP + "wasm/vision_wasm_internal.wasm",
  "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js"];
const CDN = ["https://cdn.jsdelivr.net/", "https://fonts.googleapis.com/", "https://fonts.gstatic.com/"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL).then(() => Promise.allSettled(EXTERNOS.map((u) => c.add(u)))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN.some((p) => req.url.startsWith(p))) return;

  // La página: primero la red (para recibir actualizaciones), si no hay, la copia guardada.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put("index.html", copy));
      return r;
    }).catch(() => caches.match("index.html")));
    return;
  }
  // Lo demás (versiones fijas): primero la copia guardada.
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok || r.type === "opaque") {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return r;
  })));
});
