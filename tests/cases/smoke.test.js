'use strict';
/* =========================================================================
 * 冒烟测试：跑完整人生 + 工程化红线检查
 * -------------------------------------------------------------------------
 * 覆盖路线图"验证方式"要求：无头 vm 按 <script> 顺序加载，loop.step() 推进
 * 多条人生，检查零异常与寿命/婚姻/职业/子女/抉择分布合理性。
 * ========================================================================= */
const fs = require('fs');
const path = require('path');
const { describe, it, assert } = require('../runner');
const h = require('../harness');

/* 偏好像素：优先点带资产指令的选项（顺带压测 B6 资产系统），否则点第一个可选项 */
function assetFriendly(ev, choices) {
  for (let i = 0; i < choices.length; i++) if (choices[i].asset) return i;
  for (let i = 0; i < choices.length; i++) if (!choices[i].condition) return i;
  return 0;
}

describe('冒烟 · 多条人生端到端', () => {
  const seeds = [11, 2026, 777, 31415, 99999, 20260918];
  const stats = [];

  for (const seed of seeds) {
    it('种子 ' + seed + ' 能跑完一生且状态合法', () => {
      const g = h.build({ quiet: true });
      g.reset(seed);
      assert.ok(snapshotOk(g.state), '开局状态不合法');
      g.runToDeath(130, assetFriendly);
      const s = g.state;
      assert.equal(s.person.alive, false, '130 岁前应当死亡');
      assert.ok(s.person.deathCause, '死亡应有死因');
      assert.ok(s.person.deathCause !== '', '死亡应有死因');
      assert.ok(snapshotOk(s), '结束时状态不合法（NaN/越界）');
      assert.ok(s.clock.age >= 1 && s.clock.age <= 125, '寿命异常：' + s.clock.age);
      assert.ok(s.person.decisions.count > 0, '一生应当至少触发一次抉择');
      assert.ok(Array.isArray(s.logLines) && s.logLines.length > 0, '应有日志');
      assert.equal(g.logs.filter((l) => l[0] === 'error').length, 0, '不应有 console.error');
      stats.push({
        seed,
        age: s.clock.age,
        married: !!(s.person.relationship && s.person.relationship.spouse),
        edu: (s.person.education && s.person.education.level) || '未知',
        wealth: s.person.wealth,
        decisions: s.person.decisions.count,
        kids: (s.person.relationship && s.person.relationship.children || []).length,
        dims: s.person.story ? s.person.story.dims : null,
      });
    });
  }

  it('分布合理：平均寿命落在人类合理区间，且有婚姻/教育/资产多样性', () => {
    const avgAge = stats.reduce((a, b) => a + b.age, 0) / stats.length;
    assert.range(avgAge, 30, 115, '平均寿命不合理：' + avgAge.toFixed(1));
    assert.ok(stats.every((x) => x.wealth != null && isFinite(x.wealth)), '财富应为有限数');
    assert.ok(stats.some((x) => x.married), '样本中应当有人结婚');
    assert.ok(stats.some((x) => x.edu !== '未知'), '样本中应当有人完成学业');
    assert.ok(stats.some((x) => x.dims), '样本中应当有故事积分');
  });

  it('抉择历史与轨迹齐全（history / timeline / 生命曲线）', () => {
    const g = h.build({ quiet: true });
    g.reset(4242);
    g.runToDeath(130, assetFriendly);
    const s = g.state;
    const timeline = g.Game.timeline.get();
    const curve = g.Game.timeline.curve();
    assert.ok(Array.isArray(timeline), '应有时间线数组');
    assert.ok(timeline.length > 0, '时间线不应为空');
    assert.ok(Array.isArray(curve), '应有生命曲线数据');
    assert.ok(curve.length > 0, '生命曲线不应为空');
    assert.ok(timeline.some((n) => n.kind === 'death'), '时间线应含死亡节点');
    assert.ok(s.person.decisions.history.length > 0, '抉择历史不应为空');
  });
});

