/* EasyStudy Service Worker
   目标：手机端离线可用；所有路径用相对路径，兼容 GitHub Pages 子目录部署。 */

var CACHE = "easystudy-v3";

/* 需要预缓存的静态资源（相对 sw.js 所在目录） */
var PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/dict.js",
  "./js/ipa.js",
  "./js/data.js",
  "./js/data2.js",
  "./js/data3.js",
  "./js/data4.js",
  "./js/checker.js",
  "./js/recorder.js",
  "./js/desktop.js",
  "./js/app.js",
  "./assets/logo-192.png",
  "./assets/logo-512.png",
  "./assets/logo-256.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // 单个失败不影响其它，避免一个 404 让整个安装失败
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(new Request(url, { cache: "reload" })).catch(function () {});
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;

  // 只处理同源 GET
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // 音频分片：命中缓存直接返回，否则下载并存入缓存（离线可听）
  if (/\/audio\/[a-z]+\/[0-9]{3}\.json$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  // 页面导航：网络优先，失败回落缓存（保证更新能拿到新版本）
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match("./index.html");
        });
      })
    );
    return;
  }

  // 静态资源：缓存优先，后台更新
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        fetch(req).then(function (res) {
          if (res && res.ok) {
            caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
          }
        }).catch(function () {});
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return hit;
      });
    })
  );
});

/* 允许页面主动触发更新 */
self.addEventListener("message", function (event) {
  if (event.data === "skip-waiting") self.skipWaiting();
});
