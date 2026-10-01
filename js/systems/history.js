/* =========================================================================
 * 系统 · 人生轨迹记录 (history / timeline)
 * -------------------------------------------------------------------------
 * 纯"旁观"系统：只订阅各系统已有的事件，把值得铭记的节点记成一条结构化
 * 时间线（st.s.timeline），供死亡结算页的时间线可视化使用。不产生任何副作用。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;

  function push(kind, emoji, label) {
    if (!st.s.timeline) return;
    st.s.timeline.push({ age: st.s.clock.age, kind, emoji, label });
  }

  function sampleCurve() {
    if (!st.s.curve) return;
    const p = st.s.person;
    st.s.curve.push({
      age: st.s.clock.age,
      health: Math.round(p.health),
      mood: Math.round(p.mood),
      immunity: Math.round(p.immunity),
      wealth: Math.round(p.wealth || 0),
    });
  }

  function resetRecords() {
    st.s.timeline = [];
    const p = st.s.person;
    st.s.curve = [
      {
        age: 0,
        health: Math.round(p.health),
        mood: Math.round(p.mood),
        immunity: Math.round(p.immunity),
        wealth: Math.round(p.wealth || 0),
      },
    ];
    if (p.family) push('family', '🏠', '出身·' + p.family.origin + '家庭');
  }

  Game.systems
    .create('history', 78)
    .on('state:reset', resetRecords)
    .on('year', sampleCurve)
    .on('education:change', (e) => {
      if (e.stage && e.stage !== 'work') {
        const meta = C.education.stages[e.stage];
        push('edu', '🎓', meta.name + (meta.level !== '—' ? '（' + meta.level + '）' : ''));
      }
    })
    .on('education:graduated', (e) => push('edu', '🎓', '毕业 · ' + (e.level || '')))
    .on('career:work', (e) => push('work', '💼', '入职 ' + e.job))
    .on('career:retire', () => push('work', '🏖️', '光荣退休'))
    .on('family:marry', (e) => push('family', '💑', '与' + e.spouse.name + '结婚'))
    .on('family:birth', (e) => push('family', '👶', '得' + (e.child.gender === '男' ? '子' : '女') + ' ' + e.child.name))
    .on('family:divorce', () => push('family', '💔', '离婚'))
    .on('family:widow', () => push('family', '🕯️', '丧偶'))
    .on('natfamily:death', (e) => push('family', '💔', e.role + '离世'))
    .on('natfamily:inherit', (e) => push('family', '⚖️', '继承遗产 ' + e.amount + ' 万'))
    .on('social:new', (e) => push('social', '👋', '结识 ' + e.friend.name))
    .on('decision:answered', (e) => push('choice', '🧭', String(e.ev.title).replace(/^\S+\s+/, '')))
    .on('disease:new', (e) => {
      if (e.disease.cfg.severity >= 24) push('health', e.disease.cfg.emoji, e.disease.cfg.name);
    })
    .on('death', (e) => push('death', '💀', e.cause));

  Game.timeline = {
    get() {
      return st.s.timeline || [];
    },
    curve() {
      return st.s.curve || [];
    },
  };
})();
