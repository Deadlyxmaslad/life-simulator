/* =========================================================================
 * 界面 · 消费面板 (consumePanel) —— v1.5.0
 * -------------------------------------------------------------------------
 * 独立 UI 模块：自己找容器 #consumeBox、自己跑 rAF，不侵入 hud.js 主渲染循环。
 * 三个分区：
 *   🛍️ 耐用品  —— 点击买入；已拥有显示"在用/卖出"；未解锁显示财富门槛
 *   ✨ 一次性  —— 点击即时消费
 *   📞 服务业  —— 点击订阅/停订开关
 * 顶部横幅显示当前财富档位与"下一档还差多少"，体现"钱多了放开"。
 * Game.consume 不存在时整个模块静默不渲染（删掉系统文件界面也不报错）。
 * ========================================================================= */
(function () {
  const el = {};
  let last = 0;
  let sig = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function num(v) {
    const n = Math.round((v || 0) * 10) / 10;
    return (n % 1 === 0) ? String(n) : n.toFixed(1);
  }

  function build() {
    const host = document.getElementById('consumeBox');
    if (!host) return;
    if (!Game.consume || typeof Game.consume.state !== 'function') { host.style.display = 'none'; return; }
    host.style.display = '';
    host.innerHTML =
      '<div class="cs-head">🛍️ 消费 <span class="cs-note">钱多了，日子就该过得不一样</span>' +
      '<span class="cs-tier" id="csTier"></span></div>' +
      '<div class="cs-body" id="csBody"></div>';
    el.body = document.getElementById('csBody');
    el.tier = document.getElementById('csTier');
    host.addEventListener('click', onClick);
    requestAnimationFrame(loop);
  }

  // 顶部档位横幅
  function tierBanner(s) {
    const tiers = Game.config.consume.tiers || [];
    const cur = Game.consume.tierOf(s.tier) || tiers[0] || {};
    let next = null;
    for (const t of tiers) { if (t.min > (cur.min || 0)) { next = t; break; } }
    const gap = next ? Math.max(0, Math.round((next.min - s.netWorth) * 10) / 10) : 0;
    const tip = next
      ? '再攒 ' + num(gap) + ' 万解锁「' + next.name + '」'
      : '已到最高档 · 随心所欲';
    return '<div class="cs-banner">' +
      '<span class="cs-tier-name">' + esc(cur.name || '温饱') + '档</span>' +
      '<span class="cs-tier-note">' + esc(cur.note || '') + '</span>' +
      '<span class="cs-tier-next">' + esc(tip) + '</span>' +
      '</div>';
  }

  function goodsRow(s) {
    return s.goods.map(function (g) {
      const owned = g.held;
      const cls = 'cs-chip' + (!g.unlocked ? ' locked' : '') + (owned ? ' owned' : '');
      const dis = (!g.unlocked || owned) ? ' disabled' : '';
      const tip = !g.unlocked
        ? '需「' + g.tierName + '」档：' + g.note
        : (owned ? '已拥有 · ' + g.note : g.price + ' 万 · 持有 ' + g.hold + ' 年 · ' + g.note);
      const act = owned ? 'sell-good' : 'buy-good';
      return '<button class="' + cls + '" data-act="' + act + '" data-id="' + esc(g.key) + '"' + dis +
        ' title="' + esc(tip) + '">' +
        '<span class="cs-emoji">' + esc(g.emoji) + '</span>' +
        '<span class="cs-name">' + esc(g.name) + '</span>' +
        '<span class="cs-price">' + (owned ? '在用' : num(g.price) + '万') + '</span>' +
        '</button>';
    }).join('');
  }

  function treatsRow(s) {
    return s.treats.map(function (t) {
      const cls = 'cs-chip cs-treat' + (!t.unlocked ? ' locked' : '') + (t.afford ? '' : ' poor');
      const dis = !t.unlocked ? ' disabled' : '';
      const tip = !t.unlocked
        ? '需「' + t.tierName + '」档：' + t.note
        : (num(t.cost) + ' 万 · ' + t.note);
      return '<button class="' + cls + '" data-act="treat" data-id="' + esc(t.key) + '"' + dis +
        ' title="' + esc(tip) + '">' +
        '<span class="cs-emoji">' + esc(t.emoji) + '</span>' +
        '<span class="cs-name">' + esc(t.name) + '</span>' +
        '<span class="cs-price">' + num(t.cost) + '万</span>' +
        '</button>';
    }).join('');
  }

  function servicesRow(s) {
    return s.services.map(function (v) {
      const on = v.subscribed;
      const cls = 'cs-chip cs-svc' + (!v.unlocked ? ' locked' : '') + (on ? ' on' : '');
      const dis = !v.unlocked ? ' disabled' : '';
      const tip = !v.unlocked
        ? '需「' + v.tierName + '」档：' + v.note
        : (num(v.fee) + ' 万/月 · ' + v.note);
      return '<button class="' + cls + '" data-act="toggle-svc" data-id="' + esc(v.key) + '"' + dis +
        ' title="' + esc(tip) + '">' +
        '<span class="cs-emoji">' + esc(v.emoji) + '</span>' +
        '<span class="cs-name">' + esc(v.name) + '</span>' +
        '<span class="cs-price">' + (on ? '已订阅 ✓' : num(v.fee) + '万/月') + '</span>' +
        '</button>';
    }).join('');
  }

  function render() {
    if (!el.body || !Game.consume) return;
    const s = Game.consume.state();
    if (!s) return;
    // 签名：任何可影响展示的状态变化
    const next = [
      s.tier, s.age, s.canConsume ? 1 : 0, Math.round(s.netWorth),
      s.owned.map(function (g) { return g.key + '@' + g.value; }).join(','),
      s.subscribed.join(','),
      s.goods.filter(function (g) { return g.unlocked; }).length,
      s.goods.filter(function (g) { return g.held; }).length,
      s.spent, s.buys, s.treatCount,
    ].join('|');
    if (next === sig) return;
    sig = next;

    if (el.tier) el.tier.textContent = '';
    if (!s.canConsume) {
      el.body.innerHTML = '<div class="cs-empty">（18 岁起可以自主消费）</div>';
      return;
    }

    const owned = s.owned.length
      ? '<div class="cs-owned">在用 ' + s.owned.length + ' 件：' +
        s.owned.map(function (g) { return esc(g.emoji + g.name); }).join(' · ') + '</div>'
      : '';
    const stat = '<div class="cs-stat">累计消费 ' + num(s.spent) + ' 万 · 买入 ' + s.buys +
      ' 件 · 随心消费 ' + s.treatCount + ' 次</div>';

    el.body.innerHTML =
      tierBanner(s) +
      '<div class="cs-sec"><h4>🛍️ 耐用品 <span>买入后持续影响生活</span></h4>' +
      '<div class="cs-row">' + goodsRow(s) + '</div></div>' +
      '<div class="cs-sec"><h4>✨ 一次性消费 <span>即时兑换好心情</span></h4>' +
      '<div class="cs-row">' + treatsRow(s) + '</div></div>' +
      '<div class="cs-sec"><h4>📞 服务业 <span>每月付费，持续享受</span></h4>' +
      '<div class="cs-row">' + servicesRow(s) + '</div></div>' +
      owned + stat;
  }

  function onClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled || !Game.consume) return;
    const act = b.dataset.act;
    const id = b.dataset.id;
    let r = null;
    if (act === 'buy-good') r = Game.consume.buyGood(id);
    else if (act === 'sell-good') r = Game.consume.sellGood(id);
    else if (act === 'treat') r = Game.consume.useTreat(id);
    else if (act === 'toggle-svc') {
      const s = Game.consume.state();
      const on = s && s.subscribed.indexOf(id) >= 0;
      r = on ? Game.consume.unsubscribe(id) : Game.consume.subscribe(id);
    }
    if (r && !r.ok && r.reason) {
      b.classList.add('cs-deny');
      if (b.dataset.tip !== r.reason) { b.dataset.tip = r.reason; b.title = r.reason; }
      setTimeout(function () { b.classList.remove('cs-deny'); }, 600);
    }
    sig = '';
    render();
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - last < 300) return; // ~3fps 足够（消费状态变化慢）
    last = ts;
    render();
  }

  function boot() {
    try { build(); } catch (err) { console.error('[consumePanel] init failed', err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { render: render };
})();
