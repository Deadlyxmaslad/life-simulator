/* =========================================================================
 * UI · PWA（可安装 / 离线）(pwa) —— 路线图 B14
 * -------------------------------------------------------------------------
 * 纯前端 HTML 的两种运行形态：
 *   1) file:// 双击打开 —— 浏览器不注册 Service Worker，游戏照常运行（不受影响）
 *   2) http(s):// 部署 —— 注册 sw.js 实现离线，manifest.json 支持"安装到桌面/手机"
 * 本模块只做"能力探测 + 注册 + 安装按钮 + 离线提示"，不参与游戏逻辑。
 * 在无 window/navigator 的无头环境下自动降级为空操作。
 * ========================================================================= */
(function () {
  const bus = Game.bus;

  let deferredPrompt = null;
  let registered = false;
  let swState = 'unsupported';
  let installed = false;
  let btn = null;

  function hasDom() { return typeof document !== 'undefined' && !!document.getElementById; }
  function loc() { return typeof location !== 'undefined' ? location : null; }
  function isHttp() {
    const l = loc();
    return !!l && /^https?:$/.test(l.protocol);
  }
  function swSupported() {
    return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  }

  function standalone() {
    if (typeof window === 'undefined') return false;
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (e) { /* 忽略 */ }
    return !!(navigator && navigator.standalone);
  }

  function log(msg, level) {
    try {
      const p = Game.state.s.person;
      if (p && p.alive) Game.state.log(msg, level || 'info', '📱');
    } catch (e) { /* 静默 */ }
  }

  function syncButton() {
    if (!hasDom()) return;
    btn = btn || document.getElementById('btnInstall');
    if (!btn) return;
    const canPrompt = !!deferredPrompt;
    btn.hidden = !(canPrompt || (installed && !standalone()));
    if (installed) btn.textContent = '📱 已安装';
    else if (canPrompt) btn.textContent = '📱 安装';
    else btn.textContent = '📱 安装';
  }

  function register() {
    if (!isHttp()) {
      swState = 'file-protocol';
      return;
    }
    if (!swSupported()) {
      swState = 'unsupported';
      return;
    }
    try {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        registered = true;
        swState = 'registered';
        bus.emit('pwa:ready', { registered: true, scope: reg.scope });
        if (reg.waiting) log('📱 新版本已就绪，刷新后生效。', 'info');
        reg.addEventListener('updatefound', function () {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              log('📱 游戏已更新，下次打开即为新版本（离线依然可玩）。', 'info');
            }
          });
        });
      }).catch(function () {
        swState = 'error';
      });
    } catch (e) {
      swState = 'error';
    }
  }

  function wireInstall() {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      syncButton();
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      installed = true;
      syncButton();
      log('📱 已安装到桌面，可全屏离线游玩。', 'good');
    });
    window.addEventListener('offline', function () { log('📴 网络已断开，离线模式继续（存档仍在本地）。', 'warn'); });
    window.addEventListener('online', function () { /* 本游戏不需要网络，仅记录 */ });
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('click', function (e) {
        const t = e.target;
        if (t && t.id === 'btnInstall') doInstall();
      });
    }
  }

  function doInstall() {
    if (!deferredPrompt) {
      installed = standalone();
      syncButton();
      return false;
    }
    try {
      deferredPrompt.prompt();
      deferredPrompt.userChoice && deferredPrompt.userChoice.then(function (r) {
        if (r && r.outcome === 'accepted') installed = true;
        deferredPrompt = null;
        syncButton();
      });
    } catch (e) { /* 忽略 */ }
    return true;
  }

  function boot() {
    installed = standalone();
    wireInstall();
    register();
    syncButton();
  }

  if (hasDom() && typeof document.addEventListener === 'function') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  Game.pwa = {
    isHttp,
    supported: swSupported,
    registered: () => registered,
    state: () => swState,
    installed: standalone,
    canInstall: () => !!deferredPrompt,
    install: doInstall,
    refreshButton: syncButton,
  };
})();
