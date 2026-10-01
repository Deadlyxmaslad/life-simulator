/* =========================================================================
 * Service Worker · 离线缓存 (LifeSim)
 * -------------------------------------------------------------------------
 * 目标：安装到桌面/手机后断网也能继续玩。
 * 策略：
 *   - 安装时预缓存全部静态资源（游戏无任何外部依赖，清单即全部代码）；
 *   - 导航请求（HTML）：network-first，失败回落缓存（保证能拿到新版本）；
 *   - 其它同源 GET：cache-first + 后台更新（stale-while-revalidate）；
 *   - 只处理同源 GET，绝不触碰跨域请求（本游戏也不产生任何网络请求）。
 * 注意：file:// 协议下浏览器不注册 SW，游戏在 file:// 下依旧双击可玩，
 *       本文件因此在 file:// 场景下完全不会被加载，不影响单机体验。
 * ========================================================================= */
const CACHE = 'lifesim-v2.6.1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/main.js',
  './js/core/ns.js',
  './js/core/bus.js',
  './js/core/util.js',
  './js/core/state.js',
  './js/core/system.js',
  './js/core/loop.js',
  './js/systems/clock.js',
  './js/systems/era.js',
  './js/systems/family.js',
  './js/systems/personality.js',
  './js/systems/mental.js',
  './js/systems/weather.js',
  './js/systems/needs.js',
  './js/systems/disease.js',
  './js/systems/lifespan.js',
  './js/systems/education.js',
  './js/systems/career.js',
  './js/systems/invest.js',
  './js/systems/assets.js',
  './js/systems/marriage.js',
  './js/systems/social.js',
  './js/systems/consequences.js',
  './js/systems/decisions.js',
  './js/systems/actions.js',
  './js/systems/habit.js',
  './js/systems/roads.js',
  './js/systems/consumption.js',
  './js/systems/meta.js',
  './js/systems/ap.js',
  './js/systems/contracts.js',
  './js/systems/persona.js',
  './js/systems/story.js',
  './js/systems/history.js',
  './js/systems/achievements.js',
  './js/systems/hex.js',
  './js/systems/tycoon.js',
  './js/systems/datalize.js',
  './js/systems/score.js',
  './js/systems/scenario.js',
  './js/systems/save.js',
  './js/systems/audio.js',
  './js/ui/hud.js',
  './js/ui/layout.js',
  './js/ui/panels.js',
  './js/ui/habitPanel.js',
  './js/ui/classPanel.js',
  './js/ui/officePanel.js',
  './js/ui/consumePanel.js',
  './js/ui/apPanel.js',
  './js/ui/contractPanel.js',
  './js/ui/personaPanel.js',
  './js/ui/roadsPanel.js',
  './js/ui/pwa.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      // 单个资源 404 不应让整个安装失败（allSettled 风格）
      return Promise.all(
        ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skipWaiting') self.skipWaiting();
});