function snapshotOk(s) {
  const p = s.person;
  for (const k of ['health', 'immunity', 'mood']) {
    if (!isFinite(p[k]) || p[k] < 0 || p[k] > 100) return false;
  }
  if (!isFinite(p.wealth)) return false;
  if (p.mental) {
    for (const k of ['stress', 'depression', 'trauma']) {
      if (!isFinite(p.mental[k]) || p.mental[k] < 0 || p.mental[k] > 100) return false;
    }
  }
  if (p.assets) {
    if (!isFinite(p.assets.mortgage) || p.assets.mortgage < 0) return false;
    for (const it of p.assets.houses.concat(p.assets.cars)) {
      if (!isFinite(it.value) || it.value < 0) return false;
    }
  }
  if (p.story) {
    for (const k in p.story.dims) {
      if (!isFinite(p.story.dims[k]) || p.story.dims[k] < 0 || p.story.dims[k] > 100) return false;
    }
  }
  return true;
}

describe('工程化红线 · 无外部依赖 / file:// 可运行', () => {
  const ROOT = h.ROOT;
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  it('index.html 不引用任何外部 http(s) 资源', () => {
    const bad = html.match(/(src|href)\s*=\s*"(https?:)?\/\/[^"]+"/gi) || [];
    assert.equal(bad.length, 0, '发现外链：' + bad.join(', '));
  });

  it('PWA 声明齐备（manifest + theme-color + viewport）', () => {
    assert.ok(/rel="manifest"/.test(html), '缺少 manifest 链接');
    assert.ok(/name="viewport"/.test(html), '缺少 viewport');
    assert.ok(/name="theme-color"/.test(html), '缺少 theme-color');
    const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    assert.ok(mf.name && mf.short_name, 'manifest 缺少名称');
    assert.equal(mf.display, 'standalone', 'manifest display 应为 standalone');
    assert.ok(mf.start_url, 'manifest 缺少 start_url');
    assert.ok(Array.isArray(mf.icons) && mf.icons.length > 0, 'manifest 缺少图标');
  });

  it('Service Worker 缓存清单覆盖本地静态资源且无外链', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    assert.ok(/addEventListener\('install'/.test(sw), 'sw 缺少 install 事件');
    assert.ok(/addEventListener\('fetch'/.test(sw), 'sw 缺少 fetch 事件');
    assert.ok(sw.indexOf('index.html') >= 0, 'sw 应预缓存 index.html');
    const urls = sw.match(/'(https?:)?\/\/[^']+'/g) || [];
    assert.equal(urls.length, 0, 'sw 不应缓存外部资源：' + urls.join(', '));
  });

  it('脚本加载顺序符合路线图（ns→bus→util→config→state→system→loop→systems→ui→main）', () => {
    const list = h.htmlScripts();
    const idx = (p) => list.indexOf(p);
    assert.ok(idx('js/core/ns.js') === 0, 'ns.js 必须最先');
    assert.ok(idx('js/core/bus.js') < idx('js/core/util.js'), 'bus 在 util 前');
    assert.ok(idx('js/core/util.js') < idx('js/config.js'), 'util 在 config 前');
    assert.ok(idx('js/config.js') < idx('js/core/state.js'), 'config 在 state 前');
    assert.ok(idx('js/core/loop.js') < idx('js/systems/clock.js'), 'loop 在 systems 前');
    assert.ok(idx('js/ui/hud.js') < idx('js/main.js'), 'hud 在 main 前');
    assert.ok(list[list.length - 1] === 'js/main.js', 'main.js 必须最后加载');
    for (const f of list) {
      assert.ok(fs.existsSync(path.join(h.ROOT, f)), '脚本缺失：' + f);
    }
  });

  it('所有 js 文件不含 require/import 外部包（纯前端）', () => {
    const bad = [];
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) { if (f !== 'tests') walk(p); continue; }
        if (!f.endsWith('.js')) continue;
        const src = fs.readFileSync(p, 'utf8');
        if (/^\s*(import\s.+from|const\s.+\s*=\s*require\()/m.test(src)) bad.push(path.relative(ROOT, p));
      }
    };
    walk(path.join(ROOT, 'js'));
    walk(path.join(ROOT, 'css'));
    assert.equal(bad.length, 0, '发现模块化引入：' + bad.join(', '));
  });
});
