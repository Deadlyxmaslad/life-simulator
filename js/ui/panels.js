/* =========================================================================
 * 界面 · 金手指面板 UI (panels) —— v1.2.0
 * -------------------------------------------------------------------------
 * UI 层不认识任何"作弊业务"：它只认每个模块自己暴露的 panel() 描述符
 *   { key, name, note, rows:[{id,label,sub,ready,tip}], extras:[...] }
 * 三者**彼此独立**：任一份 Game.hex / Game.tycoon / Game.datalize 不存在，
 * 对应入口就不渲染，其余两份照常显示，不会因为少一个而报错。
 *
 * 渲染策略：独立 rAF 循环 + "结构签名"，签名不变不触碰 DOM（避免闪烁与
 * 打断下拉框操作）；20fps 足够，不参与游戏 tick。
 * ========================================================================= */
Game.panels = (function () {
  const bus = Game.bus;

  // 每个模块的接入点：只有 api 存在才会被渲染出来
  const NODES = [
    { key: 'hex', get: function () { return Game.hex; } },
    { key: 'tycoon', get: function () { return Game.tycoon; } },
    { key: 'datalize', get: function () { return Game.datalize; } },
  ];

  let host = null;
  let rowEl = null;
  const open = {};     // key -> 面板是否展开
  const sig = {};      // key -> 上一次的结构签名
  const boxes = {};    // key -> DOM 节点
  let last = 0;

  function list() {
    const out = [];
    for (const n of NODES) {
      const api = n.get();
      if (api && typeof api.panel === 'function') out.push({ key: n.key, api: api });
    }
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function init() {
    host = document.getElementById('cheatBar');
    if (!host) return;
    if (!list().length) { host.style.display = 'none'; return; }
    host.style.display = '';
    host.addEventListener('click', onClick);
    host.addEventListener('change', onChange);
    buildRow();
    render(true);
    requestAnimationFrame(loop);
  }

  // 三个入口按钮只在第一次建好，之后只改 class（避免每帧重建导致闪烁）
  function buildRow() {
    rowEl = document.createElement('div');
    rowEl.className = 'cb-row';
    rowEl.innerHTML = '<span class="cb-label">👊 金手指</span>';
    for (const it of list()) {
      const b = document.createElement('button');
      b.className = 'cb-chip';
      b.dataset.mod = it.key;
      rowEl.appendChild(b);
    }
    const tip = document.createElement('span');
    tip.className = 'cb-tip';
    tip.textContent = '三个模块互不依赖，各自记账、各自结算折损';
    rowEl.appendChild(tip);
    host.appendChild(rowEl);
  }

  function render(force) {
    if (!host) return;
    const items = list();
    if (!items.length) { host.style.display = 'none'; return; }
    host.style.display = '';

    for (const it of items) {
      let p = null;
      try { p = it.api.panel(); } catch (err) { p = null; }
      if (!p) continue;
      // 1) 入口按钮状态
      const chip = rowEl.querySelector('.cb-chip[data-mod="' + it.key + '"]');
      if (chip) {
        const on = !!it.api.isOn && it.api.isOn();
        // J7 余额角标：模块自己在描述符里报余额（text + 是否够用），UI 只负责渲染与置灰
        const bal = p.balance;
        chip.innerHTML = esc(p.name) + (on ? '<i class="cb-dot"></i>' : '') +
          (bal ? '<i class="cb-bal' + (bal.ok ? '' : ' broke') + '">' + esc(bal.text) + '</i>' : '');
        chip.classList.toggle('on', on);
        chip.classList.toggle('cur', !!open[it.key]);
        chip.title = '展开 / 收起 · ' + p.name + '（' + (on ? '已启用' : '未启用') + '）' +
          (bal ? ' · ' + bal.text + (bal.ok ? '' : '（不足）') : '');
      }
      // 2) 面板本体：仅在结构签名变化时重建
      if (!open[it.key]) {
        if (boxes[it.key]) { boxes[it.key].remove(); delete boxes[it.key]; sig[it.key] = null; }
        continue;
      }
      const s = signature(p);
      if (!force && boxes[it.key] && sig[it.key] === s) continue;
      sig[it.key] = s;
      let box = boxes[it.key];
      if (!box) {
        box = document.createElement('div');
        box.className = 'cb-panel';
        box.dataset.mod = it.key;
        host.appendChild(box);
        boxes[it.key] = box;
      }
      box.innerHTML = htmlPanelBody(it.key, p, !!it.api.isOn && it.api.isOn());
    }
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - last < 120) return; // ~8fps：面板不需要高频
    last = ts;
    render(false);
  }

  function signature(p) {
    return [
      p.note,
      p.rows.map(function (r) { return r.id + (r.ready ? 1 : 0) + '|' + r.sub; }).join(','),
      (p.extras || []).map(function (x) {
        return x.id + (x.value == null ? '' : x.value) + (x.ready != null ? (x.ready ? 1 : 0) : '') +
          '|' + (x.options || []).map(function (o) { return o.value + o.label; }).join('/');
      }).join(','),
    ].join('#');
  }

  function htmlPanelBody(key, p, on) {
    const rows = p.rows.map(function (r) {
      return '<button class="cbp-btn' + (r.ready ? '' : ' off') + '" data-mod="' + key + '" data-id="' + esc(r.id) + '"' +
        (r.ready ? '' : ' disabled') + ' title="' + esc(r.tip) + '">' +
        '<span class="cbp-label">' + esc(r.label) + '</span><em>' + esc(r.sub) + '</em></button>';
    }).join('');
    const extras = (p.extras || []).map(function (x) {
      if (x.kind === 'select') {
        const opts = (x.options || []).map(function (o) {
          return '<option value="' + esc(o.value) + '"' + (String(x.value) === String(o.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('');
        return '<div class="cbp-extra"><span class="cbp-exlabel">' + esc(x.label) + '</span>' +
          '<select class="cbp-sel" data-mod="' + key + '">' + opts + '</select></div>';
      }
      return '<button class="cbp-btn small' + (x.ready ? '' : ' off') + '" data-mod="' + key + '" data-extra="1" data-id="' + esc(x.id) + '"' +
        (x.ready ? '' : ' disabled') + ' title="' + esc(x.tip) + '">' +
        '<span class="cbp-label">' + esc(x.label) + '</span><em>' + esc(x.sub) + '</em></button>';
    }).join('');
    return (
      '<div class="cbp-head"><b>' + esc(p.name) + '</b>' +
      '<span class="cbp-note">' + esc(p.note) + '</span>' +
      '<button class="cbp-switch' + (on ? ' on' : '') + '" data-mod="' + key + '" data-act="switch">' +
      (on ? '停用' : '启用') + '</button>' +
      '<button class="cbp-close" data-mod="' + key + '" data-act="close" title="收起">✕</button></div>' +
      '<div class="cbp-rows">' + rows + '</div>' +
      (extras ? '<div class="cbp-extras">' + extras + '</div>' : '')
    );
  }

  /* ------------------------------ 交互 ------------------------------ */
  function apiOf(key) {
    for (const n of NODES) if (n.key === key) return n.get();
    return null;
  }
  function onClick(e) {
    const chip = e.target.closest('.cb-chip');
    if (chip) {
      const k = chip.dataset.mod;
      open[k] = !open[k];
      render(true);
      return;
    }
    const b = e.target.closest('button[data-mod]');
    if (!b || !b.dataset.mod) return;
    const api = apiOf(b.dataset.mod);
    if (!api) return;
    if (b.dataset.act === 'switch') {
      if (typeof api.toggle === 'function') api.toggle();
      render(true);
      return;
    }
    if (b.dataset.act === 'close') {
      open[b.dataset.mod] = false;
      render(true);
      return;
    }
    if (b.disabled) return;
    const id = b.dataset.id;
    const sel = host.querySelector('.cbp-sel[data-mod="' + b.dataset.mod + '"]');
    const target = sel ? sel.value : undefined;
    let ok = false;
    if (b.dataset.extra && typeof api.castExtra === 'function') ok = api.castExtra(id, target);
    else if (typeof api.cast === 'function') {
      try { ok = api.cast(id, target); } catch (err) { ok = false; }
    }
    render(true);
    if (!ok && Game.state && Game.state.log) {
      // 失败反馈统一走既有日志通道，UI 不自己编文案
    }
  }
  function onChange(e) {
    const sel = e.target.closest('.cbp-sel');
    if (!sel) return;
    const api = apiOf(sel.dataset.mod);
    if (api && typeof api.select === 'function') api.select(+sel.value);
    render(true);
  }

  function boot() {
    try { init(); } catch (err) { console.error('[panels] init failed', err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { init: init, render: render };
})();
