/* =========================================================================
 * 界面 · 单屏布局优化 (layout)
 * -------------------------------------------------------------------------
 * 目标：让主界面（人生在跑时的那一屏）在常见窗口尺寸下**不用滚动**即可看全。
 *
 * 做法（纯表现层，零业务改动）：
 *   1) 给 <html> 挂 `.screen-fit`，CSS 把页面切成「固定头 + 自适应主区」两段；
 *   2) 用 CSS 变量把实测可用高度下发（--fit-h / --fit-log），让日志卡片吃满剩余；
 *   3) 三列每列内部独立滚动（列内滚动而非整页滚动）；
 *   4) 若某一列仍然溢出，按 `.fit-tight` → `.fit-tighter` 两级降密度微调字号与间距；
 *   5) 窗口太矮 / 太窄（手机上竖屏）时自动摘掉 `.screen-fit`，交还给原有自然滚动。
 *
 * 只读 DOM 尺寸、只改 class 与 CSS 变量，不触碰 Game.state，也不依赖任何业务系统。
 * ========================================================================= */
Game.layout = (function () {
  const doc = document.documentElement;

  // 低于这些尺寸就不再强求单屏（交还原生的自然滚动，避免把内容压得不可用）
  const MIN_W = 1024; // 三列布局至少要放得下
  const MIN_H = 560;  // 太矮时弹窗/卡片无法共存

  let enabled = false;
  let fitted = false; // 是否已做到零溢出（仅用于对外报告）
  let sig = '';       // 上次成功档位的判定签名，避免每帧重复跑档位循环
  let raf = 0;
  let ro = null;
  let mo = null;

  function measure() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      apply();
    });
  }

  // 主区顶端的绝对位置（头/剧本条/行动区/各扩展盒的总高度），
  // 直接实测比逐项累加快且不会漏掉新增模块。
  function topOffset() {
    const grid = document.querySelector('.grid');
    if (!grid) return 0;
    return grid.getBoundingClientRect().top + (window.scrollY || 0);
  }

  // 视口里能用多少：视口高度 - 主区上方占位 - 页面上下 padding 余量
  function availH() {
    const vh = window.innerHeight || doc.clientHeight || 800;
    const pad = 12 + 20 + 8; // #app 上内边距 + 下内边距余量 + 缓冲
    return Math.round(vh - topOffset() - pad);
  }

  // 主区至少要有这么高，否则单屏没意义（会把三列压成一条缝）
  const MIN_GRID = 260;

  // 让日志卡片吃满它所在列剩下的高度（列内已经是 flex 纵排）
  function sizeLog() {
    const col = document.querySelector('.grid > section:nth-child(3)');
    if (!col) return;
    const log = col.querySelector('.log');
    const story = col.querySelector('.card'); // 第三列第一张卡：人生故事线
    if (!log) return;
    const colRect = col.getBoundingClientRect();
    const storyRect = story ? story.getBoundingClientRect() : { height: 0 };
    const gap = 16; // .grid gap
    const cardPad = 34 + 22; // 日志卡片左右/上下内边距
    const head = 0; // h2 已含在卡片内，用实测反推
    const storyH = storyRect.height || 0;
    const remain = colRect.height - storyH - gap;
    const logH = Math.max(120, Math.round(remain - cardPad - 18));
    doc.style.setProperty('--fit-log', logH + 'px');
  }

  // 溢出检测：第 1/2 列里「所有卡片自然高度之和」是否超过列高（含间距）。
  // 注意不能用 scrollHeight-clientHeight —— 列是 flex 容器且子项 min-height:0 时，
  // 卡片会被压扁到不溢出，但内容其实已经被裁掉了，检测会漏报。
  function overflowH() {
    const cols = document.querySelectorAll('.grid > section');
    const gap = 16;
    let worst = 0;
    for (let i = 0; i < cols.length; i++) {
      if (i === cols.length - 1) continue; // 最后一列：日志 flex 填充
      const cards = cols[i].querySelectorAll(':scope > .card');
      let need = 0;
      cards.forEach((c) => { need += c.scrollHeight; });
      if (cards.length > 1) need += gap * (cards.length - 1);
      const have = cols[i].clientHeight || 0;
      worst = Math.max(worst, Math.round(need - have));
    }
    return worst;
  }


  // 密度档位：内容太高时逐级收紧，直到列内不再溢出。
  // 最后两档都是「铺砖」（把三列拆成自适应细网格），fit-tile-2 是给矮屏的再收一档。
  const TIERS = ['', 'fit-tight', 'fit-tighter', 'fit-tile', 'fit-tile-2'];
  const ALL_TIER_CLS = ['fit-tight', 'fit-tighter', 'fit-tile', 'fit-tile-2'];
  const isTile = (n) => TIERS[n] === 'fit-tile' || TIERS[n] === 'fit-tile-2';
  let tier = 0;

  function applyTier(n) {
    ALL_TIER_CLS.forEach((c) => doc.classList.remove(c));
    if (n > 0) doc.classList.add(TIERS[n]);
    tier = n;
  }

  // 铺砖模式：主区吃满视口剩余高度（--fit-h 在 CSS 里作 max-height）。
  // 这里判断"卡片阵列自然高度"是否真的塞得进，塞得进才算达标（不滚动）。
  function tilesFit() {
    const grid = document.querySelector('.grid');
    if (!grid) return false;
    const cap = availH();
    return grid.scrollHeight <= cap + 2;
  }

  function apply() {
    const w = window.innerWidth || doc.clientWidth || 1280;
    const h = window.innerHeight || doc.clientHeight || 800;

    if (w < MIN_W || h < MIN_H) {
      // 小屏 / 矮窗：单屏无意义，交还原生滚动
      disable();
      return;
    }

    // 先戴上 .screen-fit 让头部压缩生效，再量真实可用高度
    if (!enabled) {
      enabled = true;
      doc.classList.add('screen-fit');
    }

    const avail = availH();
    if (avail < MIN_GRID) {
      // 头部（品牌/控制条/剧本/行动/扩展盒）本身就顶掉了大半屏，
      // 再挤也放不下三列 —— 交还原生滚动，避免把主区压成一条缝。
      disable();
      return;
    }

    // 首帧/布局尚未铺开时（卡片还没渲染）不做档位判定，否则会把
    // "当时刚好不溢出" 错当成达标并 latch 住，之后再也不会升级档位。
    const cardCount = document.querySelectorAll('.grid > section > .card').length;
    if (!cardCount) return;

    doc.style.setProperty('--fit-h', avail + 'px');

    // 判定签名：视口尺寸 + 卡片张数 + 头部总高。三者都不变时沿用上次档位，
    // 避免 ResizeObserver / MutationObserver 高频触发导致样式反复横跳。
    const nextSig = w + 'x' + h + ':' + cardCount + ':' + Math.round(topOffset()) + ':' + tier;
    if (nextSig === sig) {
      sizeLog();
      return;
    }
    sig = nextSig;

    // 顺着档位往下压：先收紧三列密度，最后两档改用「铺砖」平铺进可用面积
    let n = 0;
    while (n < TIERS.length) {
      applyTier(n);
      if (isTile(n)) {
        // 铺砖模式会把扩展盒改成横排，头部高度随之变化 —— 必须重新实测剩余高度，
        // 再用 --fit-h 让栅格吃满（CSS 里作为 max-height，超出则栅格内部滚动）。
        doc.style.setProperty('--fit-h', availH() + 'px');
        if (tilesFit()) break;
      } else {
        sizeLog();
        if (overflowH() <= 0) break;
      }
      n++;
    }
    fitted = n < TIERS.length - 1 || tilesFit();
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    doc.classList.remove('screen-fit');
    applyTier(0);
    doc.style.removeProperty('--fit-h');
    doc.style.removeProperty('--fit-log');
  }

  function init() {
    if (!document.querySelector('.grid')) return;
    // 页脚折叠：移动端无 hover，点一下展开/收起
    const foot = document.querySelector('footer');
    if (foot) {
      foot.addEventListener('click', () => {
        if (!enabled) return;
        foot.classList.toggle('open');
      });
    }
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(measure);
      ro.observe(document.body);
    }
    if (typeof MutationObserver === 'function') {
      // 行动区 / 合约卡 / 习惯 / 消费 / 金手指面板会改变主区顶端位置，结构一变就重算
      mo = new MutationObserver(measure);
      ['scenarioBar', 'actionBar', 'contractBox', 'apBox', 'habitBox', 'consumeBox', 'cheatBar']
        .forEach((id) => {
          const n = document.getElementById(id);
          if (n) mo.observe(n, { childList: true, subtree: true, attributes: true });
        });
    }
    window.addEventListener('resize', () => {
      fitted = false;
      applyTier(0);
      measure();
    });
    window.addEventListener('orientationchange', () => {
      fitted = false;
      applyTier(0);
      setTimeout(measure, 120);
    });
    // 字体就绪后再量一次，避免自定义字体导致的高度漂移
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => {});
    measure();
    // 启动后补量两拍（首帧时行动区/剧本条往往还没渲染完）
    setTimeout(measure, 60);
    setTimeout(measure, 400);
  }

  return {
    init,
    refresh: measure,
    isOn: () => enabled,
    state: () => ({ enabled, fitted, tier, avail: availH(), overflow: overflowH() }),
  };
})();
