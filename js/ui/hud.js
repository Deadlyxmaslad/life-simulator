/* =========================================================================
 * 界面 · HUD 渲染与操控 (hud)
 * -------------------------------------------------------------------------
 * 只读 Game.state 做渲染（不写业务逻辑），订阅关键事件刷新日志/遮罩。
 * 渲染用独立 rAF 循环，按帧读取最新数值，避免与游戏 tick 频率耦合。
 * ========================================================================= */
Game.hud = (function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;

  const el = {};
  function q(id) { return document.getElementById(id); }

  // 渲染去重：innerHTML 内容未变则跳过重建（避免每帧反复销毁/创建 DOM、强制重排、GC 抖动）。
  // 仅做等号比较——输出字符串相同即结果完全相同，语义零改变。
  const _htmlCache = new Map();
  function setHTML(node, html) {
    if (_htmlCache.get(node) === html) return;
    _htmlCache.set(node, html);
    node.innerHTML = html;
  }

  const stageNames = {
    health: '健康', immunity: '免疫力', mood: '心情',
  };

  function init() {
    [
      'healthVal', 'healthBar', 'immunityVal', 'immunityBar', 'moodVal', 'moodBar',
      'ageNum', 'stageText', 'dateLine', 'expectTag', 'eraChip',
      'eduIcon', 'eduStage', 'eduSub', 'iqVal', 'iqBar', 'knowledgeVal', 'knowledgeBar', 'eduNext',
      'traitList', 'traitSummary', 'socialStat', 'friendList',
      'stressVal', 'stressBar', 'stressLevel', 'depVal', 'depBar', 'traumaVal', 'traumaBar', 'mentalNote',
      'needSatietyVal', 'needSatietyBar', 'needEnergyVal', 'needEnergyBar',
      'needHygieneVal', 'needHygieneBar', 'needFunVal', 'needFunBar', 'needsNote',
      'jobStatus', 'jobTitle', 'jobIncome', 'jobWealth', 'jobNote',
      'invHint', 'invList', 'invNetRow', 'invNet',
      'assetNet', 'assetCount', 'assetDebtRow', 'assetDebt', 'assetList', 'assetNote',
      'storyCount', 'storyLines', 'storyNote', 'sumStory', 'sumRadar', 'sumEnding',
      'famStatus', 'famSpouse', 'famChildren', 'famNote',
      'originTag', 'parentRows', 'siblingInfo', 'estateNote',
      'weatherIcon', 'tempVal', 'weatherName', 'weatherDesc', 'envBadge',
      'diseaseList', 'log',
      'statusPill', 'statusText', 'btnPlay', 'btnStep', 'btnReset', 'speedGroup', 'actionBar', 'scenarioBar',
      'btnAutoPause',
      'overlay', 'sumTitle', 'sumAge', 'sumDays', 'sumDis', 'sumPeak', 'sumCause', 'sumExtra', 'sumRestart',
      'achCount', 'sumAch', 'sumTimeline', 'sumCurve', 'sumMods', 'sumReport', 'reportNote',
      'btnSave', 'savePanel', 'spClose', 'spSlots',
      'btnAudio',
      'btnBoard', 'boardPanel', 'lbList', 'lbClear', 'lbClose',
      'scoreBig', 'scoreRank', 'scoreParts',
      'decision', 'decEmoji', 'decTitle', 'decDesc', 'decChoices',
    ].forEach((id) => (el[id] = q(id)));

    buildSpeedButtons();
    buildScenarioBar();
    bindControls();
    bindActionBar();
    wireEvents();
    syncAudioBtn();
    updateAutoPauseBtn();
    requestAnimationFrame(renderLoop);
  }

  function buildSpeedButtons() {
    C.time.speeds.forEach((sp, i) => {
      const b = document.createElement('button');
      b.className = 'btn' + (i === st.s.speedIndex ? ' active' : '');
      b.textContent = sp.label;
      b.dataset.i = i;
      b.onclick = () => Game.loop.setSpeed(i);
      el.speedGroup.appendChild(b);
    });
  }

  function buildScenarioBar() {
    if (!el.scenarioBar || !Game.scenario) return;
    el.scenarioBar.innerHTML = '';
    const cur = Game.scenario.key();
    Game.scenario.list().forEach((sc) => {
      const b = document.createElement('button');
      b.className = 'sc-chip' + (sc.key === cur ? ' active' : '');
      b.title = sc.desc;
      b.textContent = sc.label;
      b.dataset.k = sc.key;
      b.onclick = () => {
        Game.scenario.set(sc.key);
        buildScenarioBar();
      };
      el.scenarioBar.appendChild(b);
    });
    const note = document.createElement('span');
    note.className = 'sc-note';
    note.textContent = '难度·剧本';
    el.scenarioBar.insertBefore(note, el.scenarioBar.firstChild);
  }

  function bindActionBar() {
    if (!el.actionBar) return;
    el.actionBar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !b.dataset.act) return;
      Game.actions.do(b.dataset.act);
    });
  }

  function renderActionBar() {
    if (!el.actionBar || !Game.actions) return;
    const list = Game.actions.list();
    // 仅在结构变化或冷却变化时重建，避免每帧重排
    const sig = list.map((a) => a.id + ':' + (a.ready ? 1 : 0) + ':' + a.cd + ':' + (a.available ? 1 : 0) + ':' + a.tier).join(',');
    if (el.actionBar.dataset.sig === sig) return;
    el.actionBar.dataset.sig = sig;
    el.actionBar.innerHTML =
      '<span class="ab-label">🎯 行动</span>' +
      list
        .map((a) => {
          if (!a.available) return ''; // 情境不满足则隐藏
          const cd = a.cd > 0 ? '<span class="ab-cd">' + a.cd + '</span>' : '';
          const lv = a.tier ? '<span class="ab-lv">' + a.tier + '</span>' : '';
          const tip = a.tier ? a.name + ' · 熟练度 ' + a.mastery + '（' + a.tier + '·效果增强）' : a.name;
          return (
            '<button class="ab-btn' + (a.ready ? '' : ' cooling') + '" data-act="' + a.id + '"' +
            (a.ready ? '' : ' disabled') + ' title="' + tip + '">' +
            '<span class="ab-emoji">' + a.emoji + '</span><span class="ab-name">' + a.name + '</span>' + lv + cd + '</button>'
          );
        })
        .join('');
  }

  function bindControls() {
    el.btnPlay.onclick = () => Game.loop.toggle();
    el.btnStep.onclick = () => Game.loop.step();
    el.btnReset.onclick = () => Game.reset();
    // 自动暂停（参与感）开关：切换后即时生效，仅影响"自动播放"时的停留节奏
    if (el.btnAutoPause) {
      el.btnAutoPause.onclick = () => {
        st.s.autoPause = !st.s.autoPause;
        updateAutoPauseBtn();
      };
    }
    el.sumRestart.onclick = () => Game.reset();
    // 音效 / 背景音乐开关（默认静音，点击即解锁 AudioContext）
    if (el.btnAudio) el.btnAudio.onclick = () => { if (Game.audio) Game.audio.toggle(); };
    // 存档面板
    el.btnSave.onclick = () => {
      const open = el.savePanel.classList.toggle('open');
      if (open) renderSlots();
    };
    el.spClose.onclick = () => el.savePanel.classList.remove('open');
    // 高分榜面板
    el.btnBoard.onclick = showBoard;
    el.lbClose.onclick = () => el.boardPanel.classList.remove('show');
    el.lbClear.onclick = () => {
      Game.score.clearBoard();
      el.lbList.innerHTML = fmtLb([], st.s.lastScore ? st.s.lastScore.entryId : null);
    };
    el.spSlots.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !b.dataset.act) return;
      const slot = +b.dataset.slot;
      if (b.dataset.act === 'save') {
        Game.save.save(slot);
        renderSlots();
      } else if (b.dataset.act === 'load') {
        doLoad(slot);
      } else if (b.dataset.act === 'del') {
        Game.save.remove(slot);
        renderSlots();
      } else if (b.dataset.act === 'autoload') {
        doLoadAuto();
      }
    });
  }

  function renderSlots() {
    el.spSlots.innerHTML = '';
    for (let s = 1; s <= Game.save.SLOTS; s++) {
      const info = Game.save.info(s);
      const row = document.createElement('div');
      row.className = 'sp-slot' + (info ? ' filled' : '');
      let meta = '空存档位';
      if (info) {
        const d = new Date(info.ts);
        meta =
          info.age + '岁 · ' + (info.level || '—') + ' · ' +
          d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() +
          ' ' + u2(d.getHours()) + ':' + u2(d.getMinutes());
      }
      row.innerHTML =
        '<div class="sp-info"><b>槽位 ' + s + '</b>' +
        (info ? ' · ' + (info.gender === '女' ? '👧' : '👦') + info.name : '') +
        '<span class="sp-meta">' + meta + '</span></div>';
      const acts = document.createElement('div');
      acts.className = 'sp-acts';
      const mk = (act, label, cls) => {
        const b = document.createElement('button');
        b.className = 'btn ' + (cls || '');
        b.textContent = label;
        b.dataset.act = act;
        b.dataset.slot = s;
        acts.appendChild(b);
      };
      mk('save', '存档');
      if (info) {
        mk('load', '读档', 'primary');
        mk('del', '✕', 'danger');
      }
      row.appendChild(acts);
      el.spSlots.appendChild(row);
    }
    // 自动续档：只要有未完成进度就单独展示一行，可一键读回（由引擎在关页/跨年时自动维护）
    const ai = Game.save.autoInfo();
    if (ai) {
      const row = document.createElement('div');
      row.className = 'sp-slot filled auto';
      const d = new Date(ai.ts);
      row.innerHTML =
        '<div class="sp-info"><b>自动续档</b>' +
        (ai.gender === '女' ? ' 👧' : ' 👦') + ai.name +
        '<span class="sp-meta">' + ai.age + '岁 · ' +
        d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + ' ' +
        u2(d.getHours()) + ':' + u2(d.getMinutes()) + '（关页自动保存）</span></div>';
      const acts = document.createElement('div');
      acts.className = 'sp-acts';
      const mk = (act, label, cls) => {
        const b = document.createElement('button');
        b.className = 'btn ' + (cls || '');
        b.textContent = label;
        b.dataset.act = act;
        b.dataset.slot = 'auto';
        acts.appendChild(b);
      };
      mk('autoload', '读档', 'primary');
      row.appendChild(acts);
      el.spSlots.appendChild(row);
    }
  }
  function u2(n) { return (n < 10 ? '0' : '') + n; }

  // 读档 / 自动续上后刷新画面：关掉弹层与结算、重建日志、恢复待处理抉择、同步速度与状态
  function refreshAfterLoad() {
    el.savePanel.classList.remove('open');
    el.overlay.classList.remove('show');
    hideDecision();
    reloadLog();
    if (st.s.pendingDecision) showDecision(st.s.pendingDecision.ev);
    [...el.speedGroup.children].forEach((b, i) => b.classList.toggle('active', i === st.s.speedIndex));
    updateStatusPill();
  }
  function doLoad(slot) {
    if (!Game.save.load(slot)) return;
    refreshAfterLoad();
  }
  function doLoadAuto() {
    if (!Game.save.autoLoad()) return;
    refreshAfterLoad();
  }

  function reloadLog() {
    el.log.innerHTML = '';
    (st.s.logLines || []).forEach((line) => {
      const div = document.createElement('div');
      div.className = 'line ' + line.level;
      const t = document.createElement('span');
      t.className = 'time';
      t.textContent = line.time;
      const m = document.createElement('span');
      m.className = 'msg';
      m.textContent = line.msg;
      div.appendChild(t);
      div.appendChild(m);
      el.log.appendChild(div);
    });
    el.log.scrollTop = el.log.scrollHeight;
  }

  function wireEvents() {
    bus.on('log', appendLog);
    bus.on('state:reset', () => {
      el.log.innerHTML = '';
      el.overlay.classList.remove('show');
      el.boardPanel.classList.remove('show');
      hideDecision();
    });
    bus.on('speed:change', (e) => {
      [...el.speedGroup.children].forEach((b, i) => b.classList.toggle('active', i === e.index));
    });
    bus.on('run:change', updateStatusPill);
    bus.on('death', showSummary);
    bus.on('state:reset', updateStatusPill);
    bus.on('decision:ask', (e) => showDecision(e.ev));
    bus.on('decision:answered', () => { hideDecision(); updateStatusPill(); });
    bus.on('audio:change', syncAudioBtn);
    bus.on('asset:change', renderAssets);
    bus.on('story:ending', renderStorySummary);
    // 自动暂停提示：告诉玩家"为什么停了下来"，强化参与感而非困惑
    bus.on('loop:autopause', (e) => showAutoPauseToast(e && e.reason));
    // 读档 / 自动续上后统一刷新画面（手动读档与开局自动续上共用）
    bus.on('state:loaded', refreshAfterLoad);
  }

  // 自动暂停开关按钮：反映当前开关态（默认开）
  function updateAutoPauseBtn() {
    if (!el.btnAutoPause) return;
    const on = st.s.autoPause;
    el.btnAutoPause.classList.toggle('on', on);
    el.btnAutoPause.classList.toggle('off', !on);
    el.btnAutoPause.textContent = on ? '⏸ 自动暂停' : '▶ 连续播放';
    el.btnAutoPause.title = on
      ? '开启中：每月交界 / 每次事件弹出都会自动暂停，给你停留与参与的空间（点击关闭）'
      : '已关闭：一路连续快进，不再在每月 / 事件处停留（点击开启）';
  }

  // 自动暂停浮层提示：短暂停留后淡出，说明"为何暂停"
  let apToastTimer = null;
  function showAutoPauseToast(reason) {
    if (!el.btnAutoPause) return;
    let host = document.getElementById('apToast');
    if (!host) {
      host = document.createElement('div');
      host.id = 'apToast';
      host.className = 'ap-toast';
      document.body.appendChild(host);
    }
    const text = reason === 'event'
      ? '⏸ 已自动暂停 · 有事件等你抉择，读完再继续'
      : '⏸ 已自动暂停 · 又长了一岁，看看这一年发生了什么';
    host.textContent = text;
    host.classList.add('show');
    if (apToastTimer) clearTimeout(apToastTimer);
    apToastTimer = setTimeout(() => host.classList.remove('show'), 2600);
  }

  // 顶栏音效按钮：默认静音（尊重用户），点击后解锁 AudioContext
  function syncAudioBtn() {
    if (!el.btnAudio || !Game.audio) return;
    const on = Game.audio.isEnabled();
    el.btnAudio.textContent = on ? '🔊 音效' : '🔇 静音';
    el.btnAudio.classList.toggle('active', on);
    el.btnAudio.title = on ? '音效 / 背景音乐：开（点击静音）' : '音效 / 背景音乐：关（默认静音，点击开启）';
  }

  /* -------------------- 抉择弹窗 -------------------- */
  function showDecision(ev) {
    const title = String(ev.title);
    el.decEmoji.textContent = (title.match(/^\S+/) || ['🧭'])[0];
    el.decTitle.textContent = title.replace(/^\S+\s+/, '');
    el.decDesc.textContent = ev.desc || '';
    el.decChoices.innerHTML = '';
    ev.choices.forEach((ch, i) => {
      const enabled = Game.decisions.choiceEnabled(ch);
      const b = document.createElement('button');
      b.className = 'dchoice' + (ch.risk ? ' risky' : '');
      b.disabled = !enabled;
      b.innerHTML =
        '<span class="dc-label">' + ch.label + '</span>' +
        (ch.risk ? '<span class="dc-badge">🎲 有风险</span>' : '');
      b.onclick = () => { if (!b.disabled) Game.decisions.choose(i); };
      el.decChoices.appendChild(b);
    });
    el.decision.classList.add('show');
    updateStatusPill();
  }
  function hideDecision() {
    el.decision.classList.remove('show');
  }

  function appendLog(entry) {
    const line = document.createElement('div');
    line.className = 'line ' + entry.level;
    const t = document.createElement('span');
    t.className = 'time';
    t.textContent = entry.time;
    const m = document.createElement('span');
    m.className = 'msg';
    m.textContent = entry.msg;
    line.appendChild(t);
    line.appendChild(m);
    el.log.appendChild(line);
    // 限制 DOM 行数
    while (el.log.childElementCount > C.log.maxLines) {
      el.log.removeChild(el.log.firstChild);
    }
    el.log.scrollTop = el.log.scrollHeight;
  }

  function showSummary(e) {
    const s = st.s;
    el.sumAge.textContent = s.clock.age;
    el.sumDays.textContent = s.stats.daysAlive;
    el.sumDis.textContent = s.stats.diseaseCount;
    el.sumPeak.textContent = Math.round(s.stats.peakSeverity);
    const p = s.person;
    const edu = p.education;
    el.sumCause.textContent = '死因：' + (p.deathCause || e.cause) + (edu ? ' · 学历：' + edu.level : '');
    // 一生的"标签"：职业 · 家庭 · 财产
    const parts = [];
    if (p.family) parts.push('出身·' + p.family.origin);
    if (p.career && p.career.job) parts.push((p.career.phase === 'retired' ? '退休' : '') + p.career.job);
    if (p.relationship) {
      parts.push(p.relationship.spouse || p.relationship.married ? '已婚' : (p.relationship.widowed ? '丧偶' : (p.relationship.divorced ? '离异' : '未婚')));
      if (p.relationship.children.length) parts.push(p.relationship.children.length + ' 名子女');
    }
    if (p.wealth != null) parts.push('财产 ' + p.wealth.toFixed(1) + ' 万');
    if (p.invest && p.invest.opened) parts.push('投资' + (p.invest.realized >= 0 ? '盈' : '亏') + Math.abs(p.invest.realized).toFixed(0) + '万·交易' + p.invest.trades + '笔');
    if (p.social) parts.push('挚友 ' + p.social.friends.filter((f) => f.quality >= 55).length + ' / 结识 ' + p.social.met);
    if (p.personality) parts.push(Game.personality.summary());
    if (p.mental) parts.push('心境峰值·压力' + Math.round(p.mental.peakStress) + '/抑郁' + Math.round(p.mental.peakDepression));
    el.sumExtra.textContent = parts.join(' · ') || '平淡一生';
    if (el.sumTitle) el.sumTitle.textContent = (p.gender === '女' ? '她' : '他') + '的一生';
    renderAchievements();
    renderTimeline();
    renderCurve();
    renderStorySummary();
    renderScore();
    renderSumMods();
    renderReport();
    el.overlay.classList.add('show');
    updateStatusPill();
  }

  // —— 结算页：人生评分 ——
  function renderScore() {
    const ls = st.s.lastScore;
    if (!el.scoreBig) return;
    if (!ls) { el.scoreBig.textContent = '—'; el.scoreRank.textContent = ''; el.scoreParts.innerHTML = ''; return; }
    el.scoreBig.textContent = ls.score;
    el.scoreRank.textContent = ls.rank ? ('历史第 ' + ls.rank + ' 名 · 共 ' + ls.total + ' 局') : '（本局未上榜）';
    el.scoreParts.innerHTML = ls.breakdown
      .map((b) => '<div class="sp-part"><span class="sp-l">' + b.label + ' <em>' + b.sub + '</em></span><span class="sp-p">' + (b.pts >= 0 ? '+' : '') + b.pts + '</span></div>')
      .join('');
  }

  // —— 结算页：金手指三本账（J7）——
  // 各模块各自报账（只读各自 state 子树，不合并计算）；三扇门一扇都没开就是"纯净"。
  function renderSumMods() {
    if (!el.sumMods) return;
    const s = st.s;
    const acc = [];
    if (s.hex && (s.hex.on || s.hex.spent > 0)) {
      acc.push({ icon: '🧬', name: '海克斯', sub: '累计消耗 ' + Math.round(s.hex.spent || 0) + ' HE' + (s.hex.he > 0 ? ' · 余 ' + Math.round(s.hex.he) : '') });
    }
    if (s.tycoon && (s.tycoon.on || s.tycoon.injected > 0)) {
      acc.push({ icon: '💰', name: '神壕', sub: '累计注入 ' + Math.round(s.tycoon.injected || 0) + ' 万' });
    }
    if (s.datalize && (s.datalize.on || s.datalize.spent > 0)) {
      acc.push({ icon: '📊', name: '数据化', sub: '累计消耗 ' + Math.round(s.datalize.spent || 0) + ' DP' });
    }
    if (!acc.length) {
      el.sumMods.innerHTML = '<div class="mod-chip pure">🪶 本局纯净 —— 未动用任何金手指，每一步都是自己的</div>';
      return;
    }
    el.sumMods.innerHTML = acc
      .map((m) => '<div class="mod-chip"><b>' + m.icon + ' ' + m.name + '</b><span>' + m.sub + '</span></div>')
      .join('');
  }

  // —— 结算页：人生报告卡（v2.0.0）——
  // 从 Game.report 读取报告对象，渲染为结构化卡片供玩家浏览与截图分享。
  // 报告由 report.js 在 death 事件时自动生成并存入 localStorage（top20）。
  function renderReport() {
    if (!el.sumReport || !Game.report) return;
    const r = st.s.lastReport;
    if (!r) { el.sumReport.innerHTML = '<div class="empty">报告生成中…</div>'; return; }
    el.reportNote.textContent = '种子 ' + r.base.seed + ' · ' + r.base.yearStart + '–' + r.base.yearEnd;

    const tags = r.tags.map((t) => t.emoji + t.name).join(' · ') || '—';
    const ach = r.achKeys.length;
    const dims = r.story.dims || {};
    const dimList = ['ambition', 'kindness', 'adventure', 'knowledge', 'vitality'];
    const dimNames = { ambition: '雄心', kindness: '善心', adventure: '冒险', knowledge: '智识', vitality: '活力' };
    const dimBar = dimList.map((k) => {
      const v = dims[k] || 0;
      return '<span class="rp-dim"><b>' + dimNames[k] + '</b><i style="width:' + v + '%"></i><em>' + v + '</em></span>';
    }).join('');
    const mods = [];
    if (r.cheats.hex > 0) mods.push('🧬 ' + r.cheats.hex + ' HE');
    if (r.cheats.tycoon > 0) mods.push('💰 ' + r.cheats.tycoon + ' 万');
    if (r.cheats.datalize > 0) mods.push('📊 ' + r.cheats.datalize + ' DP');
    const modStr = mods.length ? mods.join(' · ') : '🪶 纯净';

    el.sumReport.innerHTML =
      '<div class="rp-header">' +
        '<span class="rp-name">' + esc(r.base.name) + '</span>' +
        '<span class="rp-score">' + r.score + ' 分</span>' +
      '</div>' +
      '<div class="rp-row"><span>享年</span><b>' + r.base.age + ' 岁</b></div>' +
      '<div class="rp-row"><span>死因</span><b>' + esc(r.base.cause) + '</b></div>' +
      '<div class="rp-row"><span>学历</span><b>' + esc(r.life.education) + ' · 智力 ' + r.life.iq + '</b></div>' +
      '<div class="rp-row"><span>职业</span><b>' + esc(r.life.job) + (r.life.workYears ? ' · 工龄 ' + r.life.workYears + ' 年' : '') + '</b></div>' +
      '<div class="rp-row"><span>家庭</span><b>' +
        (r.relInfo.married ? '已婚' : (r.relInfo.divorced ? '离异' : (r.relInfo.widowed ? '丧偶' : '未婚'))) +
        (r.relInfo.children ? ' · ' + r.relInfo.children + ' 名子女' : '') + '</b></div>' +
      '<div class="rp-row"><span>财富</span><b>' + r.fin.wealth + ' 万</b>' +
        (r.fin.houses ? ' · ' + r.fin.houses + ' 套房' : '') +
        (r.fin.cars ? ' · ' + r.fin.cars + ' 辆车' : '') + '</div>' +
      '<div class="rp-row"><span>社交</span><b>挚友 ' + r.relInfo.friends + ' · 结识 ' + r.relInfo.met + '</b></div>' +
      '<div class="rp-row"><span>心境</span><b>压力峰值 ' + r.mind.peakStress + ' · 抑郁峰值 ' + r.mind.peakDepression + '</b></div>' +
      '<div class="rp-row"><span>成就</span><b>' + ach + ' 枚</b></div>' +
      '<div class="rp-row"><span>合约</span><b>达成 ' + r.contracts.kept + ' · 未达成 ' + r.contracts.failed + '</b></div>' +
      '<div class="rp-row"><span>金手指</span><b>' + modStr + '</b></div>' +
      '<div class="rp-row"><span>结局</span><b>' + esc(r.story.ending) + '</b></div>' +
      '<div class="rp-row"><span>底色</span><b>' + tags + '</b></div>' +
      '<div class="rp-dims">' + dimBar + '</div>' +
      (r.roads.length ? '<div class="rp-row rp-roads"><span>未竟</span><b>' + r.roads.map((x) => x.emoji || '').join('') + ' ' + r.roads.map((x) => x.name || '').join('、') + '</b></div>' : '');
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // —— 高分榜面板 ——
  // 高分榜条目的模块标记：只标注"本局开过哪些金手指"，不分榜
  const MOD_ICON = { hex: '🧬', tycoon: '💰', datalize: '📊' };
  function lbMods(e) {
    const list = (e && e.mods) || [];
    if (!list.length) return '';
    const icons = list.map((id) => MOD_ICON[id] || '').join('');
    return icons ? ' · ' + icons : '';
  }

  function fmtLb(list, hiId) {
    if (!list || !list.length) return '<div class="empty">还没有记录，先好好活完一生吧。</div>';
    return list
      .map(
        (e, i) =>
          '<div class="lb-row' + (e.id === hiId ? ' me' : '') + '">' +
          '<span class="lb-rank">' + (i + 1) + '</span>' +
          '<span class="lb-name">' + (e.gender === '女' ? '👧' : '👦') + ' ' + e.name + (e.id === hiId ? ' ◀本局' : '') + '</span>' +
          '<span class="lb-meta">' + e.age + '岁 · ' + (e.level || '—') + ' · ' + (e.net || 0) + '万 · ' + (e.ach || 0) + '成就' + lbMods(e) + '</span>' +
          '<span class="lb-score">' + e.score + '</span></div>'
      )
      .join('');
  }
  function showBoard() {
    el.lbList.innerHTML = fmtLb(Game.score.loadBoard(), st.s.lastScore ? st.s.lastScore.entryId : null);
    el.boardPanel.classList.add('show');
  }

  // —— 结算页：生命曲线（健康/心情/免疫 0-100，财富按峰值归一） ——
  function renderCurve() {
    const cur = Game.timeline.curve();
    if (!el.sumCurve) return;
    if (cur.length < 2) {
      el.sumCurve.innerHTML = '<div class="empty">曲线数据不足。</div>';
      return;
    }
    const W = 380, H = 130, P = 10;
    const maxAge = Math.max(1, cur[cur.length - 1].age);
    const maxW = Math.max(50, cur.reduce((m, c) => Math.max(m, c.wealth), 0));
    const x = (a) => (P + (a / maxAge) * (W - 2 * P)).toFixed(1);
    const y = (v) => (P + (1 - v / 100) * (H - 2 * P)).toFixed(1);
    const yw = (v) => (P + (1 - v / maxW) * (H - 2 * P)).toFixed(1);
    const poly = (key, color, scaleY, dash) => {
      const pts = cur.map((c) => x(c.age) + ',' + scaleY(c[key])).join(' ');
      return '<polyline fill="none" stroke="' + color + '" stroke-width="1.8" ' +
        (dash ? 'stroke-dasharray="4 3" ' : '') + 'points="' + pts + '"/>';
    };
    el.sumCurve.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="curve-svg" preserveAspectRatio="none">' +
      '<line x1="' + P + '" y1="' + (H - P) + '" x2="' + (W - P) + '" y2="' + (H - P) + '" stroke="rgba(255,255,255,0.15)"/>' +
      poly('immunity', '#b58cff', y) + poly('mood', '#ffcf5c', y) +
      poly('health', '#4cd97b', y) + poly('wealth', '#5ac8fa', yw, true) +
      '</svg>' +
      '<div class="curve-cap">0 岁 → ' + maxAge + ' 岁 · 财富峰值 ' + maxW + ' 万（虚线，独立刻度）</div>';
  }

  // —— 结算页：成就徽章 ——
  function renderAchievements() {
    const all = Game.achievements.all();
    const got = st.s.person.achievements || {};
    const n = all.filter((a) => got[a.id]).length;
    el.achCount.textContent = n + ' / ' + all.length;
    el.sumAch.innerHTML = all
      .map(
        (a) =>
          '<div class="ach' + (got[a.id] ? ' got' : '') + '" title="' + a.desc + '">' +
          '<span class="ach-e">' + (got[a.id] ? a.emoji : '🔒') + '</span>' +
          '<span class="ach-t">' + a.title + '</span></div>'
      )
      .join('');
  }

  // —— 结算页：人生轨迹时间线 ——
  const TL_KINDS = [
    ['edu', '教育'],
    ['work', '事业'],
    ['family', '家庭'],
    ['social', '社交'],
    ['choice', '抉择'],
    ['health', '健康'],
  ];
  function renderTimeline() {
    const tl = Game.timeline.get();
    const maxAge = Math.max(1, st.s.clock.age);
    let html =
      '<div class="tl-axis"><span>出生</span><span>' + Math.round(maxAge / 2) + '岁</span><span>' + maxAge + '岁</span></div>';
    for (const [k, name] of TL_KINDS) {
      const evs = tl.filter((e) => e.kind === k);
      if (!evs.length) continue;
      html +=
        '<div class="tl-rail"><span class="tl-name">' + name + '</span><div class="tl-track">' +
        evs
          .map(
            (e) =>
              '<i class="tl-dot tl-' + e.kind + '" style="left:' +
              (e.age / maxAge * 100).toFixed(1) + '%" title="' + e.age + '岁 · ' + e.label + '">' +
              e.emoji + '</i>'
          )
          .join('') +
        '</div></div>';
    }
    el.sumTimeline.innerHTML = html;
  }

  function updateStatusPill() {
    const p = el.statusPill;
    p.classList.remove('running', 'paused', 'dead');
    if (st.s.pendingDecision) {
      p.classList.add('paused');
      el.statusText.textContent = '需你抉择';
      return;
    }
    if (!st.s.person.alive) {
      p.classList.add('dead');
      el.statusText.textContent = '已离世';
      el.btnPlay.disabled = true;
      el.btnPlay.textContent = '· 结束 ·';
    } else if (st.s.running) {
      p.classList.add('running');
      el.statusText.textContent = '流逝中';
      el.btnPlay.disabled = false;
      el.btnPlay.textContent = '⏸ 暂停';
    } else {
      p.classList.add('paused');
      el.statusText.textContent = st.s.clock.tick > 0 ? '已暂停' : '未开始';
      el.btnPlay.disabled = false;
      el.btnPlay.textContent = st.s.clock.tick > 0 ? '▶ 继续' : '▶ 开始一生';
    }
  }

  /* -------------------- 每帧渲染 -------------------- */
  let lastRender = 0;
  function renderLoop(ts) {
    requestAnimationFrame(renderLoop);
    if (ts - lastRender < 50) return; // ~20fps 足够
    lastRender = ts;
    renderVitals();
    renderClock();
    renderPersonality();
    renderMental();
    renderNeeds();
    renderEducation();
    renderSocial();
    renderCareer();
    renderInvest();
    renderAssets();
    renderStory();
    renderFamily();
    renderFamilyOrigin();
    renderWeather();
    renderDiseases();
    renderActionBar();
  }

  function renderVitals() {
    const p = st.s.person;
    bar('health', p.health);
    bar('immunity', p.immunity);
    bar('mood', p.mood);
  }
  function bar(key, val) {
    const v = Math.round(val);
    el[key + 'Val'].textContent = v + ' / 100';
    const fill = el[key + 'Bar'];
    fill.style.width = v + '%';
    fill.classList.toggle('low', v < 25);
  }

  function renderClock() {
    const c = st.s.clock;
    el.ageNum.textContent = c.age;
    el.stageText.textContent = Game.lifespan.stageOf(c.age);
    el.dateLine.textContent =
      c.year + ' 年 · ' + c.month + ' 月 ' + c.day + ' 日 · ' +
      C.seasonMeta[c.season].emoji + ' ' + C.seasonMeta[c.season].name + '季';
    if (el.eraChip && Game.era) {
      const e = Game.era.current();
      el.eraChip.textContent = e.emoji + ' ' + e.name + ' · ' + e.tag;
    }
    el.expectTag.textContent =
      c.age < 1
        ? '预期寿命 · 待揭晓'
        : '预期寿命 · 约 ' + Game.lifespan.lifeExpectancy() + ' 岁';
  }

  function renderPersonality() {
    const pers = st.s.person.personality;
    if (!pers || !el.traitList) return;
    const base = Game.personality.base() || pers;
    const delta = Game.personality.delta();
    setHTML(el.traitList, Game.personality.dims
      .map((d) => {
        const v = pers[d.key];
        const b = base[d.key];
        const dv = delta[d.key] || 0;
        const lb = Game.personality.label(d.key, v);
        const badge = Math.abs(dv) >= 2
          ? '<span class="pdelta ' + (dv > 0 ? 'up' : 'down') + '">本性' + (dv > 0 ? '+' : '') + dv + '</span>'
          : '';
        return (
          '<div class="vital"><div class="row"><span>' + d.name +
          ' <b class="tr">' + lb + '</b>' + badge + '</span><span class="val">' + v +
          '</span></div><div class="bar pers"><i style="width:' + v + '%"></i><u class="pbase" style="left:' + b + '%"></u></div></div>'
        );
      })
      .join(''));
    let sum = '性格画像：' + Game.personality.summary();
    const md = Game.personality.maxDelta();
    if (md.key && Math.abs(md.v) >= 3) {
      const dn = (Game.personality.dims.find((x) => x.key === md.key) || {}).name || md.key;
      sum += '（岁月使 ' + dn + (md.v > 0 ? ' ↑' : ' ↓') + Math.abs(md.v) + '）';
    }
    el.traitSummary.textContent = sum;
  }

  function renderMental() {
    if (!el.stressBar || !Game.mental) return;
    const m = Game.mental.state();
    if (!m) return;
    el.stressVal.textContent = m.stress;
    el.stressBar.style.width = m.stress + '%';
    el.stressLevel.textContent = m.stressLevel;
    el.stressLevel.className = 'mn mn-' + (m.stress >= 75 ? 'bad' : m.stress >= 50 ? 'mid' : m.stress >= 25 ? 'ok' : 'good');
    el.depVal.textContent = m.depression;
    el.depBar.style.width = m.depression + '%';
    el.traumaVal.textContent = m.trauma;
    el.traumaBar.style.width = m.trauma + '%';
    let note = '心境平稳，从容自在。';
    if (m.depression >= 55) note = '🌧️ 长期的低落笼罩着你——也许该找人聊聊。';
    else if (m.stress >= 75) note = '😰 压力濒临极限，身心都在报警。';
    else if (m.stress >= 50) note = '😮‍💨 压力不小，记得给自己喘息。';
    else if (m.trauma >= 40) note = '🩹 旧伤仍在隐隐作痛。';
    el.mentalNote.textContent = note;
  }

  // 生活需求（v1.8.0）：四条需求条 + 状态一句话。needs 系统缺失时整卡静默跳过。
  function renderNeeds() {
    if (!el.needsNote || !Game.needs) return;
    const n = st.s.needs;
    if (!n) return;
    const defs = [
      ['Satiety', 'satiety', n.satiety], ['Energy', 'energy', n.energy],
      ['Hygiene', 'hygiene', n.hygiene], ['Fun', 'fun', n.fun],
    ];
    defs.forEach(([cap, key, val]) => {
      el['need' + cap + 'Val'].textContent = val;
      el['need' + cap + 'Bar'].style.width = val + '%';
      el['need' + cap + 'Bar'].className = val < 25 ? 'low' : (val >= 70 ? 'high' : 'need');
    });
    let note = '四项都在 70 以上——神清气爽。';
    if (n.fun < 25) note = '📺 日子像白开水，去玩点什么吧。';
    else if (n.hygiene < 25) note = '🧼 该打扫洗漱了。';
    else if (n.energy < 25) note = '😵 太累了，休息一下。';
    else if (n.satiety < 25) note = '🥣 饿着肚子呢，先吃口饭。';
    else if (n.fun >= 70 && n.satiety >= 70 && n.energy >= 70 && n.hygiene >= 70) note = '✨ 生活很有滋味，身心都舒展。';
    else note = '过得去。想要加成，把四项都推上 70。';
    el.needsNote.textContent = note;
  }

  function renderSocial() {
    const soc = st.s.person.social;
    if (!soc || !el.friendList) return;
    const pers = st.s.person.personality;
    const cap = Game.config.social.friendCapBase + Math.floor(((pers ? pers.E : 50)) / Game.config.social.friendCapPerE);
    el.socialStat.textContent = '朋友 ' + soc.friends.length + ' / 上限 ' + cap + ' · 一生结识 ' + soc.met;
    if (!soc.friends.length) {
      setHTML(el.friendList,
        '<div class="empty">' + (st.s.clock.age < Game.config.social.startAge ? '还没到交朋友的年纪。' : '还没交到一个能交心的朋友。') + '</div>');
      return;
    }
    setHTML(el.friendList, soc.friends
      .map(
        (f) =>
          '<div class="friend-item' + (f.best ? ' best' : '') + '">' +
          '<span class="f-name">' + (f.best ? '💖 ' : '') + f.name + '</span>' +
          '<span class="f-tag">' + f.tag + '</span>' +
          '<span class="f-bar"><i style="width:' + f.quality + '%"></i></span>' +
          '</div>'
      )
      .join(''));
  }

  function renderEducation() {
    const p = st.s.person;
    const ed = p.education;
    if (!ed) return;
    const meta = Game.education.stages[ed.stage] || {};
    el.eduIcon.textContent = meta.emoji || '👶';
    el.eduStage.textContent = meta.name || '—';
    if (ed.inSchool) {
      const cls = Game.education && Game.education.currentClass ? Game.education.currentClass() : null;
      el.eduSub.textContent = '在读 · 第 ' + ed.grade + ' 年（' + ed.level + '）' + (cls ? ' · ' + cls.emoji + cls.name : '');
      el.eduNext.textContent = '最高学历：' + ed.level + ' · 下一站 ' + ed.nextExam;
    } else if (ed.stage === 'work') {
      el.eduSub.textContent = '已步入社会';
      el.eduNext.textContent = '最终学历：' + ed.level;
    } else {
      el.eduSub.textContent = '尚未开始学业';
      el.eduNext.textContent = '最高学历：— · 下一站 ' + ed.nextExam;
    }
    el.iqVal.textContent = p.intelligence + ' / 100';
    el.iqBar.style.width = p.intelligence + '%';
    el.knowledgeVal.textContent = Math.round(p.knowledge);
    el.knowledgeBar.style.width = Math.min(100, p.knowledge) + '%';
  }

  function renderCareer() {
    const p = st.s.person;
    const c = p.career;
    if (!c) return;
    const phaseText = { student: '求学中', employed: '在职', retired: '已退休' };
    el.jobStatus.textContent = phaseText[c.phase] || '待业';
    el.jobTitle.textContent = c.job || (c.phase === 'retired' ? '退休生活' : '—');
    el.jobIncome.textContent = c.income > 0 ? c.income.toFixed(1) + ' 万元/年' : '—';
    const w = p.wealth || 0;
    el.jobWealth.textContent = w.toFixed(1) + ' 万元';
    el.jobWealth.classList.toggle('neg', w < 0);
    let note = '工龄 ' + c.workYears + ' 年 · 60 岁退休 · 最高学历 ' + ((p.education && p.education.level) || '—');
    if (Game.career && Game.career.priceLevel() > 1.001) {
      note += ' · 物价 ' + Math.round(Game.career.priceLevel() * 100) + '%';
    }
    el.jobNote.textContent = note;
  }

  function renderInvest() {
    if (!el.invList || !Game.invest) return;
    const p = st.s.person;
    const inv = p.invest;
    const opened = inv && inv.opened;
    if (el.invHint) {
      el.invHint.style.display = opened ? 'none' : 'block';
    }
    if (!opened) { setHTML(el.invList, ''); if (el.invNetRow) el.invNetRow.style.display = 'none'; return; }
    const snap = Game.invest.snapshot();
    setHTML(el.invList, snap
      .map((a) => {
        const holding = a.units > 0;
        const pct = a.cost > 0 ? ((a.pnl / a.cost) * 100).toFixed(1) : '0.0';
        const cls = a.pnl > 0.05 ? 'up' : a.pnl < -0.05 ? 'down' : '';
        return (
          '<div class="inv-row"><span class="inv-nm">' + a.emoji + ' ' + a.name + '</span>' +
          '<span class="inv-px">现价 ' + a.price.toFixed(1) + '</span>' +
          (holding
            ? '<span class="inv-hold">' + a.value.toFixed(1) + '万 <b class="' + cls + '">' + (a.pnl >= 0 ? '+' : '') + pct + '%</b></span>'
            : '<span class="inv-hold dim">未持有</span>') +
          '</div>'
        );
      })
      .join(''));
    if (el.invNetRow) {
      el.invNetRow.style.display = 'flex';
      el.invNet.textContent = Game.invest.netWorth().toFixed(1) + ' 万（累计' + (inv.realized >= 0 ? '盈' : '亏') + Math.abs(inv.realized).toFixed(1) + '）';
    }
  }

  /* -------------------- 资产（房产 / 车辆） -------------------- */
  function renderAssets() {
    if (!el.assetList || !Game.assets) return;
    const s = Game.assets.summary();
    el.assetNet.textContent = s.net.toFixed(1) + ' 万';
    el.assetNet.classList.toggle('neg', s.net < 0);
    el.assetCount.textContent = s.count
      ? s.houses.length + ' 套房 · ' + s.cars.length + ' 辆车'
      : '暂无';
    if (el.assetDebtRow) {
      const has = s.mortgage > 0.05;
      el.assetDebtRow.style.display = has ? 'flex' : 'none';
      if (has) {
        el.assetDebt.textContent =
          s.mortgage.toFixed(1) + ' 万 · 月供 ' + s.installment.toFixed(2) + ' 万';
        el.assetDebt.classList.add('neg');
      }
    }
    const items = s.houses.concat(s.cars);
    if (!items.length) {
      setHTML(el.assetList, '<div class="empty">还没有属于自己的房子和车。</div>');
    } else {
      setHTML(el.assetList, items
        .map((it) => {
          const cost = it.buyPrice || 1;
          const gain = (it.value - cost) / cost * 100;
          const cls = gain > 0.5 ? 'up' : gain < -0.5 ? 'down' : '';
          return (
            '<div class="asset-row"><span class="ar-nm">' + it.emoji + ' ' + it.name +
            '<em>' + (it.kind === 'car' ? '车' : '房') + ' · ' + it.buyAge + '岁购入</em></span>' +
            '<span class="ar-val">' + it.value.toFixed(1) + ' 万 <b class="' + cls + '">' +
            (gain >= 0 ? '+' : '') + gain.toFixed(0) + '%</b></span></div>'
          );
        })
        .join(''));
    }
    const notes = [];
    notes.push('房价指数 ' + (s.priceIndex * 100).toFixed(0) + '%');
    if (s.count) notes.push('估值合计 ' + s.value.toFixed(1) + ' 万');
    if (s.upkeepPaid) notes.push('累计维护 ' + s.upkeepPaid.toFixed(1) + ' 万');
    if (s.interestPaid) notes.push('累计房贷利息 ' + s.interestPaid.toFixed(1) + ' 万');
    if (s.realized) notes.push('处置' + (s.realized >= 0 ? '盈' : '亏') + Math.abs(s.realized).toFixed(1) + ' 万');
    el.assetNote.textContent = notes.join(' · ');
  }

  /* -------------------- 故事线（E1 因果链叙事化） -------------------- */
  function renderStory() {
    if (!el.storyLines || !Game.story) return;
    const gs = Game.story.groups();
    const active = gs.filter((g) => g.active);
    if (el.storyCount) el.storyCount.textContent = active.length + ' / ' + gs.length + ' 条';
    setHTML(el.storyLines, gs
      .map((g) => {
        const seeds = g.activeSeeds && g.activeSeeds.length
          ? '<span class="sl-seed">' + g.activeSeeds.join(' · ') + '</span>'
          : '';
        return (
          '<div class="story-row' + (g.active ? ' on' : '') + '" title="' + (g.hint || '') + '">' +
          '<span class="sr-nm">' + g.emoji + ' ' + g.name + seeds + '</span>' +
          '<span class="sr-bar"><i style="width:' + g.progress + '%"></i></span>' +
          '<span class="sr-v">' + g.progress + '</span></div>'
        );
      })
      .join(''));
    const dims = Game.story.dims();
    const top = C.story.dims.slice().sort((a, b) => (dims[b.key] || 0) - (dims[a.key] || 0))[0];
    const ed = Game.story.ending();
    el.storyNote.textContent =
      '五维主线：' + top.name + ' ' + (dims[top.key] || 0) + ' / 100' + (ed ? ' · 结局：' + ed.name : '');
  }

  // 结算页：故事线回放 + 五维雷达图 + 特殊结局
  function renderStorySummary() {
    if (!Game.story) return;
    const gs = Game.story.groups();
    if (el.sumStory) {
      el.sumStory.innerHTML = gs
        .map(
          (g) =>
            '<div class="story-row' + (g.active ? ' on' : '') + '">' +
            '<span class="sr-nm">' + g.emoji + ' ' + g.name +
            (g.hits ? '<em>命中 ' + g.hits + '</em>' : '') + '</span>' +
            '<span class="sr-bar"><i style="width:' + g.progress + '%"></i></span>' +
            '<span class="sr-v">' + g.progress + '</span></div>'
        )
        .join('') || '<div class="empty">这一生没有留下伏笔。</div>';
    }
    if (el.sumRadar) {
      const sc = Game.story.score();
      el.sumRadar.innerHTML = radarHtml(sc);
    }
    if (el.sumEnding) {
      let ed = Game.story.ending();
      if (!ed && Game.story.finalize) ed = Game.story.finalize();
      el.sumEnding.innerHTML = ed
        ? '<div class="ending-badge">' + ed.emoji + ' ' + ed.name + '</div>' +
          '<div class="ending-desc">' + ed.desc + '</div>'
        : '<div class="empty">未触发特殊结局——平凡，也是一种答案。</div>';
    }
  }

  // 五维雷达图：实线＝后天轨迹，虚线＝出生时的先天气质（由大五人格映射）
  function radarHtml(sc) {
    const dims = C.story.dims;
    const n = dims.length;
    const R = 74, cx = 92, cy = 84;
    const pt = (i, v) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const r = R * (Math.max(0, Math.min(100, v)) / 100);
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    const poly = (vals, cls) =>
      '<polygon class="' + cls + '" points="' +
      dims.map((d, i) => pt(i, vals[d.key]).map((x) => x.toFixed(1)).join(',')).join(' ') + '"/>';
    const rings = [0.25, 0.5, 0.75, 1]
      .map(
        (k) =>
          '<polygon class="rring" points="' +
          dims.map((d, i) => pt(i, 100 * k).map((x) => x.toFixed(1)).join(',')).join(' ') + '"/>'
      )
      .join('');
    const spokes = dims
      .map((d, i) => {
        const p2 = pt(i, 100);
        return '<line class="rspoke" x1="' + cx + '" y1="' + cy + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>';
      })
      .join('');
    const labels = dims
      .map((d, i) => {
        const p2 = pt(i, 124);
        return (
          '<text class="rlbl" x="' + p2[0].toFixed(1) + '" y="' + (p2[1] + 3).toFixed(1) +
          '" text-anchor="middle">' + d.name + ' ' + (sc.blended[d.key] || 0) + '</text>'
        );
      })
      .join('');
    return (
      '<svg viewBox="0 0 184 176" class="radar-svg">' + rings + spokes +
      poly(sc.innate, 'rpoly innate') + poly(sc.blended, 'rpoly now') + labels + '</svg>' +
      '<div class="radar-cap">实线：后天轨迹 · 虚线：先天气质（大五人格映射）</div>'
    );
  }

  function renderFamily() {
    const p = st.s.person;
    const r = p.relationship;
    if (!r) return;
    let status = '单身';
    if (r.married) status = '已婚';
    else if (r.widowed) status = '丧偶';
    else if (r.divorced) status = '离异';
    el.famStatus.textContent = status;
    el.famSpouse.textContent =
      r.married && r.spouse
        ? r.spouse.name + '（' + r.spouse.age + ' 岁）'
        : r.deceasedSpouseName
        ? '已故：' + r.deceasedSpouseName
        : r.divorced
        ? '已离异'
        : '—';
    const age = st.s.clock.age;
    el.famChildren.textContent = r.children.length
      ? '子女（' + r.children.length + '）：' + r.children.map((k) => k.name + ' · ' + (age - k.birthAge) + '岁').join('，')
      : '暂无子女';
    el.famNote.textContent = r.married ? '结婚于 ' + r.marriedAge + ' 岁' : '';
  }

  function renderFamilyOrigin() {
    const p = st.s.person;
    const f = p.family;
    if (!f || !el.parentRows) return;
    el.originTag.textContent = '家境 · ' + f.origin;
    el.originTag.className = 'origin-tag og-' + originClass(f.origin);
    const rows = [f.father, f.mother].map((par) => {
      if (!par.alive) {
        return (
          '<div class="parent dead"><span class="pr-role">' + par.role + '</span>' +
          '<span class="pr-name">' + par.name + '</span>' +
          '<span class="pr-state">已故 · 享年 ' + par.deathAge + ' 岁</span></div>'
        );
      }
      return (
        '<div class="parent"><span class="pr-role">' + par.role + '</span>' +
        '<span class="pr-name">' + par.name + '</span>' +
        '<span class="pr-bar"><i style="width:' + Math.round(par.bond) + '%"></i></span>' +
        '<span class="pr-state">' + par.age + '岁 · 亲情' + Math.round(par.bond) + '</span></div>'
      );
    });
    setHTML(el.parentRows, rows.join(''));
    el.siblingInfo.textContent = f.siblings.length
      ? '兄弟姐妹：' + f.siblings.map((s) => s.name + '（' + (s.age >= 0 ? '大' : '小') + Math.abs(s.age) + '岁）').join('，')
      : '独生子女';
    el.estateNote.textContent =
      '父母在世家产约 ' + Math.round(f.estate) + ' 万 · 已继承 ' + Math.round(f.inherited) + ' 万';
  }
  function originClass(k) {
    return { 贫困: 'poor', 温饱: 'poor', 小康: 'mid', 富裕: 'rich', 豪门: 'rich' }[k] || 'mid';
  }

  function renderWeather() {
    const w = st.s.world.weather;
    if (!w) return;
    el.weatherIcon.textContent = w.emoji;
    el.tempVal.textContent = w.tempC;
    el.weatherName.textContent = w.name + ' · ' + C.seasonMeta[w.season].name + '季';
    el.weatherDesc.textContent = w.desc;
    const risk = w.infection >= 1.4 ? '高' : w.infection >= 1.1 ? '中' : '低';
    el.envBadge.textContent = '感染风险指数：' + risk + '（天气倍率 ' + w.infection + '×）';
  }

  const stageLabel = { incubation: '潜伏期', acute: '发作中', recovery: '恢复中', chronic: '慢性·长期' };
  function renderDiseases() {
    const list = st.s.diseases;
    if (!list.length) {
      if (!el.diseaseList.dataset.empty) {
        el.diseaseList.innerHTML = '<div class="empty">身体健康，暂无疾病。</div>';
        el.diseaseList.dataset.empty = '1';
      }
      return;
    }
    delete el.diseaseList.dataset.empty;
    setHTML(el.diseaseList, list
      .map(
        (d) =>
          '<div class="disease-item' + (d.stage === 'chronic' ? ' chronic' : '') + '">' +
          '<span class="di-icon">' + d.cfg.emoji + '</span>' +
          '<span class="di-name">' + d.cfg.name +
          ' <span class="di-stage">· ' + (stageLabel[d.stage] || d.stage) +
          (d.stage !== 'chronic' ? '（剩 ' + Math.max(0, d.daysLeft) + ' 天）' : '') +
          '</span></span>' +
          '</div>'
      )
      .join(''));
  }

  return { init, updateStatusPill };
})();
