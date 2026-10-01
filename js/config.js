/* =========================================================================
 * 配置 · 所有可调参数与数据表集中在这里
 * -------------------------------------------------------------------------
 * 想调整平衡性 / 增加天气 / 增加疾病 / 增加新的事件表，改这里即可，
 * 不需要动系统逻辑代码。这就是"数据驱动 + 可扩展"。
 * ========================================================================= */
Game.config = {
  // 默认随机种子；重置时可换种子得到不同人生
  seed: 20260917,

  time: {
    daysPerTick: 1, // 每个 tick 推进的天数
    startYear: 1990, // 主角出生年份（日历从此开始，随时间真实推进）
    // 速度：tick/秒。UI 里映射成"慢/中/快/极快"
    speeds: [
      { label: '慢', tps: 6 },
      { label: '中', tps: 18 },
      { label: '快', tps: 60 },
      { label: '极快', tps: 200 },
    ],
    // 自动暂停（参与感）：开启后，主循环在"每年交界（生日/新年）"与"每次事件弹出"时
    // 自动置为暂停态，让玩家有停留、阅读、做选择的空间，避免一路快进失去参与感。
    // year=true 表示每次跨年交界暂停一次（一年一次）；event 为事件弹窗暂停。
    // 这两项都只在本就处于"自动播放(running=true)"时生效；手动单步不受影响。
    autoPause: { year: true, event: true },
  },

  // 年代划分（用于 HUD 的"时代"标签；从 1990 起）
  eras: [
    { from: 1990, to: 1992, name: '九〇年代初', emoji: '📼', tag: '下海潮 · 万元户' },
    { from: 1993, to: 1997, name: '市场经济', emoji: '🏭', tag: '下岗潮 · 大哥大' },
    { from: 1998, to: 2001, name: '千禧之交', emoji: '🎆', tag: '入世 · 互联网泡沫' },
    { from: 2002, to: 2007, name: '高速成长', emoji: '🏗️', tag: '基建 · PC 普及' },
    { from: 2008, to: 2012, name: '移动前夜', emoji: '📱', tag: '奥运 · 智能机' },
    { from: 2013, to: 2016, name: '移动互联网', emoji: '💬', tag: '微信 · 双创' },
    { from: 2017, to: 2019, name: '消费升级', emoji: '🛒', tag: '短视频 · 直播' },
    { from: 2020, to: 2022, name: '疫情时代', emoji: '😷', tag: '健康码 · 网课' },
    { from: 2023, to: 9999, name: 'AI 纪元', emoji: '🤖', tag: '大模型 · 新纪元' },
  ],

  // 每月所属季节（北半球/气象划分）：0=春 1=夏 2=秋 3=冬
  // 春 3-5 月、夏 6-8 月、秋 9-11 月、冬 12-2 月。index by month-1
  seasonOfYear: [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3],
  seasonMeta: [
    { key: 'spring', name: '春', emoji: '🌸', baseTemp: 15 },
    { key: 'summer', name: '夏', emoji: '☀️', baseTemp: 30 },
    { key: 'autumn', name: '秋', emoji: '🍂', baseTemp: 14 },
    { key: 'winter', name: '冬', emoji: '❄️', baseTemp: -2 },
  ],

  // 各季节下天气类型的出现权重 + 温度偏移
  weatherProfiles: {
    spring: {
      sunny:  { w: 30, temp: 3,  infection: 0.6, mood: 1.0, desc: '晴朗温暖，微风拂面' },
      cloudy: { w: 28, temp: 0,  infection: 0.9, mood: 0.2, desc: '多云，天色灰白' },
      rain:   { w: 28, temp: -3, infection: 1.2, mood: -0.6, desc: '春雨绵绵，湿冷' },
      storm:  { w: 8,  temp: -4, infection: 1.3, mood: -1.2, desc: '雷阵雨，电闪雷鸣' },
      fog:    { w: 6,  temp: -1, infection: 1.0, mood: -0.3, desc: '晨雾弥漫，空气闷' },
    },
    summer: {
      sunny:   { w: 42, temp: 4,  infection: 0.7, mood: 0.8, desc: '烈日当空' },
      cloudy:  { w: 18, temp: 0,  infection: 0.9, mood: 0.2, desc: '闷热多云' },
      shower:  { w: 22, temp: -5, infection: 1.1, mood: -0.4, desc: '午后雷阵雨' },
      storm:   { w: 10, temp: -6, infection: 1.2, mood: -1.0, desc: '强对流，狂风暴雨' },
      heatwave:{ w: 8,  temp: 12, infection: 1.0, mood: -1.4, desc: '持续高温，热浪来袭' },
    },
    autumn: {
      sunny:  { w: 34, temp: 2,  infection: 0.8, mood: 0.9, desc: '秋高气爽' },
      cloudy: { w: 30, temp: 0,  infection: 1.0, mood: 0.1, desc: '阴云密布' },
      rain:   { w: 26, temp: -3, infection: 1.2, mood: -0.6, desc: '秋雨凄冷' },
      fog:    { w: 10, temp: -1, infection: 1.1, mood: -0.4, desc: '大雾笼罩' },
    },
    winter: {
      sunny: { w: 20, temp: 1,  infection: 0.9, mood: 0.5, desc: '冬日暖阳，但空气干冷' },
      cloudy:{ w: 26, temp: -2, infection: 1.3, mood: -0.2, desc: '阴冷' },
      cold:  { w: 26, temp: -8, infection: 1.7, mood: -0.8, desc: '寒潮南下，天寒地冻' },
      snow:  { w: 22, temp: -6, infection: 1.5, mood: 0.3,  desc: '大雪纷飞，银装素裹' },
      haze:  { w: 6,  temp: -1, infection: 1.4, mood: -1.0, desc: '雾霾锁城，空气浑浊' },
    },
  },

  // 天气中文名（供 UI）
  weatherNames: {
    sunny: '晴', cloudy: '多云', rain: '雨', shower: '阵雨', storm: '雷雨',
    fog: '雾', haze: '雾霾', heatwave: '高温', cold: '寒潮', snow: '雪',
  },

  // 人物初始生命体征
  vitals: {
    health0: 90,      // 出生/开局健康
    immunity0: 62,    // 初始免疫力
    mood0: 62,        // 初始心情
    immunityRegen: 0.6,    // 每天免疫恢复基线速度
    healthRegen: 0.8,      // 无病时每天健康恢复基线
    immunityBaseline: 62,  // 免疫自然回归的目标值
  },

  // 疾病库（数据驱动，新增疾病只加一条）
  // stage: incubation 潜伏 → acute 发作 → recovery 恢复 / chronic 慢性
  diseases: {
    cold: {
      name: '普通感冒', emoji: '🤧', severity: 6, contagious: 1.0,
      incubation: 2, acute: 5, recovery: 3, chronicChance: 0,
      healthDrain: 0.5, immunityCost: 1.0, infectReq: 0.02,
      desc: '鼻塞流涕，一般数日自愈',
    },
    flu: {
      name: '流行性感冒', emoji: '🦠', severity: 16, contagious: 1.6,
      incubation: 2, acute: 7, recovery: 4, chronicChance: 0,
      healthDrain: 0.8, immunityCost: 1.3, infectReq: 0.015,
      desc: '高热乏力，冬季高发',
    },
    fever: {
      name: '高烧', emoji: '🌡️', severity: 20, contagious: 0,
      incubation: 1, acute: 4, recovery: 3, chronicChance: 0,
      healthDrain: 1.2, immunityCost: 1.6, infectReq: 0,
      desc: '体温过高，需警惕并发', isComplication: true,
    },
    bronchitis: {
      name: '支气管炎', emoji: '😮‍💨', severity: 24, contagious: 0.28,
      incubation: 3, acute: 12, recovery: 6, chronicChance: 0.12,
      healthDrain: 0.6, immunityCost: 1.0, infectReq: 0.01,
      desc: '久咳不愈，天冷加重',
    },
    pneumonia: {
      name: '肺炎', emoji: '🫁', severity: 42, contagious: 0.4,
      incubation: 3, acute: 15, recovery: 10, chronicChance: 0.08,
      healthDrain: 1.1, immunityCost: 1.5, infectReq: 0.008,
      desc: '肺部感染，幼儿与老人凶险',
    },
    heatstroke: {
      name: '中暑', emoji: '🥵', severity: 20, contagious: 0,
      incubation: 1, acute: 3, recovery: 3, chronicChance: 0,
      healthDrain: 1.3, immunityCost: 0.8, infectReq: 0,
      desc: '高温下脱水中暑', weatherTrigger: ['heatwave'],
    },
    chronic: {
      name: '慢性疾病', emoji: '🩺', severity: 12, contagious: 0,
      incubation: 0, acute: 0, recovery: 0, chronicChance: 1,
      healthDrain: 0.35, immunityCost: 0.3, infectReq: 0,
      desc: '长期损耗身体，难以痊愈', isChronic: true,
    },
  },

  // ================= 学业 / 教育（上学 + 升学事件） =================
  education: {
    // 出生时按正态分布掷出的智力（后续升学考试的核心变量）
    iq: { mean: 55, sd: 16, min: 18, max: 99 },

    // 各阶段：显示名 / 图标 / 学历 / 名义入学年龄（用于年级与 UI）
    stages: {
      none:       { name: '未入学',     emoji: '👶', level: '—' },
      kg:         { name: '幼儿园',     emoji: '🧸', level: '学前教育' },
      primary:    { name: '小学',       emoji: '✏️', level: '小学' },
      junior:     { name: '初中',       emoji: '📘', level: '初中' },
      senior:     { name: '普通高中',   emoji: '🎒', level: '高中' },
      vocational: { name: '职业高中',   emoji: '🔧', level: '中职' },
      associate:  { name: '大学专科',   emoji: '🏫', level: '大专' },
      college:    { name: '大学本科',   emoji: '🏛️', level: '本科' },
      master:     { name: '硕士研究生', emoji: '🔬', level: '硕士' },
      phd:        { name: '博士研究生', emoji: '📚', level: '博士' },
      work:       { name: '步入社会',   emoji: '💼', level: '—' },
    },

    // 在读阶段的升学触发点（到达 age 时执行）。
    //   to            直接升级（义务教育/入园）
    //   pass/fail     一场考试，成功去 pass.to，失败去 fail
    //   gaokao:true   走高考的三档分流（本科/专科/复读/就业）
    progress: {
      none:       { age: 3,  to: 'kg' },
      kg:         { age: 6,  exam: '幼升小', to: 'primary' },
      primary:    { age: 12, exam: '小升初', to: 'junior' },
      junior:     { age: 15, exam: '中考',   pass: { to: 'senior', p: 0.62 }, fail: 'vocational' },
      vocational: { age: 18, exam: '职教高考', pass: { to: 'associate', p: 0.45 }, fail: 'work' },
      senior:     { age: 18, gaokao: true },
      associate:  { age: 20, exam: '专升本', pass: { to: 'college', p: 0.32 }, fail: 'work' },
      college:    { age: 22, exam: '考研',   pass: { to: 'master', p: 0.3 }, fail: 'work' },
      master:     { age: 25, exam: '考博',   pass: { to: 'phd', p: 0.2 },   fail: 'work' },
      phd:        { age: 28, to: 'work' },
    },

    gaokao: { bachelorLine: 78, collegeLine: 55, maxRetake: 2 },

    // —— 班级档次（v2.4.0）：入学/升学时按"分班成绩"分配班级，每年按成绩浮动调档 ——
    // 分班成绩 = 智力×1 + (健康-60)×0.15 + 学识进步度加成 + 临场波动(±6)。
    // 学识进步度 = clamp(学识 ÷ 同时长普通学生预期学识 - 1, -1, 1) × knowledgeBonus：
    // 低年级天赋定档，之后"跑赢平均线"的努力最多贡献 ±15 分——三档分布长期稳定，
    // 不会因学识绝对值无界增长而"高年级全员火箭班"。tiers 按 minScore 降序。
    // 仅 K-12 与中职分班（classStages），大学以上不分班。
    classStages: ['kg', 'primary', 'junior', 'senior', 'vocational'],
    classPlacement: { iqWeight: 1.0, healthWeight: 0.15, knowledgeBonus: 15, noise: 6, promoteChance: 0.08, demoteChance: 0.05 },
    classTiers: [
      { key: 'rocket',  name: '火箭班', emoji: '🚀', minScore: 82, knowledgeMul: 2.0, examBonus: 0.10, gaokaoBonus: 5, yearlyMood: -0.8, yearlyStress: 2,   desc: '天才云集，节奏飞快，压力也最大' },
      { key: 'elite',   name: '重点班', emoji: '🏅', minScore: 68, knowledgeMul: 1.5, examBonus: 0.06, gaokaoBonus: 3, yearlyMood: -0.5, yearlyStress: 1.2, desc: '师资更好，同辈你追我赶' },
      { key: 'regular', name: '普通班', emoji: '📖', minScore: 0,  knowledgeMul: 1.0, examBonus: 0,    gaokaoBonus: 0, yearlyMood: 0,    yearlyStress: 0,   desc: '按部就班，张弛有度' },
    ],

    // 学习/考试如何受其它系统影响（可扩展的耦合点）
    study: {
      knowledgePerYear: 4,   // 在学每年累积学识
      iqWeight: 1.0,         // 智力对升学的权重
      healthWeight: 0.15,    // 健康对升学的权重
      noise: 8,              // 高考发挥随机波动
    },
  },

  // ================= 事业 / 工作 =================
  career: {
    retirementAge: 60,
    pensionRatio: 0.5,      // 退休金 = 在职年薪 × 比例
    pensionIndexRatio: 0.6, // 退休金按通胀指数化比例（部分跟涨物价，缓解老年购买力缩水）
    annualRaise: { base: 0.03, sd: 0.025 }, // 每年例行调薪（约与通胀同水位，晋升另有跳涨）
    promote: { baseChance: 0.12, iqGain: 0.004, salaryGrowth: 0.14 }, // 每年加薪/晋升
    stress: { healthDrain: 0.12, moodDrain: 0.08 }, // 在职每年轻微损耗
    // 按最高学历给出入行岗位（[岗位名, 年薪万元]）
    ladder: {
      '小学':  [['搬运工', 4], ['保洁员', 3.5], ['农活短工', 3]],
      '初中':  [['流水线普工', 5], ['快递分拣员', 5], ['建筑小工', 5.5]],
      '中职':  [['技工', 7], ['餐饮服务员', 6], ['汽修技师', 7.5]],
      '高中':  [['销售员', 8], ['行政文员', 8], ['客服专员', 7]],
      '大专':  [['技术员', 10], ['店长助理', 9.5], ['销售主管', 11]],
      '本科':  [['工程师', 14], ['人民教师', 12], ['市场专员', 13], ['公务员', 13]],
      '硕士':  [['高级工程师', 20], ['高校辅导员', 17], ['算法工程师', 26]],
      '博士':  [['研究员', 30], ['高校教师', 24], ['首席科学家', 40]],
      '—':     [['临时零工', 3], ['拾荒度日', 1.5]],
    },
  },

  // ================= 财务 =================
  finance: {
    startWealth: 8,        // 出生家境（万元）均值
    startSpread: 12,
    livingCostBase: 4.5,   // 每年基本开销（万元，按物价指数逐年放大）
    childCost: 3,          // 每个孩子每年养育开销（万元）
    medicalCost: { cold: 0.5, flu: 1, fever: 2, bronchitis: 2.5, pneumonia: 6, heatstroke: 1.5, chronic: 3 },
    debtStress: { mood: 1.5, immunity: 0.6 }, // 负债每年的基础打击（wealth 刚转负时的档位）
    // 负债深度分级（v1.4.0）：按 wealth 落入的区间取档，越深越痛；tiers 按 below 从大到小排列
    debtTiers: [
      { below: 0,   mood: 1.5, immunity: 0.6, stress: 0,  label: '入不敷出' },
      { below: -5,  mood: 3,   immunity: 1.2, stress: 2,  label: '捉襟见肘' },
      { below: -25, mood: 5,   immunity: 2,   stress: 5,  label: '债台高筑' },
      { below: -60, mood: 8,   immunity: 3,   stress: 9,  label: '走投无路' },
    ],
    // —— v1.1.0：通胀 / 税率 / 年终奖 ——
    inflation: { rate: 0.025, drift: 0.012 },   // 年通胀率 ± 随机漂移（物价指数逐年放大）
    incomeTax: { deduction: 6, rate: 0.12 },    // 个税：起征额（万元/年）+ 超出部分税率
    yearBonus: { chance: 0.4, min: 0.05, max: 0.18, mood: 2 }, // 年终奖（占年薪比例，随机区间）
    priceNotes: [1.5, 2, 3],                    // 物价指数首次越过这些关口时提醒一次
    bailoutDebt: -25,                           // 深度负债阈值：触发"求助父母"里程碑决策
  },

  // ================= 婚恋 / 家庭 =================
  marriage: {
    window: { min: 22, max: 46 },   // 适婚年龄段
    baseSeek: 0.16,                 // 每年求偶基础概率（受心情/收入/智力加成）
    spouse: { ageGap: 4, iqMean: 55, iqSd: 15 },
    child: { window: { min: 22, max: 42 }, maxChildren: 3, baseChance: 0.15 },
    divorce: { moodBelow: 22, chance: 0.05 },
    spouseDeathBase: 0.004,         // 配偶每年离世基础风险（随年龄放大）
    joy: { marry: 8, child: 6, divorce: -6, widow: -10 },
  },

  // ================= 原生家庭（父母·兄弟姐妹·家境·遗产） =================
  family: {
    // 出身层级：w 权重、wealth 出生可得零花钱、iq 父母智力均值、estate 父母可继承积蓄（万元）
    origins: [
      { key: '贫困', w: 18, wealth: [0, 8],     iq: 44, estate: [0, 15] },
      { key: '温饱', w: 34, wealth: [6, 22],    iq: 50, estate: [10, 50] },
      { key: '小康', w: 30, wealth: [18, 60],   iq: 57, estate: [40, 150] },
      { key: '富裕', w: 14, wealth: [50, 160],  iq: 63, estate: [150, 500] },
      { key: '豪门', w: 4,  wealth: [150, 600], iq: 68, estate: [500, 3000] },
    ],
    parentAge: { min: 23, max: 40 },
    parentHealth: { mean: 85, sd: 8 },
    bondStart: { mean: 74, sd: 12 },
    siblings: { noneChance: 0.45, maxNum: 3 },
    death: { age0: 60, base: 0.01, perYear: 0.012, max: 0.5 }, // 父母60岁后年死亡率随年龄升
    illness: { base: 0.05, cost: [1, 6], moodHit: 3, bondUp: 4 },
    inherit: { share: 0.5 },   // 遗产 = 父母剩余积蓄 × share ÷ (子女数)
    bondDrift: 0.03,           // 亲情每年向 55 缓慢回落
  },

  // 姓名池（用于主角与配偶、子女）
  names: {
    surname: ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '林', '何', '郭', '高', '罗'],
    male: ['伟', '强', '磊', '军', '勇', '杰', '涛', '明', '超', '刚', '斌', '辉', '鹏', '浩', '宇', '睿'],
    female: ['芳', '娜', '敏', '静', '艳', '娟', '霞', '婷', '雪', '琳', '梅', '兰', '悦', '颖', '佳', '晴'],
  },

  // ================= 性格（大五人格，出生即定，影响一生基调） =================
  personality: {
    roll: { mean: 55, sd: 22, min: 5, max: 97 },
    dims: [
      { key: 'E', name: '外向性' },
      { key: 'A', name: '宜人性' },
      { key: 'C', name: '尽责性' },
      { key: 'N', name: '神经质' },
      { key: 'O', name: '开放性' },
    ],
    // 心情"设定点"：外向让人更愉悦，神经质拉低基调
    moodSetpoint: { base: 56, eCoef: 0.30, nCoef: 0.35, pull: 0.008 },
    // 神经质带来的偶发情绪波动
    volatility: { chance: 0.012, amp: 6 },
    // 尽责性对健康的极轻微正向习惯
    conscientiousHealth: { coef: 0.006 },
    // 性格可塑：行动/事件带来的 OCEAN 漂移（applyEffects.e.pers），每年向出厂设定回弹，且封顶可塑幅度
    plasticity: { rebound: 0.35, maxShift: 15 },
    labels: {
      E: ['独处', '内敛', '合群', '外向', '活跃'],
      A: ['直率', '随性', '友善', '随和', '温暖'],
      C: ['随性', '自律有度', '自律', '严谨', '极致'],
      N: ['沉稳', '平和', '多虑', '敏感', '情绪化'],
      O: ['务实', '常规', '好奇', '开放', '先锋'],
    },
  },

  // ================= 社交 / 朋友 =================
  social: {
    startAge: 4,             // 太小的年份不社交
    meetChanceBase: 0.16,    // 每年结识新朋友基础概率
    friendCapBase: 3,        // 朋友圈容量基线
    friendCapPerE: 12,       // 外向每 N 点 +1 上限
    maintainBase: 0.6,       // 每年维系友情的基础概率
    decay: 9,                // 未维系时友情值下降
    fadeQuality: 16,         // 友情值低于此 → 渐行渐远
    contextByStage: {
      school: ['同学', '同桌', '校友'],
      work: ['同事', '同行', '合作伙伴'],
      other: ['邻居', '老友', '球友', '书友', '网友'],
    },
    friendDeathBase: 0.005,  // 每位朋友每年离世基础风险（随年龄放大）
    friendDeathMoodHit: 6,   // 至交离世的心情打击
    goodQuality: 55,         // 视为"挚友"的友情值门槛
    moodPerFriend: 0.25,     // 每个朋友的年心情增益（按质量加权）
    moodCap: 3,              // 心情增益上限
    immunityPerFriend: 0.12, // 社交支持带来的免疫增益
    lonelyPenalty: 1.4,      // 成年后无友可诉的年度心情损失
  },

  // ================= 抉择 / 人生岔路（玩家决策） =================
  decisions: {
    // 按月触发：每个"月"以 monthlyChance 概率弹一个随机生活流事件；两次随机事件
    // 之间至少间隔 minGapMonths 个月（避免刷屏）。里程碑不受此限、优先弹出。
    // v2.3.0：0.2→0.24 / 4→3，中段 40 年"无事发生"的空白进一步收窄。
    monthlyChance: 0.24,
    minGapMonths: 3,
    cooldownYears: 3,   // 兼容旧字段（已不用于按月节奏）
    randomChance: 0.2,  // 满足条件时，每年触发随机抉择的概率
    // 事件按数组顺序扫描：先里程碑（非 random），再随机池。seen 记录已触发过（一次性）。
    events: [
      // —— 童年 / 少年 ——
      {
        id: 'hobby_class', title: '🎠 兴趣班', desc: '父母想给你报一个兴趣班，但家里要为此多花一笔钱。',
        minAge: 7, maxAge: 11, random: true,
        choices: [
          { label: '学钢琴（陶冶情操）', effects: { knowledge: 4, mood: 3, wealth: -3 }, log: '你爱上了弹琴，气质更出众了。' },
          { label: '学奥数（刷题提分）', effects: { knowledge: 6, intelligence: 2, mood: -3 }, log: '题海苦读，脑子和压力一起涨。' },
          { label: '不报，让我玩', effects: { mood: 5, knowledge: -1 }, log: '你拥有了快乐的童年。' },
        ],
      },
      {
        id: 'exam_cheat', title: '📝 考试时，一张纸条递到手边', desc: '监考老师没注意，后排把答案推了过来……',
        minAge: 12, maxAge: 18, random: true,
        choices: [
          {
            label: '抄（赌一把不被发现）', risk: { chance: 0.7,
              success: { knowledge: 4, mood: 2, flags: { tookRisk: true } }, failure: { mood: -12, intelligence: -1 },
              goodLog: '你蒙混过关，分数好看了一点。', badLog: '被抓个正着，通报批评，羞愧难当。' } },
          { label: '拒绝，诚信作答', effects: { mood: 2, knowledge: 1, flags: { honest: true } }, log: '你守住了底线，心里踏实。' },
        ],
      },
      {
        id: 'first_crush', title: '💗 情窦初开', desc: '班上有个人，让你第一次心跳加速。',
        minAge: 14, maxAge: 18, random: true,
        choices: [
          { label: '鼓起勇气表白', risk: { chance: 0.45,
            success: { mood: 10, knowledge: 2 }, failure: { mood: -8 },
            goodLog: '你们牵手了，青涩又甜蜜。', badLog: '被婉拒了，你尴尬了一阵，但学会了坦诚。' } },
          { label: '把好感藏心里，先顾学习', effects: { knowledge: 4, mood: -2 }, log: '你把心动化成了自习室的动力。' },
        ],
      },
      // —— 暖事件 / 小确幸（v1.3.0）：平衡情绪曲线，给人生一点温度 ——
      {
        id: 'warm_neighbor', title: '🥕 邻居送菜', desc: '对门阿姨端来一把刚摘的青菜，说想着你一个人住。',
        minAge: 16, maxAge: 90, random: true, repeatable: true, minMonths: 8, weight: 0.8,
        condition: (p) => p.mood < 70,
        choices: [
          { label: '笑着收下，聊了会儿天', effects: { mood: 5 }, log: '邻里温情，心里一暖。' },
        ],
      },
      {
        id: 'warm_oldfriend', title: '📞 旧友重逢', desc: '许久不联系的老同学忽然打来电话，聊聊这些年的光景。',
        minAge: 20, maxAge: 90, random: true, repeatable: true, minMonths: 10, weight: 0.7,
        condition: (p) => p.mood < 72,
        choices: [
          { label: '放下手头事，好好叙旧', effects: { mood: 6 }, log: '老友如旧，岁月温柔。' },
        ],
      },
      {
        id: 'warm_kidword', title: '👶 孩子第一次叫你', desc: '那个小人儿忽然含糊地喊出了你的名字。',
        minAge: 22, maxAge: 80, random: true, repeatable: true, minMonths: 12, weight: 0.6,
        condition: (p) => p.relationship && p.relationship.children && p.relationship.children.length > 0,
        choices: [
          { label: '一把抱起，眼眶发热', effects: { mood: 9 }, log: '一声呼唤，值了半生辛苦。' },
        ],
      },
      {
        id: 'warm_sunny', title: '🌤️ 雨后初晴去散步', desc: '连阴雨后，天空豁然放晴，空气里都是泥土香。',
        minAge: 8, maxAge: 95, random: true, repeatable: true, minMonths: 9, weight: 0.7,
        condition: (p) => p.mood < 75 && [0, 2].indexOf(Game.state.s.clock.season) >= 0,
        choices: [
          { label: '出门走走，深呼吸', effects: { mood: 5, health: 0.5 }, log: '久违的好天气，整个人都松快了。' },
        ],
      },
      {
        id: 'warm_cat', title: '🐱 流浪猫蹭你', desc: '路边一只猫犹豫了一下，竟凑过来拿脑袋蹭你的裤脚。',
        minAge: 10, maxAge: 95, random: true, repeatable: true, minMonths: 11, weight: 0.6,
        condition: (p) => p.mood < 72,
        choices: [
          { label: '蹲下摸摸它', effects: { mood: 5 }, log: '被一个小生命信任，莫名安心。' },
        ],
      },
      {
        id: 'warm_help', title: '🤝 帮了陌生人', desc: '你顺手帮位老人提了重物，对方连声道谢。',
        minAge: 12, maxAge: 95, random: true, repeatable: true, minMonths: 12, weight: 0.6,
        condition: (p) => p.mood < 72,
        choices: [
          { label: '摆摆手说应该的', effects: { mood: 6, flags: { kind: true } }, log: '举手之劳，却换来一整天的好心情。' },
        ],
      },

      // —— v2.0.0 扩池：暖事件 / 空巢 / 退休 / 老年（30 条） ——

      // 暖事件（通用，重复可触发）
      {
        id: 'warm_cook', title: '🍳 做了一顿好饭', desc: '难得下厨，端上桌那一刻觉得生活挺好的。',
        minAge: 16, maxAge: 95, random: true, repeatable: true, minMonths: 8, weight: 0.5,
        choices: [
          { label: '好好享用', effects: { mood: 4, health: 1 }, log: '一口热汤下肚，整个人都暖了。' },
        ],
      },
      {
        id: 'warm_sunrise', title: '🌅 偶遇日出', desc: '早起或失眠，无意间撞见一场日出。',
        minAge: 8, maxAge: 95, random: true, repeatable: true, minMonths: 18, weight: 0.3,
        choices: [
          { label: '静静看完', effects: { mood: 5, stress: -4 }, log: '天边一点点亮起来，心也跟着静了。' },
        ],
      },
      {
        id: 'warm_rain', title: '🌧️ 窗边听雨', desc: '一场大雨把世界洗干净了，你坐在窗边发了会儿呆。',
        minAge: 6, maxAge: 95, random: true, repeatable: true, minMonths: 10, weight: 0.4,
        choices: [
          { label: '泡杯茶听雨', effects: { mood: 3, stress: -3 }, log: '雨声是最好的白噪音。' },
        ],
      },
      {
        id: 'warm_letter', title: '✉️ 收到一封旧信', desc: '翻抽屉翻出一封旧信或老照片，思绪万千。',
        minAge: 25, maxAge: 95, random: true, repeatable: true, minMonths: 24, weight: 0.3,
        choices: [
          { label: '读完放回去', effects: { mood: 4 }, log: '有些人有些事，隔着时间反而更清晰了。' },
        ],
      },
      {
        id: 'warm_music', title: '🎵 偶然听到老歌', desc: '街角或电台飘来一首歌，把你拉回某个夏天。',
        minAge: 20, maxAge: 95, random: true, repeatable: true, minMonths: 12, weight: 0.4,
        choices: [
          { label: '听完再走', effects: { mood: 4, stress: -2 }, log: '旋律像时光机，三分钟穿越回从前。' },
        ],
      },
      {
        id: 'warm_plant', title: '🌱 养的花开了', desc: '阳台上的花不知什么时候开了。',
        minAge: 18, maxAge: 95, random: true, repeatable: true, minMonths: 20, weight: 0.3,
        choices: [
          { label: '拍张照', effects: { mood: 3 }, log: '小小的惊喜，日子因此亮了一下。' },
        ],
      },
      {
        id: 'warm_walk', title: '🚶 散步发现新路', desc: '常走的那条路拐了个弯，意外通向一片没去过的地方。',
        minAge: 10, maxAge: 95, random: true, repeatable: true, minMonths: 14, weight: 0.3,
        choices: [
          { label: '走走看', effects: { mood: 4, knowledge: 1 }, log: '原来世界比想象的大一点。' },
        ],
      },
      {
        id: 'warm_stray', title: '🐱 流浪猫蹭了你', desc: '路上一只猫主动过来蹭你的腿。',
        minAge: 6, maxAge: 95, random: true, repeatable: true, minMonths: 16, weight: 0.3,
        choices: [
          { label: '摸摸它的头', effects: { mood: 5, stress: -3 }, log: '被一只猫选中的感觉，莫名治愈。' },
        ],
      },

      // 空巢期（50–70 岁，子女已长大）
      {
        id: 'empty_nest', title: '🏠 空巢来了', desc: '孩子搬出去住了，家里突然安静得让人不习惯。',
        minAge: 48, maxAge: 65, random: true, weight: 1.2,
        condition: (p) => p.relationship && p.relationship.children && p.relationship.children.length > 0,
        choices: [
          { label: '把空房间改成书房', effects: { mood: 4, knowledge: 2 }, log: '安静也是一种自由。' },
          { label: '养只狗填补空虚', effects: { mood: 6, wealth: -2 }, log: '每天有只狗等你回家，日子又有了节奏。' },
          { label: '多找老朋友聚聚', effects: { mood: 3, stress: -3 }, log: '老朋友的好处是不用解释太多。' },
        ],
      },
      {
        id: 'midlife_passion', title: '🎸 中年拾起旧爱好', desc: '柜子里那把落灰的吉他/画笔/相机，你突然想重新拾起来。',
        minAge: 40, maxAge: 65, random: true, repeatable: true, minMonths: 30, weight: 0.6,
        choices: [
          { label: '重新开始练', effects: { mood: 6, stress: -5, knowledge: 1 }, log: '手生了，但快乐没变。' },
          { label: '算了，没时间了', effects: { mood: -2 }, log: '叹了口气，把东西放回去。' },
        ],
      },
      {
        id: 'reconnect_old', title: '📞 旧友来电', desc: '多年不联系的老同学突然打来电话，聊了一个多小时。',
        minAge: 35, maxAge: 75, random: true, repeatable: true, minMonths: 24, weight: 0.5,
        condition: (p) => p.social && p.social.friends.length > 0,
        choices: [
          { label: '约下次见面', effects: { mood: 5, stress: -3 }, log: '有些友情，隔再久也能接上。' },
        ],
      },
      {
        id: 'career_mentor', title: '🧑‍🏫 被请教经验', desc: '年轻同事来请教工作上的事，你才发现自己已经是"前辈"了。',
        minAge: 40, maxAge: 65, random: true, repeatable: true, minMonths: 18, weight: 0.5,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '耐心指点', effects: { mood: 4, flags: { kind: true } }, log: '教人的过程，自己也理清了思路。' },
        ],
      },

      // 退休期（60–85 岁）
      {
        id: 'retire_travel', title: '🧳 退休旅行', desc: '终于有时间了，想去哪就去哪。',
        minAge: 58, maxAge: 85, random: true, repeatable: true, minMonths: 24, weight: 0.7,
        condition: (p) => p.career && p.career.phase === 'retired' && p.wealth >= 8,
        choices: [
          { label: '来一场说走就走的旅行', effects: { mood: 8, wealth: -6, knowledge: 2, stress: -6 }, log: '退休后的第一场旅行，比想象中还自由。' },
          { label: '太折腾了，在家歇着', effects: { mood: 2 }, log: '家里的沙发也很舒服。' },
        ],
      },
      {
        id: 'retire_garden', title: '🌻 开始种菜', desc: '楼下有块空地，你决定试试种点东西。',
        minAge: 55, maxAge: 90, random: true, repeatable: true, minMonths: 20, weight: 0.4,
        choices: [
          { label: '种起来', effects: { mood: 5, health: 1, stress: -4 }, log: '看着种子发芽，比什么都踏实。' },
        ],
      },
      {
        id: 'retire_class', title: '📚 上老年大学', desc: '社区开了书法/摄影/太极班，你报了个名。',
        minAge: 58, maxAge: 85, random: true, repeatable: true, minMonths: 24, weight: 0.5,
        condition: (p) => p.career && p.career.phase === 'retired',
        choices: [
          { label: '去上课', effects: { mood: 5, knowledge: 2, stress: -3 }, log: '学东西不为考试，纯粹因为喜欢。' },
          { label: '在家看电视', effects: { mood: 1 }, log: '遥控器也挺忙的。' },
        ],
      },
      {
        id: 'grandparent', title: '👶 当爷爷奶奶了', desc: '孩子打电话来报喜，你升级当爷爷奶奶了。',
        minAge: 50, maxAge: 80, random: true, weight: 1.5,
        condition: (p) => p.relationship && p.relationship.children && p.relationship.children.length > 0,
        choices: [
          { label: '去看孙子', effects: { mood: 10, stress: -5, flags: { kind: true } }, log: '抱起小家伙的那一刻，觉得一切都值了。' },
          { label: '视频看看就好', effects: { mood: 5 }, log: '屏幕里的小脸，笑得跟孩子小时候一模一样。' },
        ],
      },

      // 老年（75–100 岁）
      {
        id: 'elder_legacy', title: '📝 写点东西留下来', desc: '你开始想把自己这辈子的经历写下来。',
        minAge: 70, maxAge: 100, random: true, repeatable: true, minMonths: 30, weight: 0.4,
        choices: [
          { label: '开始动笔', effects: { mood: 5, knowledge: 1, stress: -3 }, log: '写着写着才发现，这辈子比想象中精彩。' },
          { label: '想想就好了', effects: { mood: 1 }, log: '有些故事只适合放在心里。' },
        ],
      },
      {
        id: 'elder_oldphoto', title: '📸 翻老照片', desc: '柜子深处翻出一叠发黄的老照片。',
        minAge: 60, maxAge: 100, random: true, repeatable: true, minMonths: 24, weight: 0.3,
        choices: [
          { label: '一张张看完', effects: { mood: 6, stress: -4 }, log: '每张照片背后都藏着一个已经忘了一半的故事。' },
        ],
      },
      {
        id: 'elder_visit', title: '🏠 旧地重游', desc: '回到长大的地方看了看，一切都变了又好像没变。',
        minAge: 55, maxAge: 100, random: true, repeatable: true, minMonths: 36, weight: 0.3,
        choices: [
          { label: '走走老街', effects: { mood: 5, stress: -3 }, log: '记忆里的巷子窄了，树高了，人散了。' },
        ],
      },
      {
        id: 'elder_neighbor', title: '👴 和老邻居聊天', desc: '楼下老邻居搬了把椅子出来晒太阳，你凑过去聊了一下午。',
        minAge: 60, maxAge: 100, random: true, repeatable: true, minMonths: 12, weight: 0.4,
        choices: [
          { label: '聊聊过去', effects: { mood: 4, stress: -3 }, log: '老邻居的好处是：你们共享同一段历史。' },
        ],
      },
      {
        id: 'elder_sunshine', title: '☀️ 晒太阳', desc: '冬天的太阳暖洋洋的，你在院子里坐了一下午。',
        minAge: 65, maxAge: 100, random: true, repeatable: true, minMonths: 8, weight: 0.3,
        choices: [
          { label: '眯一会儿', effects: { mood: 3, health: 1, stress: -2 }, log: '阳光是最好的补药。' },
        ],
      },

      // 通用补充（中段空转对策：带条件的 repeatable 事件）
      {
        id: 'side_gig_idea', title: '💡 副业灵感', desc: '刷手机刷到一个副业案例，你有点心动。',
        minAge: 22, maxAge: 55, random: true, repeatable: true, minMonths: 20, weight: 0.5,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '利用业余时间试试', effects: { wealth: 3, mood: -1, knowledge: 1 }, log: '多一份收入，也多一份疲惫。' },
          { label: '算了吧，主业够忙了', effects: { mood: 1 }, log: '专注当下也好。' },
        ],
      },
      {
        id: 'unexpected_gift', title: '🎁 收到意外礼物', desc: '朋友/同事送了你一份小礼物，完全出乎意料。',
        minAge: 16, maxAge: 95, random: true, repeatable: true, minMonths: 18, weight: 0.4,
        choices: [
          { label: '开心收下', effects: { mood: 6 }, log: '被惦记的感觉真好。' },
        ],
      },
      {
        id: 'weekend_market', title: '🛒 逛早市', desc: '周末起了个大早去逛早市，热闹又新鲜。',
        minAge: 18, maxAge: 85, random: true, repeatable: true, minMonths: 14, weight: 0.3,
        choices: [
          { label: '买了新鲜食材', effects: { mood: 3, health: 1, wealth: -0.5 }, log: '烟火气才是生活的底色。' },
        ],
      },
      {
        id: 'power_outage', title: '🔦 停电了', desc: '小区突然停电，黑暗中你点起了蜡烛。',
        minAge: 12, maxAge: 80, random: true, repeatable: true, minMonths: 30, weight: 0.3,
        choices: [
          { label: '烛光下聊聊天', effects: { mood: 3 }, log: '没有手机和电视的夜晚，反而格外安静。' },
          { label: '早点睡', effects: { health: 1, mood: 1 }, log: '早睡早起身体好。' },
        ],
      },
      {
        id: 'lost_wallet', title: '👛 捡到钱包', desc: '路上捡到一个钱包，里面有身份证和几张钞票。',
        minAge: 12, maxAge: 85, random: true, repeatable: true, minMonths: 36, weight: 0.3,
        choices: [
          { label: '想办法还给失主', effects: { mood: 5, flags: { kind: true } }, log: '失主连声道谢，你觉得做了件对的事。' },
          { label: '交给派出所', effects: { mood: 3, flags: { kind: true } }, log: '举手之劳，心安理得。' },
          { label: '揣自己兜里', effects: { wealth: 2, mood: -3 }, log: '钱到手了，心里却不太踏实。' },
        ],
      },

      // ============ v2.3.0 · 职场黄金期（上学 → 退休）专属事件 ============
      // 补强 22~60 岁的内容密度：职场纵深（35 岁危机 / 裁员 / 外派 / 竞聘 / 考证）、
      // 子女成长链（入学 → 青春期 → 高考 → 毕业，按孩子年龄精确触发）、
      // 人情社交（同学会 / 婚礼随礼 / 相亲）、中年健康（亚健康 / 马拉松）、
      // 职业尾声（内退 / 返聘）与家居（装修）。

      // —— 职场纵深 ——
      {
        id: 'career_35_crisis', title: '🌗 三十五岁这道坎', desc: '招聘启事上又见"限 35 岁以下"，你盯着屏幕看了很久。',
        minAge: 35, maxAge: 38,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '深耕专业，做到不可替代', effects: { knowledge: 5, intelligence: 1, stress: 3, mood: -1 }, plants: ['burnout'], log: '你把别人刷视频的时间都砸进了专业里。' },
          { label: '竞聘管理岗，往上走', risk: { chance: 0.5, success: { wealth: 10, mood: 6, flags: { manage: true, tookRisk: true } }, failure: { mood: -7, stress: 6 }, goodLog: '你坐进了会议室的长桌，说话开始有人记笔记。', badLog: '名额给了别人，你笑着鼓掌，心里发涩。' } },
          { label: '摸索副业，多条腿走路', effects: { wealth: 3, mood: -2, knowledge: 2, flags: { side_hustle: true } }, log: '下班后的两小时，成了你的第二份事业。' },
          { label: '考公考编，求个安稳', risk: { chance: 0.35, success: { knowledge: 6, mood: 4, wealth: 2, flags: { stable_track: true } }, failure: { mood: -5, knowledge: 3 }, goodLog: '上岸了。收入变成了按月到账的踏实。', badLog: '差零点几分，你把书合上，决定认命。' } },
        ],
      },
      {
        id: 'career_layoff', title: '📉 你被裁了', desc: 'HR 的谈话很简短：N+1 赔偿，今天交回工牌。',
        minAge: 28, maxAge: 55, random: true, repeatable: true, minMonths: 30, weight: 0.8,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '拿赔偿金，休整一个月再战', effects: { wealth: 8, mood: -4, stress: -6, health: 2 }, log: '你睡到自然醒，第三周才敢想简历的事。' },
          { label: '马不停蹄投简历', risk: { chance: 0.55, success: { wealth: 4, mood: 3 }, failure: { mood: -8, stress: 8, wealth: -2 }, goodLog: '两周内拿到 offer，无缝衔接。', badLog: '三个月没有回音，你开始怀疑自己。' } },
          { label: '趁机歇半年，陪陪家人', effects: { mood: 6, wealth: -6, health: 3, stress: -8, flags: { familyFirst: true } }, log: '你第一次去接孩子放学，老师都没认出你。' },
        ],
      },
      {
        id: 'career_assignment', title: '🌍 外派的机会', desc: '公司要在新城市设点，点名让你去带队，待遇上浮三成。',
        minAge: 25, maxAge: 45, random: true, repeatable: true, minMonths: 24, weight: 0.7,
        condition: (p) => p.career && p.career.phase === 'employed' && (p.intelligence || 0) >= 55,
        choices: [
          { label: '接下外派，搏一段前程', risk: { chance: 0.6, success: { wealth: 15, knowledge: 3, mood: 3, flags: { tookRisk: true } }, failure: { mood: -6, stress: 8, health: -3 }, goodLog: '新据点做得漂亮，你成了人人提起时的名字。', badLog: '人生地不熟，项目没起色，婚姻也亮了红灯。' } },
          { label: '婉拒，家人都在这里', effects: { mood: 2, wealth: -1, flags: { familyFirst: true } }, log: '你推掉了任命，晚饭桌上却没人知道你放弃了什么。' },
          { label: '让给同事，卖个人情', effects: { mood: 1, stress: -2 }, plants: ['network'], log: '同事感激不尽，这份人情你记在心里。' },
        ],
      },
      {
        id: 'exam_cert', title: '📜 要不要考个证', desc: '同事都在备考行业证书，报名费不菲，考下来也许有用。',
        minAge: 24, maxAge: 50, random: true, repeatable: true, minMonths: 18, weight: 0.9,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '报班冲刺，一次拿下', risk: { chance: 0.65, success: { knowledge: 6, intelligence: 1, mood: 3, wealth: -3 }, failure: { knowledge: 2, mood: -4, wealth: -3 }, goodLog: '证书到手，简历又厚了一页。', badLog: '差几分没过，报名费打了水漂。' } },
          { label: '自己啃书，慢慢考', effects: { knowledge: 3, mood: -1, wealth: -1 }, log: '地铁上的时间都用来刷题了。' },
          { label: '证书不等于能力，算了', effects: { mood: 1 }, log: '你把报名页面关了，继续干活。' },
        ],
      },
      {
        id: 'office_politics', title: '🎭 竞聘管理层', desc: '部门主管的位置空出来了，你和另一位同事都是人选。',
        minAge: 28, maxAge: 50, random: true, repeatable: true, minMonths: 24, weight: 0.8,
        condition: (p) => p.career && p.career.phase === 'employed' && (p.career.workYears || 0) >= 5,
        choices: [
          { label: '全力争取，该争就争', risk: { chance: 0.5, success: { wealth: 10, mood: 6, flags: { manage: true } }, failure: { mood: -7, stress: 6 }, goodLog: '任命公布，你的名字在第一位。', badLog: '你输了，还要笑着给赢家道喜。' } },
          { label: '让给资历更老的同事', effects: { mood: -2, stress: -2 }, plants: ['network'], log: '老同事记住了你的退让，来年投桃报李。' },
          { label: '不掺和，专心做事', effects: { mood: 1, knowledge: 1 }, log: '你把精力留给了手里的项目。' },
        ],
      },
      {
        id: 'career_referral', title: '📨 老熟人递来机会', desc: '多年前认识的老熟人发来消息：团队正缺人，待遇开得很诚恳。',
        minAge: 22, maxAge: 55, random: true, repeatable: true, minMonths: 12, weight: 1.2,
        requiresSeed: 'network', consumesSeed: 'network',
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '去面试试试', risk: { chance: 0.65, success: { wealth: 10, mood: 5, knowledge: 1, flags: { tookRisk: true } }, failure: { mood: -3 }, goodLog: '熟人内推一路绿灯，你换了更好的坑位。', badLog: '聊完发现业务不匹配，权当摸了摸行情。' } },
          { label: '婉拒，但保持联络', effects: { mood: 1 }, plants: ['network'], log: '你说暂时不动，对方说随时欢迎。' },
          { label: '顺便打听行情', effects: { knowledge: 1, mood: 1 }, log: '一席话聊下来，你对自己的身价心里有数了。' },
        ],
      },

      // —— 子女成长链（按孩子年龄触发；入学/高考/毕业为一次性里程碑，逐月优先扫描，
      //      保证"孩子人生的大日子"必然出现，与主角自己的 gaokao_major 同一待遇） ——
      {
        id: 'kid_school_choice', title: '🏫 孩子要上小学了', desc: '九月开学在即：对口小学普通，重点小学要一笔赞助费。',
        minAge: 24, maxAge: 52,
        condition: (p) => !!(p.relationship && p.relationship.children && p.relationship.children.some((c) => Game.state.s.clock.age - (c.birthAge || 0) === 6)),
        choices: [
          { label: '咬牙择校，不能输在起跑线', effects: { wealth: -12, stress: 4, mood: 2, flags: { tiger_parent: true } }, log: '赞助费交了，你也开始了接送与陪写的漫长战役。' },
          { label: '就近入学，快乐童年', effects: { mood: 4, stress: -2, flags: { chill_parent: true } }, log: '步行五分钟的学校，孩子多睡半小时，你们都轻松。' },
          { label: '择校费太高，自己抓家庭教育', effects: { knowledge: 2, mood: -1, stress: 3 }, log: '你翻遍了育儿书，把自己逼成了半个老师。' },
        ],
      },
      {
        id: 'kid_rebellion', title: '🌀 青春期的孩子', desc: '房门总是反锁，成绩下滑，说三句顶两句。',
        minAge: 30, maxAge: 60, random: true, repeatable: true, minMonths: 20, weight: 1.1,
        condition: (p) => !!(p.relationship && p.relationship.children && p.relationship.children.some((c) => { const a = Game.state.s.clock.age - (c.birthAge || 0); return a >= 13 && a <= 15; })),
        choices: [
          { label: '严加管教，不能放任', risk: { chance: 0.45, success: { mood: 2, knowledge: 1 }, failure: { mood: -6, stress: 6 }, goodLog: '约法三章后，孩子慢慢回到正轨。', badLog: '摔门声成了家里的背景音，你气得失眠。' } },
          { label: '退一步，先当朋友', effects: { mood: 3, stress: -2 }, log: '你不再追问成绩，孩子反而开始跟你说学校的事。' },
          { label: '报辅导班，交给专业的人', effects: { wealth: -4, mood: -2 }, log: '成绩没见起色，家里的开支倒是先涨了。' },
        ],
      },
      {
        id: 'kid_gaokao', title: '🎓 孩子的高考', desc: '孩子出分了，志愿表摊在饭桌上，全家都屏住了呼吸。',
        minAge: 36, maxAge: 64,
        condition: (p) => !!(p.relationship && p.relationship.children && p.relationship.children.some((c) => Game.state.s.clock.age - (c.birthAge || 0) === 18)),
        choices: [
          { label: '尊重孩子自己的选择', effects: { mood: 6, flags: { respect_child: true } }, log: '孩子眼睛发亮地讲他的计划，你只说了句"去吧"。' },
          { label: '帮孩子规划热门专业', risk: { chance: 0.5, success: { mood: 4, knowledge: 2 }, failure: { mood: -5, stress: 4 }, goodLog: '一家三口熬了三夜，填出一份无怨无悔的志愿表。', badLog: '孩子闷着心思想复读，你们谁也说服不了谁。' } },
          { label: '建议留在离家近的城市', effects: { mood: 3 }, log: '孩子点了点头，你心里却又盼着他能飞远一点。' },
        ],
      },
      {
        id: 'kid_graduate', title: '🧳 孩子毕业了', desc: '孩子毕业想留在大城市闯一闯，家里忽然就剩你们俩。',
        minAge: 40, maxAge: 72,
        condition: (p) => !!(p.relationship && p.relationship.children && p.relationship.children.some((c) => { const a = Game.state.s.clock.age - (c.birthAge || 0); return a >= 22 && a <= 23; })),
        choices: [
          { label: '支持孩子去闯，给笔启动金', effects: { wealth: -8, mood: 5 }, log: '你把卡里的钱转过去，附了一句：闯不动了就回家。' },
          { label: '劝孩子回家乡考编', risk: { chance: 0.5, success: { mood: 4 }, failure: { mood: -4, stress: 3 }, goodLog: '孩子听了劝，一家人又聚在了一张桌上。', badLog: '孩子头也不回地走了，你对着空房间坐了很久。' } },
          { label: '随孩子自己的意', effects: { mood: 3 }, log: '儿孙自有儿孙福，你把牵挂收进了心底。' },
        ],
      },

      // —— 婚姻 · 人情社交 ——
      {
        id: 'seven_year_itch', title: '💞 七年之痒', desc: '婚姻进入第七个年头，日子像白开水，连吵架都省了。',
        minAge: 25, maxAge: 60, random: true, repeatable: true, minMonths: 36, weight: 0.9,
        condition: (p) => !!(p.relationship && p.relationship.married && p.relationship.marriedAge && Game.state.s.clock.age - p.relationship.marriedAge >= 7),
        choices: [
          { label: '重启一次二人旅行', effects: { mood: 8, wealth: -6, stress: -4 }, log: '把孩子托付给老人，你们像刚恋爱时那样牵手逛街。' },
          { label: '认真谈一次心里话', risk: { chance: 0.7, success: { mood: 6, stress: -3 }, failure: { mood: -3 }, goodLog: '有些话憋了七年，说出来才发现对方也在等。', badLog: '话没说两句就变了味，你悻悻地闭了嘴。' } },
          { label: '就这样过吧，都一样', effects: { mood: -2 }, plants: ['cold_war'], delayed: [{ inMonths: 8, event: 'marriage_crack' }], log: '你把那句话咽了回去，日子继续白开水地淌。' },
        ],
      },
      {
        id: 'class_reunion', title: '🥂 同学聚会', desc: '毕业十周年聚会，有人开着豪车来，有人刚还完这个月房贷。',
        minAge: 26, maxAge: 50, random: true, repeatable: true, minMonths: 20, weight: 0.8,
        choices: [
          { label: '大方赴宴，聊近况不比收入', effects: { mood: 5, wealth: -1, stress: -2 }, plants: ['network'], log: '散场时你们互相留了联系方式，说常聚。' },
          { label: '攀比着来，憋着一口气', effects: { mood: -3, wealth: -5, stress: 4 }, log: '你抢着买了单，回家路上心里空落落的。' },
          { label: '借口加班没去', effects: { mood: -1 }, log: '群里热热闹闹，你默默点了个赞。' },
        ],
      },
      {
        id: 'wedding_gift', title: '💒 婚礼请柬', desc: '大学好友结婚，红色请柬背后是一笔人情账。',
        minAge: 22, maxAge: 35, random: true, repeatable: true, minMonths: 14, weight: 0.8,
        choices: [
          { label: '包个大红包，风风光光', effects: { wealth: -3, mood: 4 }, plants: ['network'], log: '你举杯祝酒，新人红了眼眶。' },
          { label: '随大流随个份子', effects: { wealth: -1, mood: 2 }, log: '酒席热闹，你吃得尽兴。' },
          { label: '人不到礼到', effects: { wealth: -0.8, mood: 1 }, log: '你转了账，在群里发了段祝福。' },
        ],
      },
      {
        id: 'blind_date', title: '💌 一场相亲', desc: '姑姑又给你介绍了个条件不错的对象，约在周末。',
        minAge: 24, maxAge: 34, random: true, repeatable: true, minMonths: 12, weight: 0.8,
        condition: (p) => !(p.relationship && p.relationship.married),
        choices: [
          { label: '认真赴约，好好聊聊', risk: { chance: 0.4, success: { mood: 8 }, failure: { mood: -2 }, goodLog: '居然聊到了餐厅打烊，你们交换了联系方式。', badLog: '尬聊四十分钟，你借口买单逃了出来。' } },
          { label: '去露个面，应付了事', effects: { mood: 1 }, log: '你礼貌地喝完那杯咖啡，各自安好。' },
          { label: '婉拒，感情随缘', log: '你说不急，姑姑说"你都多大了"。' },
        ],
      },

      // —— 中年健康 ——
      {
        id: 'subhealth', title: '📋 体检单上的箭头', desc: '年度体检报告一串向上的箭头：脂肪肝、颈椎变直、血脂偏高。',
        minAge: 30, maxAge: 55, random: true, repeatable: true, minMonths: 16, weight: 1.0,
        // 健康日常会自然回满，故以"职场压力"为主门控（健康<75 兜底照顾久病者）
        condition: (p) => (p.mental && p.mental.stress >= 40) || p.health < 75,
        choices: [
          { label: '下决心系统锻炼', effects: { health: 5, immunity: 3, mood: 1, wealth: -1 }, plants: ['fit'], log: '你翻出落灰的运动鞋，把跑步排进了日程表。' },
          { label: '办张游泳卡试试', effects: { health: 3, mood: 1, wealth: -2 }, plants: ['fit'], log: '水温很舒服，你游了两圈就开始喘。' },
          { label: '熬夜依旧，明年再说', effects: { health: -3, mood: 1 }, log: '报告被你塞进抽屉最底层，身体却记了账。' },
        ],
      },
      {
        id: 'marathon', title: '🏃 报名一场马拉松', desc: '城市马拉松开放报名，同事怂恿你一起。',
        minAge: 25, maxAge: 60, random: true, repeatable: true, minMonths: 24, weight: 0.6,
        condition: (p) => p.health >= 60,
        choices: [
          { label: '科学训练，站上起跑线', risk: { chance: 0.65, success: { health: 6, mood: 8, stress: -6, flags: { marathon: true } }, failure: { health: -4, mood: -4 }, goodLog: '冲过终点那一刻，你把奖牌挂了一整天。', badLog: '三十公里处撞墙，你一瘸一拐被收容车接走。' } },
          { label: '报个半马意思一下', effects: { health: 2, mood: 4, wealth: -0.5 }, log: '完赛奖牌不大，但也是奖牌。' },
          { label: '围观就好，给你加油', effects: { mood: 1 }, log: '你在路边挥手，喊得比选手还卖力。' },
        ],
      },

      // —— 家居 · 职业尾声 ——
      {
        id: 'house_renovate', title: '🛠️ 装修还是将就', desc: '装修公司的报价单递到你手上，数字后面跟着好几个零。',
        minAge: 27, maxAge: 58, random: true, repeatable: true, minMonths: 30, weight: 0.7,
        condition: (p) => !!(Game.assets && typeof Game.assets.summary === 'function' && Game.assets.summary().houses.length > 0),
        choices: [
          { label: '装出理想中的家', effects: { wealth: -15, mood: 8, stress: 5 }, log: '三个月监工下来，新家亮堂堂，人也瘦了一圈。' },
          { label: '简单翻新，够住就行', effects: { wealth: -5, mood: 3 }, log: '刷了墙换了灯，家焕然一新，钱包毫发无损。' },
          { label: '再凑合两年', effects: { mood: -1 }, log: '你把报价单收进抽屉，墙上的水渍还在那里。' },
        ],
      },
      {
        id: 'pre_retire_choice', title: '🌗 内退还是返聘', desc: '单位征集提前退养意向：内退工资打折，返聘则再干几年。',
        minAge: 55, maxAge: 62,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '接受返聘，再发光发热', effects: { wealth: 10, health: -3, stress: 4 }, log: '你留下来带了带徒弟，工资单上又多了几年。' },
          { label: '内退，早点开始第二人生', effects: { mood: 6, wealth: -4, health: 3, stress: -6 }, log: '你交还了门禁卡，第二天就去报了太极班。' },
          { label: '干到正式退休', effects: { mood: 1 }, log: '你选择按部就班，站好最后一班岗。' },
        ],
      },

      // ============ v2.4.0 · 班级档次（分班/调班）事件 ============
      // 与 config.education.classTiers 联动：高档班有"内卷压力"，普通班有"冲班机会"；
      // reclass 指令由 decisions.resolve 转发给 education.moveClass（'+1' 升一档 / '-1' 降一档）。
      {
        id: 'class_pressure', title: '🌕 重点班的无形压力', desc: '班里人人刷题到深夜，排名像鞭子一样抽着所有人往前跑。',
        minAge: 8, maxAge: 25, random: true, repeatable: true, minMonths: 10, weight: 0.9,
        stages: ['school'],
        condition: (p) => p.education && p.education.inSchool && ['rocket', 'elite'].indexOf(p.education.classKey) >= 0,
        choices: [
          { label: '跟上大部队，继续卷', effects: { knowledge: 3, mood: -3 }, plants: ['burnout'], log: '你把睡眠又削掉一截，排名总算稳住了。' },
          { label: '保持自己的节奏', effects: { mood: 3, knowledge: 1 }, log: '你按自己的计划走，反而学得更扎实。' },
          { label: '向父母提出想换班', risk: { chance: 0.5, success: { mood: 5, reclass: '-1' }, failure: { mood: -2 }, goodLog: '父母想了想，同意了——换条赛道不等于认输。', badLog: '"别人都能坚持，就你不行？"谈话不欢而散。' } },
        ],
      },
      {
        id: 'class_promotion_exam', title: '🎯 一次进重点班的机会', desc: '老师说年级有个调班名额，分班考试过关就能进去，问你要不要试。',
        minAge: 7, maxAge: 24, random: true, repeatable: true, minMonths: 14, weight: 1.0,
        stages: ['school'],
        condition: (p) => p.education && p.education.inSchool && p.education.classKey === 'regular',
        choices: [
          { label: '报名，冲刺一把', risk: { chance: 0.45, success: { mood: 5, knowledge: 2, reclass: '+1' }, failure: { mood: -3, knowledge: 1 }, goodLog: '你考进去了！班主任在班会上点名表扬了你。', badLog: '差了几分，老师说"下次还有机会"。' } },
          { label: '再准备准备，下次再说', effects: { mood: 1, knowledge: 1 }, log: '你把这次机会让给了更渴望它的人。' },
          { label: '普通班挺好的，不去', effects: { mood: 2 }, log: '鸡头还是凤尾，你选了前者。' },
        ],
      },

      // —— 升学到岔路 ——
      {
        id: 'gaokao_major', title: '🎓 志愿填报', desc: '十年寒窗揭晓，你要为未来选一个方向。',
        minAge: 18, maxAge: 19, random: false,
        condition: (p) => p.education && ['本科', '大专'].includes(p.education.level),
        choices: [
          { label: '追随热爱，选喜欢的专业', effects: { mood: 8, knowledge: 3, flags: { passion: true } }, log: '你学了心中所爱。' },
          { label: '选“好就业”的热门专业', effects: { wealth: 8, mood: -2, flags: { practical: true } }, log: '你选了风口专业，起薪更高。' },
          { label: '服从调剂，稳妥上岸', effects: { knowledge: 2, mood: 1 }, log: '你先稳稳上了岸。' },
        ],
      },
      {
        id: 'study_abroad', title: '🌏 公派留学的机会', desc: '一个出去看看世界的名额，代价是家里的积蓄。',
        minAge: 19, maxAge: 24, random: true,
        condition: (p) => p.education && p.education.inSchool && p.wealth > 10,
        choices: [
          { label: '申请出国深造', risk: { chance: 0.75,
            success: { knowledge: 12, intelligence: 4, mood: 6, wealth: -15, flags: { studyAbroad: true, tookRisk: true } },
            failure: { knowledge: 6, mood: -6, wealth: -15 },
            goodLog: '你开阔了眼界，履历镀了金。', badLog: '水土不服、语言吃力，收获没那么大。' } },
          { label: '留在国内，省下这笔钱', effects: { mood: 1, knowledge: 3 }, log: '你选择稳扎稳打。' },
        ],
      },
      // —— 职场 ——
      {
        id: 'job_offer', title: '💼 两份 offer', desc: '一家大厂高薪但要去外地；一家本地公司清闲钱少。',
        minAge: 22, maxAge: 28, random: true,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '去大厂拼一把', effects: { wealth: 18, mood: -4, health: -3, flags: { bigCity: true } }, log: '你进了大厂，钱多了也累。' },
          { label: '留在家门口', effects: { mood: 6, health: 2, wealth: -3, flags: { settled: true } }, log: '你守着家人与生活，岁月静好。' },
        ],
      },
      {
        id: 'promotion_overwork', title: '📊 升职，还是养生', desc: '领导赏识，要给你加担子——但你最近身体有点吃不消。',
        minAge: 30, maxAge: 52, random: true,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '接下来，拼事业', effects: { wealth: 10, health: -6, mood: -2, intelligence: 1 }, log: '你升了职，也熬坏了身体。' },
          { label: '婉拒，保重身体', effects: { health: 4, mood: 3, wealth: -2 }, log: '你选择了不透支自己。' },
        ],
      },
      {
        id: 'startup', title: '🚀 下海创业？', desc: '几个朋友拉你合伙，前景诱人，但可能要赔个精光。',
        minAge: 26, maxAge: 45, random: true,
        condition: (p) => p.wealth > 15,
        choices: [
          {
            label: '投一大笔，赌这个梦', risk: { chance: 0.35,
              success: { wealth: 60, mood: 12, intelligence: 4, plants: ['boss'], delayed: [{ inMonths: 24, event: 'partner_row' }] }, failure: { wealth: -40, mood: -12, health: -3 },
              goodLog: '公司一炮而红，你财务自由了一大截！', badLog: '创业失败，积蓄打了水漂。' } },
          { label: '不冒险，好好上班', effects: { mood: 1, wealth: 2 }, log: '你按捺住了野心。' },
        ],
      },
      {
        id: 'midlife_crisis', title: '🌫️ 中年危机', desc: '日复一日让你忽然想“人生就这样了吗？”',
        minAge: 40, maxAge: 55, random: true,
        choices: [
          { label: '辞职，去旅行半年', effects: { mood: 12, wealth: -12, health: 2 }, log: '你给自己放了一个久违的长假。' },
          { label: '考个证，为自己充电', effects: { knowledge: 6, intelligence: 2, mood: 2, wealth: -3 }, log: '你重新做回了学生。' },
          { label: '忍一忍，稳定最重要', effects: { mood: -4, wealth: 3 }, log: '你把情绪咽了下去。' },
        ],
      },
      // —— 家庭 ——
      {
        id: 'buying_home', title: '🏠 买房还是租房', desc: '首付要掏空积蓄，之后每月还贷；租房则灵活。',
        minAge: 27, maxAge: 45, random: true,
        condition: (p) => Game.assets && Game.assets.canBuy('house', 'studio').ok,
        choices: [
          { label: '咬牙买下两居室，安家落户', asset: { act: 'buy', kind: 'house', key: 'two_room' },
            condition: (p) => Game.assets.canBuy('house', 'two_room').ok, effects: { mood: 6 },
            log: '你签下购房合同，在城市里有了自己的家，也背上了二三十年的月供。' },
          { label: '先买套单身公寓，压力小些', asset: { act: 'buy', kind: 'house', key: 'studio' }, effects: { mood: 4 },
            log: '三十平米的小窝，也是自己的。' },
          { label: '继续租房，轻装上阵', effects: { mood: 1, wealth: 4 }, log: '你保持了财务上的自由，租金换灵活。' },
        ],
      },
      // —— 资产：车辆 / 换房 / 变卖（B6 资产系统） ——
      {
        id: 'buy_car_plan', title: '🚗 要不要买辆车', desc: '通勤挤地铁太累，但车是消耗品，落地就折价。',
        minAge: 24, maxAge: 58, random: true, weight: 1.1,
        condition: (p) => Game.assets && Game.assets.canBuy('car', 'budget').ok,
        choices: [
          { label: '买辆代步车，实用为先', asset: { act: 'buy', kind: 'car', key: 'budget' }, effects: { mood: 4 },
            log: '钥匙到手，通勤路上终于有了自己的空间。' },
          { label: '上中级车，体面一点', asset: { act: 'buy', kind: 'car', key: 'mid' },
            condition: (p) => Game.assets.canBuy('car', 'mid').ok, effects: { mood: 7 },
            log: '你开回一辆中级车，同事多看了两眼。' },
          { label: '公共交通挺好，不买', effects: { mood: 1, wealth: 2 }, log: '你算过账，觉得没必要。' },
        ],
      },
      {
        id: 'upgrade_house', title: '🏡 换套大房子', desc: '孩子大了、父母要来住，现在的房子有点挤。',
        minAge: 33, maxAge: 60, random: true,
        condition: (p) => Game.assets && Game.assets.summary().houses.length > 0 && Game.assets.canBuy('house', 'three_room').ok,
        choices: [
          { label: '换三居室，一步到位', asset: { act: 'buy', kind: 'house', key: 'three_room' }, effects: { mood: 10 },
            log: '搬家那天，你站在客厅中间，觉得这些年的累都值了。' },
          { label: '买套郊区别墅，圆一个梦', asset: { act: 'buy', kind: 'house', key: 'villa' },
            condition: (p) => Game.assets.canBuy('house', 'villa').ok, effects: { mood: 16, stress: 4 },
            log: '院子有了，房贷也翻倍了。' },
          { label: '先不换，把钱留着', effects: { wealth: 2, mood: -1 }, log: '你决定继续凑合住着。' },
        ],
      },
      {
        id: 'sell_house_plan', title: '🏚️ 要不要卖掉房子', desc: '有人出价了：现金为王，还是房子更保值？',
        minAge: 45, maxAge: 78, random: true, weight: 0.9,
        condition: (p) => Game.assets && Game.assets.summary().houses.length > 0,
        choices: [
          { label: '挂牌卖出，换成现金', asset: { act: 'sell', kind: 'house' }, effects: { mood: -2 },
            log: '房子出手了，账户数字涨了一大截，心里却有点空。' },
          { label: '留着，房子更抗通胀', effects: { mood: 2 }, log: '你决定守着这套房子，等它慢慢长。' },
        ],
      },
      {
        id: 'sell_car_plan', title: '🔑 车还留着吗', desc: '车开了些年头，是卖掉换钱，还是继续开着？',
        minAge: 45, maxAge: 80, random: true,
        condition: (p) => Game.assets && Game.assets.summary().cars.length > 0,
        choices: [
          { label: '卖掉，打车也方便', asset: { act: 'sell', kind: 'car' }, effects: { mood: -1 },
            log: '车卖了，往后每年省下的保养油费不少。' },
          { label: '继续开，有车有自由', effects: { mood: 2 }, log: '你决定再开几年。' },
        ],
      },
      {
        id: 'second_child', title: '👶 要不要再添一个孩子', desc: '大宝想要个弟弟妹妹，但养娃的成本和精力你得掂量。',
        minAge: 24, maxAge: 40, random: true,
        condition: (p) => p.relationship && p.relationship.married && p.relationship.children.length >= 1 && p.relationship.children.length < 3,
        choices: [
          { label: '再生一个，热闹', effects: { mood: 6, health: -3, wealth: -8 }, log: '家里更闹腾，也更暖了。' },
          { label: '先把一个养好', effects: { mood: 2, wealth: 4 }, log: '你决定精养而非多生。' },
        ],
      },
      {
        id: 'parents_care', title: '🧓 父母年迈了', desc: '二老身体大不如前，怎么照顾他们，是个两难。',
        minAge: 40, maxAge: 62, random: true,
        choices: [
          { label: '接到身边亲自照料', effects: { mood: 5, wealth: -8, health: -2, flags: { filial: true } }, log: '你陪他们走过了晚年。' },
          { label: '请专业护工', effects: { mood: 1, wealth: -12 }, log: '你尽力给了他们体面的照护。' },
        ],
      },
      // —— 健康 / 财富 / 投资 ——
      {
        id: 'investment', title: '📈 朋友推荐的“稳赚”项目', desc: '门槛十万，说得天花乱坠，但风险自负。',
        minAge: 28, maxAge: 62, random: true,
        condition: (p) => p.wealth > 15,
        choices: [
          {
            label: 'all in 投进去', risk: { chance: 0.5,
              success: { wealth: 40, mood: 8 }, failure: { wealth: -25, mood: -10 },
              goodLog: '踩对了点，账面翻了一番。', badLog: '遇上暴雷，损失惨重。' } },
          { label: '投一小部分试试水', risk: { chance: 0.55,
            success: { wealth: 8, mood: 3 }, failure: { wealth: -5, mood: -3 },
            goodLog: '小赚一笔。', badLog: '小亏，及时收手。' } },
          { label: '不碰', effects: { mood: 1 }, log: '你选择了不眼红。' },
        ],
      },
      {
        id: 'health_screen', title: '🩺 要不要做个全身体检', desc: '最近总觉得不太对劲，体检要花钱也怕查出点什么。',
        minAge: 48, maxAge: 78, random: true,
        choices: [
          {
            label: '去查，早发现早处理', risk: { chance: 0.85,
              success: { health: 8, wealth: -2, mood: 2 }, failure: { health: -4, wealth: -6, mood: -4 },
              goodLog: '查出小问题及时处理，虚惊一场。', badLog: '查出了点毛病，好在开始重视身体。' } },
          { label: '不去，没病找病', risk: { chance: 0.5,
            success: { wealth: 2 }, failure: { health: -8, mood: -6 },
            goodLog: '啥事没有，省了笔钱。', badLog: '小病拖成了大病。' } },
        ],
      },
      {
        id: 'charity', title: '🎗️ 一笔力所能及的善意', desc: '一个公益项目在募资，你可以搭把手。',
        minAge: 35, maxAge: 72, random: true,
        condition: (p) => p.wealth > 25,
        choices: [
          { label: '捐一笔', effects: { wealth: -10, mood: 8, flags: { kind: true } }, log: '赠人玫瑰，手有余香。' },
          { label: '留着自用', effects: { wealth: 2, mood: -1 }, log: '你收好了钱包。' },
        ],
      },
      // —— 晚年 ——
      {
        id: 'retirement_plan', title: '🌇 退休怎么过', desc: '辛苦了大半辈子，接下来的钱和时间，你想怎么花？',
        minAge: 58, maxAge: 62, random: false,
        choices: [
          { label: '尽情去看世界', effects: { mood: 12, wealth: -15, health: -1 }, log: '你终于把时间还给了自己。' },
          { label: '含饴弄孙、省钱养生', effects: { mood: 5, health: 4, wealth: 3 }, log: '你享受平淡的天伦之乐。' },
        ],
      },
      {
        id: 'legacy_plan', title: '📜 立一份遗嘱', desc: '年过花甲，你开始盘算身后的事，想把一生积累留给谁。',
        minAge: 63, maxAge: 85, random: false,
        choices: [
          { label: '大都留给子女', effects: { mood: 5, flags: { familyFirst: true } }, log: '你把牵挂留给了家人。' },
          { label: '拿出一部分捐助公益', effects: { mood: 8, wealth: -8, flags: { kind: true, philanthropy: true } }, log: '你决定把部分财富回馈社会。' },
          { label: '暂不理会', effects: { mood: -1 }, log: '你把这件事暂且搁下。' },
        ],
      },
      {
        id: 'elder_care', title: '🏡 养老方式', desc: '步入暮年，你认真考虑：往后的日子，怎么过、在哪过？',
        minAge: 70, maxAge: 74, random: false,
        choices: [
          { label: '居家养老，社区照应', effects: { mood: 4, health: 2, wealth: -2, flags: { homeCare: true } }, log: '守着老屋和街坊，日子踏实。' },
          { label: '入住高端养老院', effects: { mood: 1, health: 4, wealth: -15 }, log: '专业照护让人安心，只是开销不小。' },
          { label: '旅居世界，看尽夕阳', effects: { mood: 10, health: -1, wealth: -25, flags: { wander: true }, plants: ['wanderlust'] }, log: '你把晚年活成了诗和远方。' },
        ],
      },
      {
        id: 'longevity_bash', title: '🎂 八十寿辰', desc: '人到八旬，儿孙围拢——这一场大寿，你想怎么过？',
        minAge: 80, maxAge: 82, random: false,
        choices: [
          { label: '大办一场，儿孙绕膝', effects: { mood: 10, wealth: -8, plants: ['goodwill'] }, log: '四世同堂，你笑得合不拢嘴。' },
          { label: '简单吃碗长寿面', effects: { mood: 4, wealth: 1 }, log: '清淡，却知足。' },
        ],
      },
      {
        id: 'deathbed', title: '🕯️ 当那一天来临', desc: '身体每况愈下，人生的最后一程，你想怎样走过？',
        minAge: 78, maxAge: 120, random: false,
        choices: [
          { label: '积极治疗，不惜代价', effects: { health: 6, wealth: -20, mood: -2, stress: 4 }, log: '你选择再搏一把。' },
          { label: '安宁疗护，少些痛苦', effects: { mood: 6, trauma: -6, health: -2, flags: { peaceful: true } }, log: '你平静地握住亲人的手，体面地走。' },
          { label: '顺其自然，听天由命', effects: { mood: 2 }, log: '你把一切交给时间。' },
        ],
      },

      // ============ 生活流·按月可触发的小事件（部分可重复，带冷却） ============
      // —— 童年 ——
      {
        id: 'want_pet', title: '🐶 想要一只宠物', desc: '同学家养了小狗，你也眼馋得不行。',
        minAge: 6, maxAge: 13, random: true, stages: ['child'], weight: 1.2,
        choices: [
          { label: '撒娇求父母养', effects: { mood: 6, wealth: -2 }, log: '家里多了个毛孩子，你开心坏了。' },
          { label: '乖乖听话没提', effects: { mood: -1, knowledge: 1 }, log: '你把渴望咽了下去，懂事了点。' },
        ],
      },
      {
        id: 'allowance', title: '🍭 攒了不久的零花钱', desc: '手里攥着一点零花钱，小卖部在向你招手。',
        minAge: 6, maxAge: 13, random: true, stages: ['child'], repeatable: true, minMonths: 9, weight: 1,
        choices: [
          { label: '买零食和卡片，痛快一场', effects: { mood: 5, health: -1 }, log: '你痛快地花光了零花钱。' },
          { label: '存进储蓄罐', effects: { wealth: 1, mood: 1 }, log: '你把钱攒了起来，小小理财家。' },
        ],
      },
      {
        id: 'video_game', title: '🎮 想多玩会儿游戏', desc: '周末作业还没写完，可新出的游戏实在诱人。',
        minAge: 8, maxAge: 17, random: true, stages: ['child', 'school'], repeatable: true, minMonths: 9, weight: 1.2,
        choices: [
          { label: '玩个痛快再说', effects: { mood: 5, knowledge: -2 }, log: '你玩到深夜，作业明天补。' },
          { label: '先写完再玩', effects: { knowledge: 2, mood: -1 }, log: '你克制住了，先做了该做的事。' },
        ],
      },
      // —— 学生 ——
      {
        id: 'join_club', title: '🎪 社团招新', desc: '操场上社团招新，你想给校园生活添点亮。',
        minAge: 12, maxAge: 22, random: true, stages: ['school'], weight: 1.1,
        choices: [
          { label: '加入篮球社', effects: { health: 3, immunity: 2, mood: 4 }, log: '你在球场上挥洒汗水，交到一帮兄弟。' },
          { label: '加入文学社', effects: { knowledge: 3, mood: 2 }, log: '你在社团找到了志同道合的人。' },
          { label: '不加，省点时间学习', effects: { knowledge: 1, mood: -1 }, log: '你把时间留给了书本。' },
        ],
      },
      {
        id: 'exam_pressure', title: '📚 大考在即', desc: '期中考压得你喘不过气，熬夜还是保持节奏？',
        minAge: 12, maxAge: 22, random: true, stages: ['school'], repeatable: true, minMonths: 9, weight: 1.2,
        choices: [
          { label: '熬夜刷题冲刺', effects: { knowledge: 4, health: -3, immunity: -2, mood: -1 }, plants: ['burnout'], delayed: [{ inMonths: 10, effects: { health: -5, mood: -2 }, log: '长期熬夜的疲惫，终于找上你。' }], log: '你拼了一把，也熬垮了身体。' },
          { label: '按部就班，好好睡觉', effects: { knowledge: 2, mood: 2, health: 1 }, log: '你稳扎稳打，状态在线。' },
        ],
      },
      {
        id: 'parttime_job', title: '💼 想打份工赚零花', desc: '同学拉你周末去奶茶店兼职，能赚点钱但很累。',
        minAge: 16, maxAge: 22, random: true, stages: ['school'], weight: 1,
        choices: [
          { label: '去！经济独立第一步', effects: { wealth: 3, knowledge: 1, mood: -1, health: -1 }, log: '你靠双手挣到了第一笔打工钱。' },
          { label: '算了，还是以学业为重', effects: { mood: 1 }, log: '你婉拒了，专心读书。' },
        ],
      },
      // —— 职场 ——
      {
        id: 'overtime', title: '🕑 连续加班', desc: '项目临近上线，连着几周都在加班，身体有点吃不消。',
        minAge: 22, maxAge: 60, random: true, stages: ['work'], repeatable: true, minMonths: 9, weight: 1.3,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '扛下来，年终奖要紧', effects: { wealth: 5, health: -4, mood: -3 }, plants: ['burnout'], log: '你熬过了这一波，换来了厚奖。' },
          { label: '准点走，命要紧', effects: { health: 2, mood: 2, wealth: -1 }, log: '你选择了不内卷。' },
        ],
      },
      {
        id: 'colleague_blame', title: '🗯️ 同事当众甩锅', desc: '会上有人把责任推到你头上，会议室安静下来，等你开口。',
        minAge: 22, maxAge: 58, random: true, stages: ['work'], repeatable: true, minMonths: 9, weight: 1,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '当场据理力争', risk: { chance: 0.6, success: { mood: 4 }, failure: { mood: -4, health: -1 }, goodLog: '你占住理，对方哑口无言。', badLog: '闹得有点僵，你憋了一肚子气。' } },
          { label: '忍下来，事后沟通', effects: { mood: -2, knowledge: 1 }, log: '你压下火，找机会私下化解。' },
        ],
      },
      {
        id: 'headhunt', title: '📞 猎头的电话', desc: '一家公司抛出橄榄枝，涨薪诱人，但要重新适应环境。',
        minAge: 24, maxAge: 50, random: true, stages: ['work'], repeatable: true, minMonths: 12, weight: 1,
        condition: (p) => p.career && p.career.phase === 'employed' && p.intelligence > 45,
        choices: [
          { label: '跳槽，赌更大的平台', risk: { chance: 0.6, success: { wealth: 12, mood: 5, knowledge: 2, plants: ['new_job'], delayed: [{ inMonths: 5, event: 'probation_test' }] }, failure: { wealth: -3, mood: -5, health: -2 }, goodLog: '新工作如鱼得水，薪资翻涨。', badLog: '水土不服，跳错坑了。' } },
          { label: '留在原地，稳中求进', effects: { mood: 1 }, log: '你按住了跳槽的心。' },
        ],
      },
      {
        id: 'layoff_scare', title: '📉 裁员传闻', desc: '公司效益不好，小道消息满天飞，人人自危。',
        minAge: 25, maxAge: 58, random: true, stages: ['work'], repeatable: true, minMonths: 14, weight: 1,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '主动表现，稳住位置', risk: { chance: 0.7, success: { wealth: 2, mood: 2 }, failure: { wealth: -1, mood: -3 }, goodLog: '你稳住了阵脚。', badLog: '你还是上了优化名单。' } },
          { label: '开始悄悄物色下家', effects: { mood: -1, knowledge: 1 }, log: '你更新了简历，留了后手。' },
        ],
      },
      {
        id: 'company_trip', title: '🏝️ 公司团建', desc: '难得公费出游，是融入团队的好机会。',
        minAge: 22, maxAge: 58, random: true, stages: ['work'], repeatable: true, minMonths: 16, weight: 0.9,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '全程参与，搞好关系', effects: { mood: 4, health: -1 }, log: '你在团建里拉近了同事关系。' },
          { label: '敷衍露个面就走', effects: { mood: 1 }, log: '你提前溜去休息了。' },
        ],
      },
      // —— 家庭 / 婚姻 ——
      {
        id: 'kid_homework', title: '✏️ 辅导孩子作业', desc: '孩子的数学题把你气得心跳加速，鸡娃还是不鸡？',
        minAge: 24, maxAge: 55, random: true, repeatable: true, minMonths: 9, weight: 1,
        condition: (p) => p.relationship && p.relationship.children.length > 0,
        choices: [
          { label: '严格陪练', effects: { knowledge: 1, mood: -3 }, log: '你把孩子按在桌前，自己也上了火。' },
          { label: '算了，孩子快乐第一', effects: { mood: 3 }, log: '你想通了，陪伴更重要。' },
        ],
      },
      {
        id: 'couple_quarrel', title: '💢 和伴侣吵了一架', desc: '为一点鸡毛蒜皮，你们谁也不肯先低头。',
        minAge: 22, maxAge: 70, random: true, repeatable: true, minMonths: 9, weight: 1,
        condition: (p) => p.relationship && p.relationship.married,
        choices: [
          { label: '先服软，抱一抱', effects: { mood: 4 }, log: '你们重归于好，感情反而更深。' },
          { label: '冷战到底', effects: { mood: -5 }, plants: ['cold_war'], delayed: [{ inMonths: 8, event: 'marriage_crack' }], log: '家里的气压低了好几天。' },
        ],
      },
      {
        id: 'anniversary', title: '💐 结婚纪念日', desc: '又一年，要不要有点仪式感？',
        minAge: 24, maxAge: 80, random: true, repeatable: true, minMonths: 10, weight: 1,
        condition: (p) => p.relationship && p.relationship.married,
        choices: [
          { label: '精心安排一晚', effects: { mood: 7, wealth: -3 }, log: '你们重温了恋爱的心动。' },
          { label: '平淡过日子就好', effects: { mood: 1 }, log: '你们相视一笑，日子细水长流。' },
        ],
      },
      // —— 通用生活 ——
      {
        id: 'phone_scam', title: '📵 一通可疑来电', desc: '"你的账户涉嫌洗钱……"对方说得有鼻子有眼。',
        minAge: 18, maxAge: 92, random: true, repeatable: true, minMonths: 9, weight: 1,
        choices: [
          { label: '果断挂断并举报', effects: { mood: 1 }, log: '你识破了骗局，挂了电话。' },
          { label: '鬼迷心窍地按提示操作', risk: { chance: 0.4, success: { mood: 1 }, failure: { wealth: -8, mood: -6 }, goodLog: '你及时警觉，一分钱没丢。', badLog: '你被唬住，骗走了辛苦钱。' } },
        ],
      },
      {
        id: 'impulse_buy', title: '🛒 深夜剁手', desc: '直播带货喊得人心潮澎湃，购物车躺着一堆"必需品"。',
        minAge: 18, maxAge: 80, random: true, repeatable: true, minMonths: 9, weight: 1,
        condition: (p) => p.wealth > 5,
        choices: [
          { label: '下单！快乐无价', effects: { mood: 5, wealth: -4 }, plants: ['debt_habit'], log: '拆快递那几天你是快乐的。' },
          { label: '关掉App，省钱了', effects: { wealth: 1, mood: -1 }, log: '你管住了手。' },
        ],
      },
      {
        id: 'gym_card', title: '🏋️ 要不要办张健身卡', desc: '该动动了，可健身卡有点贵、还得坚持。',
        minAge: 20, maxAge: 70, random: true, repeatable: true, minMonths: 12, weight: 1,
        choices: [
          { label: '办卡开练，坚持下来', effects: { wealth: -3, health: 5, immunity: 3, mood: 2 }, plants: ['fit'], log: '坚持了三个月，你神清气爽。' },
          { label: '办了卡就去了两次', effects: { wealth: -3, mood: -1 }, log: '卡沦为收藏品。' },
          { label: '不办，走路锻炼', effects: { health: 1 }, log: '你把锻炼融进了日常。' },
        ],
      },
      {
        id: 'friend_dinner', title: '🍻 老友约饭', desc: '许久不见的朋友张罗聚会，去还是不去？',
        minAge: 18, maxAge: 85, random: true, repeatable: true, minMonths: 9, weight: 1.2,
        choices: [
          { label: '赴约，喝个痛快', effects: { mood: 5, wealth: -1, health: -1 }, log: '你们笑谈当年，友情回温。' },
          { label: '婉拒，改天再约', effects: { mood: -1 }, log: '你又宅了一晚。' },
        ],
      },
      {
        id: 'bad_news', title: '📰 刷屏的负面消息', desc: '手机推送一条条糟心事，你不知不觉刷了半小时。',
        minAge: 12, maxAge: 95, random: true, repeatable: true, minMonths: 9, weight: 1,
        choices: [
          { label: '放下手机，出去走走', effects: { mood: 2, health: 1 }, log: '你选择不被情绪裹挟。' },
          { label: '继续刷，越看越焦虑', effects: { mood: -3 }, log: '你的情绪被信息流牵着走。' },
        ],
      },
      {
        id: 'volunteer', title: '🤲 一次志愿活动', desc: '社区组织公益服务，你有那么点空闲和善意。',
        minAge: 16, maxAge: 75, random: true, repeatable: true, minMonths: 9, weight: 0.8,
        choices: [
          { label: '报名去帮忙', effects: { mood: 5, flags: { kind: true } }, plants: ['goodwill'], log: '予人玫瑰，手有余香。' },
          { label: '把时间留给自己', effects: { mood: 1 }, log: '你婉言谢绝了。' },
        ],
      },
      // —— 老年 ——
      {
        id: 'square_dance', title: '💃 广场舞邀约', desc: '楼下大爷大妈向你发出热情邀请，融入还是清静？',
        minAge: 55, maxAge: 95, random: true, stages: ['retired', 'other'], repeatable: true, minMonths: 9, weight: 1,
        choices: [
          { label: '跳起来！', effects: { mood: 5, health: 3, immunity: 2 }, log: '你既锻炼了身体，又交了朋友。' },
          { label: '在家含饴弄孙', effects: { mood: 2 }, log: '你享受安静的晚年。' },
        ],
      },
      {
        id: 'doctor_advice', title: '🩺 医生的叮嘱', desc: '老毛病复发了，医生严肃地让你改变生活方式。',
        minAge: 55, maxAge: 105, random: true, repeatable: true, minMonths: 10, weight: 1,
        condition: (p) => p.health < 62,
        choices: [
          { label: '痛改前非，认真养身', effects: { health: 5, mood: -1 }, log: '你从此饮食有度、起居有时。' },
          { label: '左耳进右耳出', effects: { health: -5, mood: 1 }, log: '你继续随心所欲，身体悄悄记了账。' },
        ],
      },

      // ============ 因果·连锁后果（伏笔回收） ============
      // requiresSeed/consumesSeed 的门控事件：只在埋下伏笔后才会出现。
      {
        id: 'burnout_crisis', title: '😮‍💨 身心透支', desc: '连日紧绷终于撑不住了，你急需做个决定。',
        minAge: 16, maxAge: 66, random: true, repeatable: true, minMonths: 9, weight: 1.4,
        requiresSeed: 'burnout', consumesSeed: 'burnout',
        choices: [
          { label: '请假休整一阵', effects: { health: 7, mood: 5, wealth: -4 }, log: '你按下暂停键，慢慢回血。' },
          { label: '咬牙继续扛', effects: { mood: -2 }, delayed: [{ inMonths: 6, effects: { health: -9, mood: -5 }, log: '透支的身体彻底罢工了。' }], log: '你选择硬扛，账单往后推。' },
        ],
      },
      {
        id: 'bill_crisis', title: '💳 账单日', desc: '购物车的快乐退去，账单和分期一起到期。',
        minAge: 18, maxAge: 70, random: true, repeatable: true, minMonths: 9, weight: 1.3,
        requiresSeed: 'debt_habit', consumesSeed: 'debt_habit',
        choices: [
          { label: '咬牙还清', effects: { wealth: -6, mood: -1 }, log: '你清了账，也买了个教训（记住了理性消费）。' },
          { label: '先拖着下月再说', effects: { mood: 2 }, plants: ['debt_habit'], delayed: [{ inMonths: 4, effects: { wealth: -4, mood: -4 }, log: '利滚利，手头更紧了。' }], log: '你把账单推给了下个月。' },
        ],
      },
      // —— 善有善报 / 好身体：埋下 goodwill/fit 伏笔后，作为门控事件自然回收 ——
      {
        id: 'good_deed_return', title: '🍀 善意的回响', desc: '你曾帮过的人，如今反过来拉了你一把。',
        minAge: 16, maxAge: 99, random: true, weight: 1.3,
        requiresSeed: 'goodwill', consumesSeed: 'goodwill',
        choices: [
          { label: '坦然接受帮助', effects: { wealth: 8, mood: 8 }, log: '贵人在关键处搭了把手。' },
          { label: '婉拒，让给更需要的', effects: { mood: 6, flags: { kind: true } }, log: '你把这份善意又传了下去。' },
        ],
      },
      {
        id: 'probation_test', title: '🧪 新公司的试用期', desc: '新环境暗流涌动，试用期考核就在眼前。',
        minAge: 20, maxAge: 60, hidden: true,
        choices: [
          { label: '拼命表现', risk: { chance: 0.6, success: { wealth: 6, mood: 4 }, failure: { mood: -5, health: -2, wealth: -2 }, goodLog: '你顺利转正，站稳了脚跟。', badLog: '高压下出了错，试用期没过。' } },
          { label: '按自己的节奏来', effects: { mood: 1, health: -1 }, log: '你不疾不徐地融入。' },
        ],
      },
      {
        id: 'partner_row', title: '🤝 合伙人分歧', desc: '公司做大了，当年并肩的伙伴却起了分歧。',
        minAge: 26, maxAge: 60, hidden: true,
        choices: [
          { label: '各退一步，维持合伙', effects: { mood: -2, wealth: 3 }, log: '你们求同存异，公司稳住。' },
          { label: '散伙分家', risk: { chance: 0.5, success: { wealth: 20, mood: 2 }, failure: { wealth: -15, mood: -6 }, goodLog: '好聚好散，你拿回可观一笔。', badLog: '散伙不体面，你损失不小。' } },
        ],
      },
      {
        id: 'marriage_crack', title: '💔 婚姻的裂痕', desc: '漫长的冷战，让感情出现了裂缝。',
        minAge: 22, maxAge: 75, hidden: true, condition: (p) => p.relationship && p.relationship.married,
        choices: [
          { label: '认真谈一次，修补关系', effects: { mood: 5 }, log: '你们把话说开，裂缝慢慢弥合。' },
          { label: '随它去吧', effects: { mood: -6 }, log: '没说开的话，成了心里的刺。' },
        ],
      },
      {
        id: 'fitness_reward', title: '🏅 身体给的奖励', desc: '坚持锻炼的回报，在体检报告和日常精力里显现。',
        minAge: 18, maxAge: 90, random: true, weight: 1.3,
        requiresSeed: 'fit', consumesSeed: 'fit',
        choices: [
          { label: '继续保持', effects: { health: 6, immunity: 5, mood: 4 }, log: '好体能成了你最稳的本钱。' },
          { label: '见好就收，松一松', effects: { mood: 2, health: 1 }, log: '你享受成果，也放了个假。' },
        ],
      },

      // —— 心理·压力（与 mental 系统联动） ——
      {
        id: 'breakdown', title: '🌧️ 崩溃的边缘', desc: '连日的重压让你喘不过气，今夜情绪到了临界点。',
        minAge: 14, maxAge: 80, random: true, repeatable: true, minMonths: 6, weight: 1.6,
        condition: (p) => p.mental && (p.mental.stress >= 80 || p.mental.depression >= 55),
        choices: [
          { label: '彻底放手，休一整月', effects: { stress: -45, depression: -12, mood: 6, wealth: -3 }, log: '你允许自己停下来，天没塌。' },
          { label: '死撑着不倒下', effects: { mood: -2, health: -3 }, plants: ['burnout'], delayed: [{ inMonths: 3, effects: { health: -6, depression: 8 }, log: '硬撑的代价，迟早要还。' }], log: '你咬紧牙关，把崩溃压了回去。' },
        ],
      },
      {
        id: 'seek_therapy', title: '🛋️ 要不要去做心理咨询', desc: '持续的低落让你开始认真考虑，找专业的人聊聊。',
        minAge: 16, maxAge: 85, random: true, repeatable: true, minMonths: 12, weight: 1.2,
        condition: (p) => p.mental && (p.mental.depression >= 45 || p.mental.trauma >= 35) && p.wealth >= 2,
        choices: [
          { label: '预约咨询，正视自己', effects: { depression: -24, stress: -18, trauma: -8, mood: 5, wealth: -3 }, log: '说出来之后，胸口那块石头轻了些。' },
          { label: '再自己扛扛', effects: { mood: -1 }, log: '你把求助的话咽了回去。' },
        ],
      },

      // ============ 时代特色事件（按真实公历年份触发；主角 1990 年生） ============
      // 这些是非一次性里程碑，靠 yearMin/yearMax 限定年份；eligible 会校验日历。
      {
        id: 'era_1997_crisis', title: '📉 1997·亚洲金融与下岗潮', desc: '工厂效益一落千丈，身边有人下了岗，家里的日子紧了起来。',
        minAge: 5, maxAge: 12, yearMin: 1997, yearMax: 1998,
        choices: [
          { label: '省着花，帮家里分担', effects: { wealth: -2, mood: -2, knowledge: 1, flags: { frugal: true } }, log: '你早早懂了生活的重量。' },
          { label: '年少不知愁', effects: { mood: 1 }, log: '大人的烦恼，你暂未理会。' },
        ],
      },
      {
        id: 'era_1999_millennium', title: '🎇 1999·回归与千禧', desc: '澳门回归、千禧年将至，大街小巷都是欢庆。',
        minAge: 8, maxAge: 14, yearMin: 1999, yearMax: 1999,
        choices: [
          { label: '沉浸在节日里', effects: { mood: 5 }, log: '千禧年的烟火，你记了很多年。' },
          { label: '攒钱买台新电脑', effects: { wealth: -3, knowledge: 3, mood: 2 }, log: '你第一次触到了互联网的门。' },
        ],
      },
      {
        id: 'era_2003_sars', title: '😷 2003·非典', desc: '非典来袭，学校停课，人人戴口罩、量体温。',
        minAge: 12, maxAge: 18, yearMin: 2003, yearMax: 2003,
        choices: [
          { label: '认真防护、停课不停学', effects: { health: 3, immunity: 3, knowledge: 2, mood: -1 }, log: '你谨慎而自律地度过了那段日子。' },
          { label: '不以为常，到处乱跑', risk: { chance: 0.75, success: { mood: 2 }, failure: { health: -8, mood: -4 }, goodLog: '你有惊无险。', badLog: '你染上了病，遭了不少罪。' } },
        ],
      },
      {
        id: 'era_2008_olympic', title: '🏅 2008·盛世与多难', desc: '奥运圆梦的狂喜，与汶川地震的悲痛交织在这一年。',
        minAge: 17, maxAge: 22, yearMin: 2008, yearMax: 2008,
        choices: [
          { label: '为奥运疯狂，也伸援手', effects: { mood: 6, wealth: -1, flags: { kind: true }, plants: ['goodwill'] }, log: '这一年大喜大悲，你更懂了家国。' },
          { label: '只管沉浸在自己的高考里', effects: { knowledge: 2, mood: 1 }, log: '时代宏大，你专注于眼前。' },
        ],
      },
      {
        id: 'era_2010_smartphone', title: '📱 2010·智能机时代', desc: '智能手机与3G扑面而来，世界正在被重新连接。',
        minAge: 19, maxAge: 24, yearMin: 2010, yearMax: 2011,
        choices: [
          { label: '紧跟潮流换智能机', effects: { wealth: -1, knowledge: 2, mood: 3 }, log: '你把世界装进了口袋。' },
          { label: '守着小灵通', effects: { wealth: 1, mood: -1 }, log: '你慢了半拍，但省了钱。' },
        ],
      },
      {
        id: 'era_2013_wechat', title: '💬 2013·自媒体风口', desc: '微信与公众号兴起，人人都在说"风口上猪都能飞"。',
        minAge: 22, maxAge: 28, yearMin: 2013, yearMax: 2014,
        choices: [
          { label: '辞职做自媒体', risk: { chance: 0.4, success: { wealth: 25, mood: 8, knowledge: 3 }, failure: { wealth: -8, mood: -6 }, goodLog: '你踩中风口，账号一夜起量。', badLog: '风口过去了，你摔得不轻。' } },
          { label: '当副业试试水', effects: { wealth: 4, knowledge: 1, mood: 1 }, log: '小步试错，也有进账。' },
        ],
      },
      {
        id: 'era_2015_stock', title: '📈 2015·杠杆牛与股灾', desc: '全民炒股、杠杆横行，随后一路暴跌——是逃顶还是抄底？',
        minAge: 24, maxAge: 30, yearMin: 2015, yearMax: 2015,
        choices: [
          { label: '加杠杆冲进去', risk: { chance: 0.35, success: { wealth: 30, mood: 6 }, failure: { wealth: -25, mood: -10, stress: 8 }, goodLog: '你在高点全身而退。', badLog: '股灾来了，你深套其中。' } },
          { label: '见好就收，落袋为安', effects: { wealth: 5, mood: 2 }, log: '你及时离场，睡得踏实。' },
        ],
      },
      {
        id: 'era_2016_housing', title: '🏙️ 2016·棚改与房价', desc: '房价这一轮猛涨，掏空六个钱包也要上车，还是继续观望？',
        minAge: 25, maxAge: 34, yearMin: 2016, yearMax: 2017,
        condition: (p) => Game.assets && Game.assets.canBuy('house', 'studio').ok,
        choices: [
          { label: '咬牙上车，买下两居室', asset: { act: 'buy', kind: 'house', key: 'two_room' },
            condition: (p) => Game.assets.canBuy('house', 'two_room').ok, effects: { mood: 4 },
            log: '你成了有房一族，也背上了贷款——但看着房价还在涨，你觉得值。' },
          { label: '先买个小户型上车', asset: { act: 'buy', kind: 'house', key: 'studio' }, effects: { mood: 3 },
            log: '小是小了点，但先上车再说。' },
          { label: '再等等看', effects: { wealth: 2, mood: -1 }, log: '你没上车，心里五味杂陈。' },
        ],
      },
      {
        id: 'era_2020_covid', title: '🦠 2020·新冠疫情', desc: '新冠疫情猝不及防，生活按下暂停键：囤货、口罩、居家……',
        minAge: 28, maxAge: 40, yearMin: 2020, yearMax: 2021,
        choices: [
          { label: '严格防护、规律生活', effects: { health: 4, immunity: 4, mood: -2, stress: 4 }, log: '你守住了健康，也熬过了焦虑。' },
          { label: '焦虑囤积、坐吃山空', effects: { wealth: -6, mood: -6, stress: 6 }, log: '疫情还没走，钱包先慌了。' },
        ],
      },
      {
        id: 'era_2023_ai', title: '🤖 2023·AI 浪潮', desc: '大模型席卷而来，有人说会被取代，有人说新机会来了。',
        minAge: 30, maxAge: 55, yearMin: 2023, yearMax: 2026,
        choices: [
          { label: '主动学 AI、转型', effects: { intelligence: 1, knowledge: 4, wealth: 5, stress: 2 }, log: '你把 AI 变成了自己的杠杆。' },
          { label: '觉得是泡沫，按兵不动', risk: { chance: 0.5, success: { mood: 2 }, failure: { wealth: -4, mood: -4, stress: 4 }, goodLog: '果然退潮了，你没交学费。', badLog: '行业被重塑，你被落在了后面。' } },
        ],
      },

      // ============ 金融投资·事件链（入市→牛市→崩盘→币圈；靠 investor 种子串联） ============
      // 开户自选市场（v1.7.1）：openMarket 指令只开通对应市场，行动栏按已开户市场解锁
      {
        id: 'invest_open', title: '📊 朋友拉你开户入市', desc: 'K线图、涨停、财富自由的故事在饭桌上流传。开户台上摆着两份协议：一份A股账户，一份据说"波动很大"的数字货币账户。',
        minAge: 18, maxAge: 55, random: true, weight: 1.1,
        choices: [
          { label: '📈 只开A股账户', effects: { mood: 3, knowledge: 2, flags: { investor: true } }, openMarket: 'stock', log: '你开了A股账户——先从看得懂的市场练起。' },
          { label: '🪙 直奔虚拟币账户', effects: { mood: 5, knowledge: 1, flags: { investor: true } }, openMarket: 'crypto', log: '你在交易所开了户，心跳从此跟着K线走。' },
          { label: '🏦 两个账户都开', effects: { mood: 4, knowledge: 2, flags: { investor: true } }, openMarket: 'both', log: 'A股与虚拟币双账户到手，进可攻退可守。' },
          { label: '理性旁观，不入这潭水', effects: { mood: 1, knowledge: 1 }, log: '你按住了蠢蠢欲动的手。' },
        ],
      },
      {
        id: 'bull_mania', title: '🐂 牛市来了', desc: '账户一路飘红，人人都是股神，空气里都是金钱的味道。',
        minAge: 18, maxAge: 70, random: true, repeatable: true, minMonths: 10, weight: 1.3,
        requiresSeed: 'investor',
        choices: [
          { label: '加杠杆 all in', risk: { chance: 0.45, success: { wealth: 40, mood: 8 }, failure: { wealth: -30, mood: -10, stress: 10, trauma: 5 }, goodLog: '你在高点大赚一笔。', badLog: '牛转熊，杠杆让你血本无归。' } },
          { label: '趁高位止盈落袋', effects: { wealth: 12, mood: 4, stress: -2 }, log: '你把浮盈变成真金，见好就收。' },
          { label: '不动如山继续持有', effects: { mood: 1 }, delayed: [{ inMonths: 8, effects: { wealth: 8, mood: 2 }, log: '行情又冲高了一截。' }], log: '你选择与趋势为友。' },
        ],
      },
      {
        id: 'bear_crash', title: '🐻 黑天鹅·暴跌', desc: '连续跳水，账户以肉眼可见的速度蒸发，割肉还是死扛？',
        minAge: 18, maxAge: 80, random: true, repeatable: true, minMonths: 8, weight: 1.2,
        requiresSeed: 'investor',
        choices: [
          { label: '含泪割肉离场', effects: { wealth: -12, mood: -4, stress: 4 }, log: '你斩了仓，至少止住了血。' },
          { label: '死扛装死', risk: { chance: 0.5, success: { wealth: 15, mood: 5 }, failure: { wealth: -25, mood: -8, stress: 10, depression: 6 }, goodLog: '熬到反弹，深套变浮盈。', badLog: '越跌越深，你被彻底埋了。' } },
          { label: '抄底加仓摊成本', risk: { chance: 0.4, success: { wealth: 25, mood: 6 }, failure: { wealth: -30, mood: -8, stress: 8, trauma: 4 }, goodLog: '抄在了地板上，反弹凶猛。', badLog: '底下面还有地下室。' } },
        ],
      },
      {
        id: 'era_2013_crypto', title: '🪙 2013·比特币元年', desc: '一种叫比特币的东西价格飞天，有人说是新黄金，有人说是骗局。',
        minAge: 20, maxAge: 40, yearMin: 2013, yearMax: 2014,
        choices: [
          { label: '小买一试', effects: { mood: 2 }, openMarket: 'crypto', risk: { chance: 0.55, success: { wealth: 20, mood: 5 }, failure: { wealth: -8, mood: -3 }, goodLog: '你提前上了车。', badLog: '高位站岗，先亏一笔。' } },
          { label: '觉得是泡沫，不碰', effects: { knowledge: 1, mood: 1 }, log: '你选择看不懂就不参与。' },
        ],
      },
      {
        id: 'era_2017_crypto', title: '🎢 2017·币圈疯狂', desc: '比特币冲上两万美元，全民挖矿、空气币泛滥，随后一地鸡毛。',
        minAge: 22, maxAge: 50, yearMin: 2017, yearMax: 2018,
        choices: [
          { label: '全仓杀入', openMarket: 'crypto', risk: { chance: 0.4, success: { wealth: 50, mood: 8 }, failure: { wealth: -35, mood: -10, stress: 10, trauma: 6 }, goodLog: '你在崩盘前逃顶暴富。', badLog: '币灾来了，你被埋在山腰。' } },
          { label: '只投一点点尝鲜', effects: { mood: 1 }, openMarket: 'crypto', risk: { chance: 0.6, success: { wealth: 6, mood: 2 }, failure: { wealth: -4, mood: -2 }, goodLog: '小赌怡情，你也上了车。', badLog: '上车就颠簸，好在仓位轻。' } },
          { label: '冷眼旁观', effects: { knowledge: 1 }, log: '你看着这场狂欢，没有下场。' },
        ],
      },

      // —— 开户自选的"补开户"事件（v1.7.1）：让单市场玩家后补另一边，选哪条路都不留死角 ——
      {
        id: 'crypto_open', title: '🪙 币圈开户诱惑', desc: '身边总有人晒币圈的收益截图。要不要也开一个虚拟币账户？',
        minAge: 20, random: true, repeatable: true, minMonths: 24, weight: 0.7,
        requiresSeed: 'investor', yearMin: 2013,
        condition: () => !!(Game.invest && typeof Game.invest.isOpen === 'function') && !Game.invest.isOpen('crypto'),
        choices: [
          { label: '开一个虚拟币账户', effects: { mood: 3 }, openMarket: 'crypto', log: '你入金了，从此多一根绷紧的神经。' },
          { label: '算了，A股就挺好', effects: { knowledge: 1, mood: 1 }, log: '你决定专注看得懂的市场。' },
        ],
      },
      {
        id: 'stock_open', title: '📈 证券公司来电', desc: '客户经理三番五次来电：现在开户还送好礼……要不要也开一个A股账户？',
        minAge: 20, random: true, repeatable: true, minMonths: 30, weight: 0.6,
        requiresSeed: 'investor',
        condition: () => !!(Game.invest && typeof Game.invest.isOpen === 'function') && !Game.invest.isOpen('stock'),
        choices: [
          { label: '开一个A股账户', effects: { mood: 2, knowledge: 1 }, openMarket: 'stock', log: '你开了A股账户，多了条正规军的路。' },
          { label: '不需要，谢谢', effects: { knowledge: 1 }, log: '你婉拒了客户经理。' },
        ],
      },

      // ============ 随机财务事件（v1.1.0 · Phase 2 收尾：彩票/意外开销/亲友借钱） ============
      {
        id: 'finance_lottery', title: '🎰 路过彩票站', desc: '头奖又累积到上亿了，排队的人眼里的光和你一样亮。',
        minAge: 18, maxAge: 80, random: true, repeatable: true, minMonths: 14, weight: 0.8,
        choices: [
          { label: '来一注，做个梦', risk: { chance: 0.12, success: { wealth: 25, mood: 9, flags: { lottery_win: true } }, failure: { wealth: -0.5, mood: -1 }, goodLog: '居然中了！奖池虽不是头奖，也够你高兴几个月。', badLog: '连个末等奖都没中，就当买了两天盼头。' } },
          { label: '研究下走势再买', effects: { wealth: -0.5, knowledge: 1 }, log: '你研究了半天走势，中了个小奖，回了本。' },
          { label: '摇摇头走开', effects: { mood: 1 }, log: '你算明白了期望值，把钱包揣得更紧了。' },
        ],
      },
      {
        id: 'finance_accident', title: '💸 计划外的开销', desc: '热水器半夜漏水，楼下邻居已经上来敲门了。',
        minAge: 16, maxAge: 85, random: true, repeatable: true, minMonths: 16, weight: 0.9,
        choices: [
          { label: '请师傅彻底修好', effects: { wealth: -3, mood: 1 }, log: '花钱消灾，从此高枕无忧。' },
          { label: '自己动手凑合修', risk: { chance: 0.5, success: { wealth: -0.5, mood: 3 }, failure: { wealth: -5, mood: -3, stress: 3 }, goodLog: '你居然修好了，省下一笔还颇有成就感。', badLog: '越修越坏，最后还是花了双倍的钱。' } },
        ],
      },
      {
        id: 'finance_lend', title: '🤝 老友开口借钱', desc: '多年没联系的老同学突然来电，生意周转，想借五万应急。',
        minAge: 20, maxAge: 75, random: true, repeatable: true, minMonths: 20, weight: 0.8,
        condition: (p) => (p.wealth || 0) >= 10,
        choices: [
          { label: '借！情谊比钱重', effects: { wealth: -5, mood: 2, flags: { helpful: true }, plants: ['goodwill'] }, delayed: [{ inMonths: 22, effects: { wealth: 6, mood: 4 }, log: '老友如约还钱，还多包了个大红包。' }], log: '你把钱转了过去，情分又深了一层。' },
          { label: '借一半，尽个心意', effects: { wealth: -2.5, mood: 1 }, log: '你量力而行，对方也表示理解。' },
          { label: '委婉拒绝', effects: { mood: -2, stress: 2 }, log: '你编了个理由推脱，挂了电话心里有点堵。' },
        ],
      },

      // ============ 长寿里程碑（B17：九十大寿，触发一次） ============
      {
        id: 'birthday_90', title: '🎂 九十大寿', desc: '四世同堂，儿孙们张罗着要给你办一场大寿。',
        minAge: 90, maxAge: 97,
        choices: [
          { label: '大摆寿宴，热闹一场', effects: { wealth: -8, mood: 10, stress: -3, flags: { big_birthday: true } }, log: '宾朋满座，你举杯的手有些颤，心里却是满的。' },
          { label: '一桌家宴，静静过', effects: { mood: 6, stress: -2 }, log: '就着家常菜，你听儿孙说了许多祝福。' },
          { label: '捐出寿辰的礼金', effects: { wealth: -2, mood: 7, flags: { kind: true }, pers: { A: 0.3 } }, log: '你把礼金捐给了村里的小学，孩子们唱了生日歌给你。' },
        ],
      },

      // ============ 深度负债 · 求助父母（里程碑，触发一次） ============
      {
        id: 'debt_rescue', title: '🕳️ 债务压顶', desc: '窟窿越来越大，催债的电话一个接一个。你盯着通讯录里"家"那个字。',
        minAge: 18, maxAge: 95,
        condition: (p) => (p.wealth || 0) < Game.config.finance.bailoutDebt,
        choices: [
          { label: '向父母开口求助', condition: (p) => !!(p.family && ((p.family.father && p.family.father.alive) || (p.family.mother && p.family.mother.alive))), effects: { wealth: 30, mood: -4, stress: 5, pers: { C: 0.3 }, flags: { bailout: true } }, delayed: [{ inMonths: 18, effects: { stress: -3 }, log: '父母的资助让你缓了过来，你暗暗发誓要争气。' }], log: '父母没多问一句，把养老钱打了过来。你红了眼眶。' },
          { label: '咬牙自己扛', effects: { stress: 14, depression: 5, mood: -6, flags: { self_redeem: true } }, log: '你把手机扣在桌上，决定自己把这个洞填上。' },
          { label: '躲债，能拖一天是一天', effects: { stress: 10, depression: 8, health: -2, mood: -4 }, log: '你开始不接陌生电话，日子过得像在逃亡。' },
        ],
      },

      // ============ 负债催收链（v1.4.0）：欠债后逐级升级的负面事件链 ============
      // 触发条件统一为 wealth < 0（可配 thresholds）。玩家每次选择决定"滚雪球"或"止血"。
      // 入口 debt_overdue → 拖延埋 in_collection 伏笔 → 催收电话 → 上门追债 → 法律威胁；
      // 另有 debt_restructure（协商重组）作为止血出口、debt_cleared（还清）作正向收尾。
      {
        id: 'debt_overdue', title: '📵 逾期的提醒', desc: '还款日已过，短信一条接一条地弹出来，语气从客气慢慢变成警告。',
        minAge: 18, maxAge: 90, random: true, repeatable: true, minMonths: 8, weight: 1.5,
        condition: (p) => (p.wealth || 0) < 0,
        choices: [
          { label: '想办法先还上一部分', condition: (p) => (p.wealth || 0) > -20, effects: { wealth: -2, mood: 2, stress: -2 }, log: '你东拼西凑还了一笔，催收暂时歇了。' },
          { label: '先拖着，等手头松一点', effects: { mood: 1, stress: 4 }, plants: ['in_collection'], delayed: [{ inMonths: 2, event: 'debt_collect_call' }], log: '你把短信划掉，心里却多了块石头。' },
          { label: '不看不回，装没看见', effects: { stress: 7, depression: 4 }, plants: ['in_collection'], delayed: [{ inMonths: 1, event: 'debt_collect_call' }], log: '你把手机翻扣在桌上，耳鸣了很久。' },
        ],
      },
      {
        id: 'debt_collect_call', title: '📞 催收来电', desc: '陌生号码、外地区号，一天打来七八个。这次你鬼使神差地接了。',
        minAge: 18, maxAge: 90, hidden: true,
        condition: (p) => (p.wealth || 0) < 0,
        choices: [
          { label: '态度诚恳，商量还款计划', effects: { wealth: -3, mood: -2, stress: 3 }, log: '对方语气缓和了些，给你留了期限。' },
          { label: '挂断、拉黑', effects: { stress: 6, depression: 5, mood: -4 }, delayed: [{ inMonths: 3, event: 'debt_visit' }], log: '你挂了电话，却知道这事躲不过。' },
          { label: '破口对骂，撕破脸', risk: { chance: 0.4, success: { mood: 3, stress: 2 }, failure: { stress: 12, depression: 8, health: -2 }, goodLog: '你把对方骂懵了，出了一口恶气（可事还得还）。', badLog: '对方撂下狠话，你气得手抖。' }, delayed: [{ inMonths: 2, event: 'debt_visit' }] },
        ],
      },
      {
        id: 'debt_visit', title: '🚪 有人上门了', desc: '傍晚，门外响起急促的敲门声，猫眼里站着两个陌生男人。',
        minAge: 18, maxAge: 90, hidden: true,
        condition: (p) => (p.wealth || 0) < 0,
        choices: [
          { label: '开门，好好谈，争取分期', condition: (p) => (p.wealth || 0) > -50, effects: { wealth: -6, mood: -3, stress: 6, flags: { negotiated: true } }, plants: ['debt_settled'], log: '你签了分期还款的协议，虽然肉疼，但总算有了明路。' },
          { label: '闭门不出，装没人在家', effects: { stress: 12, depression: 7, mood: -5 }, delayed: [{ inMonths: 4, event: 'debt_legal' }], log: '你缩在沙发后，听着敲门声慢慢远去，心跳如鼓。' },
          { label: '报警 / 走法律途径护住自己', risk: { chance: 0.6, success: { stress: -6, mood: 4, flags: { tookRisk: true } }, failure: { stress: 8, depression: 5, wealth: -2 }, goodLog: '来人是违规催收，你据理力争，对方灰溜溜走了。', badLog: '报了个寂寞，麻烦事一桩接一桩。' } },
        ],
      },
      {
        id: 'debt_legal', title: '⚖️ 法院传票', desc: '一封挂号信躺在信箱里——债务纠纷，你被起诉了。',
        minAge: 18, maxAge: 95, hidden: true,
        condition: (p) => (p.wealth || 0) < 0,
        choices: [
          { label: '应诉，申请分期或调解', effects: { wealth: -8, mood: -4, stress: 8, flags: { debt_legal: true } }, plants: ['debt_settled'], log: '调解结案，你背上了分期，但至少没上失信名单。' },
          { label: '置之不理，缺席判决', effects: { wealth: -12, mood: -8, stress: 14, depression: 8, health: -3, flags: { debt_legal: true, bad_credit: true } }, log: '判决缺席生效，你成了"老赖"，很多门都对你关上了。' },
        ],
      },
      {
        id: 'debt_restructure', title: '🏦 协商债务重组', desc: '一家银行主动提出：可以重新谈条件，把零散的债务打包重组。',
        minAge: 20, maxAge: 85, random: true, repeatable: true, minMonths: 24, weight: 1.1,
        condition: (p) => (p.wealth || 0) < -8,
        choices: [
          { label: '接受重组，按新计划慢慢还', effects: { wealth: 8, mood: 4, stress: -8, flags: { restructured: true } }, log: '债务被拉长摊薄，你终于能睡个安稳觉了。' },
          { label: '再扛扛，不想欠这份人情', effects: { stress: 5, mood: -2 }, log: '你婉拒了，还想凭自己翻盘。' },
        ],
      },
      {
        id: 'debt_cleared', title: '🎉 最后一笔', desc: '转账成功的提示弹出来——你盯着账户余额，欠债清零了。',
        minAge: 18, maxAge: 95, hidden: true,
        condition: (p) => (p.wealth || 0) >= 0,
        choices: [
          { label: '长舒一口气', effects: { mood: 12, stress: -12, depression: -8, flags: { debt_free: true } }, log: '你走出银行，抬头看了看天，很久没有这样轻松过。' },
        ],
      },

      // —— v2.2.0 场景专属事件链 ——
      // 声明 scenario 字段的事件只在对应场景下进池；无 scenario 字段的事件全场景通用。
      // decisions.js eligible() 已加 scenario 门控：Game.scenario.key() !== ev.scenario → 跳过。

      // ===== 🚀 创业人生（startup）：融资链 + 创业抉择 =====
      {
        id: 'startup_idea', title: '💡 有个想法', desc: '你脑子里一直有个创业的念头，今天终于下定决心试试。',
        scenario: 'startup', minAge: 22, maxAge: 45, random: true, weight: 1.5,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '辞职创业', effects: { mood: 6, stress: 8, knowledge: 2, flags: { startup: true } }, plants: ['investor'], log: '你递了辞职信，从此没有退路。' },
          { label: '先兼职试试水', effects: { mood: 2, stress: 4, wealth: -2 }, log: '你决定先稳住主业，业余时间验证想法。' },
          { label: '还是算了', effects: { mood: -2 }, log: '创业太冒险了，你选择继续打工。' },
        ],
      },
      {
        id: 'startup_seed', title: '🌱 种子轮融资', desc: '你的项目有了原型，天使投资人约你聊聊。',
        scenario: 'startup', minAge: 23, maxAge: 50, random: true, repeatable: true, minMonths: 18, weight: 1.2,
        condition: (p) => p.flags && p.flags.startup,
        choices: [
          { label: '接受投资', risk: { chance: 0.55, success: { wealth: 40, mood: 10, stress: 5 }, failure: { wealth: -10, mood: -8, stress: 12 }, goodLog: '投资人拍板了，第一笔钱到账。', badLog: '投资人看了数据后摇摇头，这轮没戏。' } },
          { label: '自力更生，不拿投资', effects: { wealth: -5, mood: 3, flags: { kind: true } }, log: '你自己掏积蓄撑着，虽然苦但踏实。' },
        ],
      },
      {
        id: 'startup_pivot', title: '🔄 要不要转型', desc: '做了半年发现原方向跑不通，合伙人建议转型。',
        scenario: 'startup', minAge: 23, maxAge: 50, random: true, weight: 1.0,
        condition: (p) => p.flags && p.flags.startup,
        choices: [
          { label: '果断转型', risk: { chance: 0.5, success: { mood: 8, knowledge: 3, wealth: 10 }, failure: { mood: -6, wealth: -15, stress: 10 }, goodLog: '转型后数据起飞了。', badLog: '转型后更迷茫了。' } },
          { label: '再坚持一下', effects: { stress: 6, mood: -3 }, log: '你选择相信初心，但前路依然不明朗。' },
        ],
      },
      {
        id: 'startup_burn', title: '🔥 烧钱危机', desc: '账上只够撑三个月了，你需要做个决定。',
        scenario: 'startup', minAge: 23, maxAge: 55, random: true, weight: 1.3,
        condition: (p) => p.flags && p.flags.startup && (p.wealth || 0) < 20,
        choices: [
          { label: '裁员瘦身', effects: { wealth: 8, mood: -6, stress: 4 }, log: '你咬牙裁了一半人，公司轻了，心却重了。' },
          { label: '抵押房子续命', effects: { wealth: 25, stress: 10, flags: { debt_habit: true } }, log: '你把房子押了，赌最后一把。' },
          { label: '认赔出局', effects: { mood: -10, stress: -5 }, log: '你关了公司，虽然亏了钱，但终于能睡个好觉了。' },
        ],
      },
      {
        id: 'startup_exit', title: '🎉 退出时刻', desc: '有人出价收购你的公司，或者你准备上市了。',
        scenario: 'startup', minAge: 28, maxAge: 60, random: true, weight: 0.8,
        condition: (p) => p.flags && p.flags.startup,
        choices: [
          { label: '卖掉公司', risk: { chance: 0.6, success: { wealth: 80, mood: 15 }, failure: { wealth: 15, mood: 3 }, goodLog: '收购价超出预期，你实现了财务自由。', badLog: '收购价比预期低不少，但总算有个交代。' } },
          { label: '继续做下去', effects: { mood: 3, stress: 5 }, log: '你觉得公司还能更大，选择不卖。' },
        ],
      },

      // ===== 🏙️ 北漂十年（migrant）：租房/通勤/异地 =====
      {
        id: 'migrant_rent', title: '🏠 房租又涨了', desc: '房东通知下个月涨租，你得做个选择。',
        scenario: 'migrant', minAge: 20, maxAge: 40, random: true, repeatable: true, minMonths: 14, weight: 1.3,
        choices: [
          { label: '咬牙接受', effects: { wealth: -4, mood: -3, stress: 3 }, log: '房租涨了，但搬家更折腾。' },
          { label: '搬到更远的地方', effects: { wealth: -1, mood: -4, stress: 4 }, log: '远了两站地铁，省了房租，多了通勤。' },
          { label: '找个室友合租', effects: { mood: -1, wealth: -2 }, log: '找了个室友分摊房租，空间小了但钱包松了。' },
        ],
      },
      {
        id: 'migrant_commute', title: '🚇 挤地铁', desc: '早高峰的地铁像罐头，你每天花三小时通勤。',
        scenario: 'migrant', minAge: 20, maxAge: 45, random: true, repeatable: true, minMonths: 8, weight: 0.8,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '忍了', effects: { stress: 3, mood: -2 }, log: '地铁上背了半小时单词，也算没浪费。' },
          { label: '买辆车代步', effects: { wealth: -8, mood: 2, stress: -2 }, log: '堵车也比挤地铁强。' },
        ],
      },
      {
        id: 'migrant_homesick', title: '📞 想家了', desc: '妈打来电话问你什么时候回去看看。',
        scenario: 'migrant', minAge: 20, maxAge: 50, random: true, repeatable: true, minMonths: 12, weight: 0.7,
        choices: [
          { label: '请个假回去一趟', effects: { mood: 6, wealth: -3, stress: -5 }, log: '在家待了三天，充电满格。' },
          { label: '视频聊聊就好', effects: { mood: 2, stress: -1 }, log: '屏幕里的家，看了也暖。' },
        ],
      },
      {
        id: 'migrant_payraise', title: '💰 谈加薪', desc: '你觉得自己值更多，想找老板谈谈。',
        scenario: 'migrant', minAge: 22, maxAge: 45, random: true, repeatable: true, minMonths: 24, weight: 0.9,
        condition: (p) => p.career && p.career.phase === 'employed',
        choices: [
          { label: '硬气谈一次', risk: { chance: 0.5, success: { wealth: 12, mood: 8 }, failure: { mood: -5, stress: 6 }, goodLog: '老板爽快答应了，你觉得被看见了。', badLog: '老板打了个哈哈，你没涨成还多了个刺头名声。' } },
          { label: '先跳槽看看机会', effects: { mood: 2, stress: 4, knowledge: 1 }, log: '你更新了简历，开始留意机会。' },
          { label: '算了，先干着', effects: { mood: -2 }, log: '你把话咽了回去。' },
        ],
      },

      // ===== 🛋️ 躺平模式（chill）：慢节奏、低压力、小确幸 =====
      {
        id: 'chill_quiet', title: '☕ 平静的一天', desc: '今天什么事都没发生，你在沙发上坐了一下午。',
        scenario: 'chill', minAge: 16, maxAge: 95, random: true, repeatable: true, minMonths: 6, weight: 0.8,
        choices: [
          { label: '享受这份安静', effects: { mood: 3, stress: -4 }, log: '无事发生的一天，其实挺好的。' },
        ],
      },
      {
        id: 'chill_hobby', title: '🎨 捡起一个爱好', desc: '你突然想学点什么——画画、弹琴、做木工……',
        scenario: 'chill', minAge: 16, maxAge: 80, random: true, repeatable: true, minMonths: 20, weight: 0.6,
        choices: [
          { label: '买材料开始学', effects: { mood: 5, knowledge: 2, wealth: -1 }, log: '不为考级，只为喜欢。' },
          { label: '光是想想就开心', effects: { mood: 2 }, log: '有些爱好，存在于想象中就够了。' },
        ],
      },
      {
        id: 'chill_dream', title: '💤 做了个好梦', desc: '梦里你回到了小时候，醒来嘴角带笑。',
        scenario: 'chill', minAge: 20, maxAge: 95, random: true, repeatable: true, minMonths: 10, weight: 0.4,
        choices: [
          { label: '回味一会儿', effects: { mood: 4, stress: -3 }, log: '好梦是免费的旅行。' },
        ],
      },
      {
        id: 'chill_philosophy', title: '🌊 想通了一件事', desc: '你在某个平凡的瞬间突然想通了一件纠结很久的事。',
        scenario: 'chill', minAge: 25, maxAge: 95, random: true, repeatable: true, minMonths: 24, weight: 0.4,
        choices: [
          { label: '放下执念', effects: { mood: 6, stress: -6, depression: -3 }, log: '想通了就是最大的收获。' },
        ],
      },
    ],
  },

  // ================= 成就 =================
  // 每条 test(ctx) 在每年生日与死亡时评估；ctx 汇总人物一生的可判定信息。
  achievements: [
    { id: 'grow_up', emoji: '🌱', title: '茁壮成长', desc: '平安长到 6 岁', test: (c) => c.age >= 6 },
    { id: 'come_first', emoji: '🎉', title: '金榜题名', desc: '考入本科及以上', test: (c) => ['本科', '硕士', '博士'].includes(c.level) },
    { id: 'scholar', emoji: '📚', title: '学海无涯', desc: '取得博士学位', test: (c) => c.level === '博士' },
    { id: 'first_job', emoji: '💼', title: '初出茅庐', desc: '找到第一份工作', test: (c) => !!c.job },
    { id: 'diligent', emoji: '🛠️', title: '兢兢业业', desc: '工龄满 35 年', test: (c) => c.workYears >= 35 },
    { id: 'pensioner', emoji: '🏖️', title: '功成身退', desc: '活到退休', test: (c) => c.retired },
    { id: 'hand_in_hand', emoji: '💑', title: '执子之手', desc: '步入婚姻', test: (c) => c.married },
    { id: 'parent', emoji: '👶', title: '为人父母', desc: '养育一个孩子', test: (c) => c.children >= 1 },
    { id: 'big_family', emoji: '👨‍👩‍👧‍👦', title: '儿孙满堂', desc: '养育三个孩子', test: (c) => c.children >= 3 },
    { id: 'homeowner', emoji: '🏠', title: '安居乐业', desc: '买下自己的房子', test: (c) => c.flags.homeowner },
    { id: 'saver', emoji: '🪙', title: '小有积蓄', desc: '净资产峰值达 50 万', test: (c) => c.maxWealth >= 50 },
    { id: 'millionaire', emoji: '💰', title: '百万富翁', desc: '净资产峰值破百万', test: (c) => c.maxWealth >= 100 },
    { id: 'tycoon', emoji: '🤑', title: '富甲一方', desc: '净资产峰值达 300 万', test: (c) => c.maxWealth >= 300 },
    { id: 'kind', emoji: '🎗️', title: '乐善好施', desc: '做过公益捐赠', test: (c) => c.flags.kind },
    { id: 'filial', emoji: '🧓', title: '孝感动天', desc: '亲自赡养父母', test: (c) => c.flags.filial },
    { id: 'peaceful_end', emoji: '🕊️', title: '安详落幕', desc: '选择安宁疗护，体面告别', test: (c) => c.flags.peaceful },
    { id: 'wander_elder', emoji: '🌄', title: '旅居夕阳', desc: '选择旅居世界安度晚年', test: (c) => c.flags.wander },
    { id: 'philanthropist', emoji: '❤️‍🔥', title: '遗爱人间', desc: '立遗嘱捐助公益', test: (c) => c.flags.philanthropy },
    { id: 'risk_taker', emoji: '🎲', title: '弄潮而活', desc: '做过 8 次人生抉择', test: (c) => c.decisions >= 8 },
    { id: 'fate_player', emoji: '♟️', title: '玩转命运', desc: '做过 12 次人生抉择', test: (c) => c.decisions >= 12 },
    { id: 'social_butterfly', emoji: '🦋', title: '社交达人', desc: '一生结识 12 位朋友', test: (c) => c.met >= 12 },
    { id: 'well_loved', emoji: '🫂', title: '高朋满座', desc: '同时拥有 8 位好友', test: (c) => c.maxFriends >= 8 },
    { id: 'joined_market', emoji: '📊', title: '入市股民', desc: '曾经正式开户投资', test: (c) => c.flags.investor || c.investOpened },
    { id: 'diamond_hands', emoji: '💎', title: '落袋为安', desc: '投资累计盈利 80 万', test: (c) => c.investRealized >= 80 },
    { id: 'bagholder', emoji: '🩸', title: '高位站岗', desc: '投资累计亏损 50 万', test: (c) => c.investRealized <= -50 },
    { id: 'rich_total', emoji: '🏦', title: '身家丰厚', desc: '含持仓的总资产峰值破 500 万', test: (c) => c.peakNet >= 500 },
    { id: 'thinker', emoji: '💭', title: '思想者', desc: '开放性极高', test: (c) => c.pers.O >= 85 },
    { id: 'dutiful', emoji: '🎯', title: '一丝不苟', desc: '尽责性极高', test: (c) => c.pers.C >= 85 },
    { id: 'sensitive', emoji: '🥀', title: '多愁善感', desc: '神经质极高', test: (c) => c.pers.N >= 85 },
    { id: 'grow_open', emoji: '🌱', title: '日渐通透', desc: '开放性因经历提升 6+', test: (c) => (c.persDelta.O || 0) >= 6 },
    { id: 'grow_disciplined', emoji: '⏳', title: '自律成人', desc: '尽责性因习惯提升 6+', test: (c) => (c.persDelta.C || 0) >= 6 },
    { id: 'grow_calm', emoji: '🕊️', title: '磨出平和', desc: '神经质因修炼下降 6+', test: (c) => (c.persDelta.N || 0) <= -6 },
    { id: 'transformed', emoji: '🦋', title: '判若两人', desc: '某项性格因岁月改变 12+', test: (c) => Math.abs(c.persMax) >= 12 },
    { id: 'iron_body', emoji: '🛡️', title: '百毒不侵', desc: '年过七旬从未生过大病', test: (c) => c.age >= 70 && c.diseaseCount <= 2 },
    { id: 'long_life', emoji: '🐢', title: '长寿', desc: '活过 90 岁', test: (c) => c.age >= 90 },
    { id: 'centenarian', emoji: '🎂', title: '期颐之寿', desc: '活过 100 岁', test: (c) => c.age >= 100 },
    { id: 'twilight_rich', emoji: '🌇', title: '善始善终', desc: '一生积蓄丰厚且无债离世', test: (c) => c.maxWealth >= 100 && c.wealth >= 0 },
    { id: 'rock_bottom', emoji: '🥀', title: '晚景凄凉', desc: '曾富裕却负债离世', test: (c) => !c.alive && c.maxWealth >= 60 && c.wealth < 0 },
    { id: 'self_made', emoji: '🧱', title: '白手起家', desc: '出身贫寒却把净资产做到百万（未借任何金手指之力）', test: (c) => c.pure && ['贫困', '温饱'].includes(c.origin) && c.maxWealth >= 100 },
    { id: 'born_rich', emoji: '🏯', title: '含着金钥匙', desc: '出身豪门', test: (c) => c.origin === '豪门' },
    { id: 'both_parents', emoji: '👪', title: '双亲俱全', desc: '活到 70 岁仍父母健在', test: (c) => c.age >= 70 && c.fatherAlive && c.motherAlive },
    { id: 'resilient', emoji: '🌪️', title: '穿越风暴', desc: '压力曾爆表却走出低谷', test: (c) => c.peakStress >= 85 && c.depression < 25 && c.alive },
    { id: 'made_peace', emoji: '🕊️', title: '与自己和解', desc: '创伤深重后终归平静', test: (c) => c.peakTrauma >= 30 && c.trauma <= 8 && c.alive },
    { id: 'unbroken', emoji: '🧘', title: '心未蒙尘', desc: '一生从未跌入抑郁', test: (c) => c.age >= 60 && c.peakDepression < 20 },
    // —— v1.0 新增：资产维度（B6）与故事叙事维度（E1 / E3） ——
    { id: 'car_owner', emoji: '🚗', title: '有车一族', desc: '买下第一辆车', test: (c) => (c.cars || 0) >= 1 },
    { id: 'debt_free', emoji: '🔓', title: '无债一身轻', desc: '还清全部房贷', test: (c) => c.flags.debt_free },
    { id: 'leveraged', emoji: '🧾', title: '杠杆人生', desc: '背上按揭贷款', test: (c) => c.flags.leveraged },
    { id: 'mansion_owner', emoji: '🏛️', title: '广厦千间', desc: '名下房产且净资产峰值达 300 万', test: (c) => c.flags.mansion_owner },
    { id: 'asset_trader', emoji: '🔁', title: '资产腾挪', desc: '累计买卖资产 4 次', test: (c) => (c.assetTrades || 0) >= 4 },
    { id: 'story_weaver', emoji: '🧵', title: '故事织者', desc: '任一条故事线进度达到 90', test: (c) => (c.storyLines || []).some((g) => g.progress >= 90) },
    { id: 'complete_life', emoji: '🌟', title: '完满人生', desc: '故事五维全部 80 以上', test: (c) => !!c.dims && ['ambition', 'benevolence', 'risk', 'intellect', 'vitality'].every((k) => c.dims[k] >= 80) },
    { id: 'phoenix', emoji: '🔥', title: '凤凰涅槃', desc: '跌入低谷后凭自己站起', test: (c) => c.flags.rebound },
    { id: 'ending_gambler', emoji: '🎰', title: '赌神', desc: '以「赌神」结局落幕', test: (c) => c.ending === 'gambler' },
    { id: 'ending_sage', emoji: '📜', title: '大儒', desc: '以「大儒」结局落幕', test: (c) => c.ending === 'sage' },
    // —— v1.1.0 新增：熟练度（G4）与财务韧性 ——
    { id: 'practiced', emoji: '🥋', title: '熟能生巧', desc: '任一行动熟练度达到 30', test: (c) => (c.masteryMax || 0) >= 30 },
    { id: 'mastered', emoji: '🏆', title: '百炼成钢', desc: '任一行动熟练度达到 60', test: (c) => (c.masteryMax || 0) >= 60 },
    { id: 'grandmaster', emoji: '🐉', title: '炉火纯青', desc: '任一行动熟练度达到 85', test: (c) => (c.masteryMax || 0) >= 85 },
    { id: 'weller_nicked', emoji: '🧧', title: '好运常伴', desc: '中过一次彩票', test: (c) => c.flags.lottery_win },
    { id: 'reliable_friend', emoji: '🤝', title: '急人所难', desc: '在亲友困难时借出过钱', test: (c) => c.flags.helpful },
    { id: 'back_on_feet', emoji: '🧱', title: '绝境自赎', desc: '深陷债务后拒绝资助、自己爬出泥潭', test: (c) => c.flags.self_redeem },
    // —— v1.2.0 新增：金手指三模块（各自记账，互不引用；纯净向徽章要求三个标记全 false）——
    { id: 'hex_initiate', emoji: '🧬', title: '改写规则', desc: '第一次施放海克斯外挂', test: (c) => c.used.hex },
    { id: 'tycoon_initiate', emoji: '💸', title: '钞能力初体验', desc: '第一次动用神壕的资金', test: (c) => c.used.tycoon },
    { id: 'datalize_initiate', emoji: '🔍', title: '人心可读', desc: '第一次使用人数数据化', test: (c) => c.used.datalize },
    { id: 'hex_addict', emoji: '⚡', title: '逆天改命', desc: '一局内累计消耗 300 点算力 HE', test: (c) => (c.hexSpent || 0) >= 300 },
    { id: 'tycoon_spree', emoji: '🛥️', title: '挥金如土', desc: '一局内累计注入 2000 万资金', test: (c) => (c.tycoonInjected || 0) >= 2000 },
    { id: 'datalize_addict', emoji: '🕸️', title: '八面玲珑', desc: '一局内累计消耗 200 观测点 DP', test: (c) => (c.dpSpent || 0) >= 200 },
    { id: 'all_three', emoji: '🎭', title: '三扇门', desc: '同一局里三个模块各用过至少一次', test: (c) => c.used.hex && c.used.tycoon && c.used.datalize },
    { id: 'pure_life', emoji: '🪶', title: '凭自己', desc: '一生从未开启任何金手指，安然而终', test: (c) => c.pure && !c.alive && c.age >= 60 },
    { id: 'clean_strength', emoji: '🕯️', title: '素手而为', desc: '未用任何金手指，仍把净资产做到 100 万以上', test: (c) => c.pure && (c.peakNet || 0) >= 100 },

    // —— v1.5.0 消费模式：会花钱，也是一种人生的活法 ——
    { id: 'first_purchase', emoji: '🛍️', title: '犒劳自己', desc: '第一次为自己买东西', test: (c) => (c.consume.buys || 0) >= 1 },
    { id: 'treat_yourself', emoji: '✨', title: '享受生活', desc: '一生至少体验过 10 次随心消费', test: (c) => (c.consume.treatCount || 0) >= 10 },
    { id: 'collector', emoji: '🗄️', title: '家当齐全', desc: '同时拥有 5 件以上耐用品', test: (c) => (c.ownedGoods || 0) >= 5 },
    { id: 'subscriber', emoji: '📞', title: '付费买省心', desc: '同时订阅 3 项以上服务', test: (c) => (c.subsCount || 0) >= 3 },
    { id: 'comfort_life', emoji: '🛋️', title: '品质生活家', desc: '一生消费达到「富足」档', test: (c) => (c.consume.tierRank || 0) >= 2 },
    { id: 'luxury_life', emoji: '💎', title: '只为高兴', desc: '一生消费达到「奢华」档', test: (c) => (c.consume.tierRank || 0) >= 3 },
    { id: 'big_spender', emoji: '🪙', title: '千金散尽', desc: '一生累计消费超过 200 万', test: (c) => (c.consume.spent || 0) >= 200 },
    { id: 'balanced_life', emoji: '⚖️', title: '张弛有度', desc: '既会赚钱也会享受：净资产超 100 万且消费档达「富足」', test: (c) => (c.peakNet || 0) >= 100 && (c.consume.tierRank || 0) >= 2 },

    // —— 玩法层（v1.6.0）：合约 · 底色 · 行动点 · 元进度 ——
    { id: 'first_contract', emoji: '📜', title: '一诺千金', desc: '达成第一期人生合约', test: (c) => (c.contracts.kept || 0) >= 1 },
    { id: 'contract_master', emoji: '🗂️', title: '言出必行', desc: '累计达成 3 期以上人生合约', test: (c) => (c.contracts.kept || 0) >= 3 },
    { id: 'contract_iron', emoji: '⛓️', title: '铁诺', desc: '累计达成 6 期人生合约', test: (c) => (c.contracts.kept || 0) >= 6 },
    { id: 'all_rounder', emoji: '🎯', title: '全能选手', desc: '拿齐 3 种不同合约的徽章', test: (c) => (c.contracts.badges || []).length >= 3 },
    { id: 'shaped_life', emoji: '🏷️', title: '有棱有角', desc: '结算时被打上 3 枚以上倾向标签', test: (c) => (c.personaTags || []).length >= 3 },
    { id: 'many_faces', emoji: '🎭', title: '多面人生', desc: '结算时被打上 5 枚以上倾向标签', test: (c) => (c.personaTags || []).length >= 5 },
    { id: 'budget_keeper', emoji: '⚡', title: '精打细算', desc: '开启月行动点后一生没有一次行动点告罄', test: (c) => !!c.apEnabled && !!c.apThrifty },
    { id: 'gate_opener', emoji: '🔓', title: '越玩越开', desc: '在元进度里至少解锁一个金手指模块（非默认）', test: (c) => !!(c.metaUnlocked && (c.metaUnlocked.hex || c.metaUnlocked.datalize)) },
  ],

  // ================= 难度 / 人生剧本（开局可选，可随时切换） =================
  // 各系统实时读取这些倍率/偏移：疾病易感、死亡率、风险运气、事件密度、家境、天赋。
  scenarioDefault: 'normal',
  scenarios: {
    easy:   { label: '🌿 顺遂人生', desc: '病痛更少、运气更佳', disease: 0.7, mortality: 0.82, luck: 1.4, eventRate: 0.85, originShift: 0, iqBonus: 0, persBonus: 0, investDrift: 1.15, investCrash: 0.5, assetDrift: 0.012 },
    normal: { label: '🍂 普通人生', desc: '标准概率，百味人生', disease: 1, mortality: 1, luck: 1, eventRate: 1, originShift: 0, iqBonus: 0, persBonus: 0, investDrift: 1, investCrash: 1, assetDrift: 0 },
    hard:   { label: '🔥 艰难模式', desc: '多病多磨、世事无常', disease: 1.5, mortality: 1.25, luck: 0.75, eventRate: 1.4, originShift: -1, iqBonus: 0, persBonus: 0, investDrift: 0.85, investCrash: 1.7, assetDrift: -0.018 },
    lucky:  { label: '⭐ 天选之人', desc: '天赋异禀、家世优渥', disease: 0.9, mortality: 0.9, luck: 1.3, eventRate: 1.1, originShift: 1, iqBonus: 14, persBonus: 12, investDrift: 1.2, investCrash: 0.7, assetDrift: 0.02 },
    // v2.2.0 场景模式玩法变体：不只是调参数，而是加专属事件链改变玩法结构
    startup: { label: '🚀 创业人生', desc: '高风险高回报，创业融资链', disease: 1, mortality: 1, luck: 0.9, eventRate: 1.3, originShift: 0, iqBonus: 0, persBonus: 0, investDrift: 1.3, investCrash: 1.5, assetDrift: 0 },
    migrant: { label: '🏙️ 北漂十年', desc: '初始极穷，房租是大头', disease: 1.2, mortality: 1.05, luck: 0.85, eventRate: 1.2, originShift: -2, iqBonus: 0, persBonus: -4, investDrift: 0.9, investCrash: 1.2, assetDrift: -0.01 },
    chill:   { label: '🛋️ 躺平模式', desc: '慢节奏，压力小，成就上限低', disease: 0.8, mortality: 0.85, luck: 1.1, eventRate: 0.7, originShift: 0, iqBonus: -3, persBonus: 0, investDrift: 0.8, investCrash: 0.6, assetDrift: 0 },
  },

  // ================= 心理状态（压力 / 抑郁 / 创伤） =================
  mental: {
    start: { stress: 8, depression: 0, trauma: 0 },
    stress: {
      baseline: 0.15, work: 0.6, lowHealth: 0.5, sick: 0.4, debt: 0.7, lowMood: 0.3,
      decay: 0.55, nCoef: 0.012, aCoef: 0.010, nDecay: 0.010,
    },
    depression: {
      fromStress: 0.05, stressThreshold: 68, fromTrauma: 0.015,
      heal: 0.5, healStressBelow: 45,
    },
    trauma: {
      parentDeath: 16, spouseDeath: 20, divorce: 15, severeIllness: 12, bankruptcy: 12,
      heal: 0.08,
    },
    carry: { stressToMood: 0.10, stressToImmunity: 0.10, depressionToMood: 0.35, depressionToImmunity: 0.08 },
    burnoutStress: 76,
    therapyRelief: { depression: -22, stress: -18, trauma: -6 },
  },

  // ================= 主动行动（玩家随时可为，带月冷却） =================
  // 常驻"行动栏"，在两次事件之间给玩家持续的掌控感。cd=冷却月数；
  // effects 复用 applyEffects；cond(p) 决定该行动当前是否可执行（如未在职不能加班）。
  // 特殊：'bond' 会提升父母/配偶/子女亲情；'gain' 类带随机小概率加成。
  actions: [
    { id: 'study', emoji: '📚', name: '读书学习', cd: 3, effects: { knowledge: 2, mood: -1, pers: { O: 0.5, C: 0.3 } }, gain: { chance: 0.22, intelligence: 1 }, cond: (p) => Game.state.s.clock.age >= 6 },
    { id: 'exercise', emoji: '🏃', name: '锻炼身体', cd: 3, effects: { health: 2, immunity: 2, mood: 1, stress: -4, pers: { C: 0.4, N: -0.3 } }, plants: ['fit'], cond: (p) => Game.state.s.clock.age >= 6 },
    { id: 'relax', emoji: '🧘', name: '放松冥想', cd: 2, effects: { mood: 3, stress: -8, depression: -2, pers: { N: -0.6 } }, cond: (p) => Game.state.s.clock.age >= 4 },
    { id: 'socialize', emoji: '🎉', name: '朋友聚会', cd: 3, effects: { mood: 4, immunity: 1, stress: -3, pers: { E: 0.6, A: 0.2 } }, cond: (p) => Game.state.s.clock.age >= 10 },
    { id: 'feast', emoji: '🍲', name: '好好吃一顿', cd: 2, effects: { mood: 2, health: 1, wealth: -1.5 }, cond: (p) => Game.state.s.clock.age >= 4 && p.wealth >= 2 },
    { id: 'chores', emoji: '🧹', name: '大扫除', cd: 3, effects: { mood: 1 }, cond: (p) => Game.state.s.clock.age >= 6 },
    { id: 'hobby', emoji: '🎮', name: '搞点爱好', cd: 2, effects: { mood: 3, stress: -3, wealth: -0.5 }, cond: (p) => Game.state.s.clock.age >= 6 && p.wealth >= 1 },
    // —— 行动抉择化（G8）：type:'decision' 的行动点击后不直接生效，而是弹出
    //      选择（复用抉择弹窗），冷却/熟练度在打开时结清，效果由选择决定。
    //      effects 字段保留作守卫回退（decisions.openActionChoice 不可用时直生效）。
    { id: 'sidejob', emoji: '💰', name: '加班兼职', cd: 3, type: 'decision',
      prompt: '想赚点外快，这个月接哪一单？',
      choices: [
        { label: '🛵 跑腿外卖', effects: { wealth: 6, health: -3, stress: 3, mood: -2, pers: { C: 0.2 } }, log: '风里来雨里去，一晚上跑了二十几单。' },
        { label: '📖 课业辅导', effects: { wealth: 5, mood: -1, knowledge: 1, stress: 1 }, condition: (p) => (p.intelligence || 0) >= 75, log: '一对一讲了两个小时，讲着讲着自己也通透了。' },
        { label: '✍️ 深夜码字投稿', risk: { chance: 0.45, success: { wealth: 9, mood: 2, knowledge: 1 }, failure: { mood: -4, wealth: 1, stress: 3 }, goodLog: '稿子过了，编辑还约了下一篇。', badLog: '改了五遍还是被退稿，只换来一句"再等等"。' } },
        { label: '🈶 周末翻译私活', effects: { wealth: 4, mood: -2, stress: 1, knowledge: 1 }, log: '千字五十，熬到凌晨终于交稿。' },
        { label: '🛋️ 算了，好好休息', effects: {}, log: '身体是本钱，这单不接了。' },
      ],
      effects: { mood: -3, health: -2, wealth: 4, stress: 2, pers: { C: 0.2 } },
      cond: (p) => Game.state.s.clock.age >= 16 && p.career && p.career.phase !== 'retired' && p.wealth > -50 },
    { id: 'checkup', emoji: '🏥', name: '就医体检', cd: 8, cond: (p) => Game.state.s.clock.age >= 4,
      apply: (p) => { if (p.health < 70) return { health: 6, immunity: 2, wealth: -3, mood: 1, source: '就医' }; return { immunity: 2, wealth: -1, source: '体检' }; } },
    { id: 'family', emoji: '👨‍👩‍👧', name: '陪伴家人', cd: 3, effects: { mood: 4, stress: -3, pers: { A: 0.4 } }, bond: 5, cond: (p) => (p.relationship && (p.relationship.married || p.relationship.children.length)) || (p.family && (p.family.father.alive || p.family.mother.alive)) },
    { id: 'travel', emoji: '✈️', name: '出门旅行', cd: 10, type: 'decision',
      prompt: '世界那么大，这次想去哪儿走走？',
      choices: [
        { label: '🌊 海边度假', effects: { mood: 7, stress: -9, depression: -3, wealth: -9, pers: { N: -0.2 } }, log: '你在海边躺了三天，浪潮把烦恼都带走了。' },
        { label: '🏔️ 远赴高原', risk: { chance: 0.7, success: { mood: 14, stress: -16, depression: -6, knowledge: 2, wealth: -18, pers: { O: 1.2 } }, failure: { mood: -5, stress: 8, health: -6, wealth: -18 }, goodLog: '雪山与星空之下，你重新认识了生活。', badLog: '高原反应来势汹汹，行程被迫中断。' }, condition: (p) => p.wealth >= 20 },
        { label: '🌍 出国远行', effects: { mood: 9, knowledge: 3, stress: -8, depression: -4, wealth: -30, pers: { O: 1.4 } }, condition: (p) => p.wealth >= 32, log: '护照上多了一枚章，眼界也宽了一寸。' },
        { label: '🚗 周末短途', effects: { mood: 4, stress: -5, wealth: -3 }, log: '近郊的小古镇人不多，刚刚好。' },
        { label: '🛋️ 算了，改天再说', effects: {}, log: '这趟先不去了，攒着下次。' },
      ],
      effects: { mood: 8, knowledge: 1, wealth: -8, stress: -10, depression: -4, pers: { O: 0.8, N: -0.3 } },
      cond: (p) => Game.state.s.clock.age >= 16 && p.wealth >= 8 },
    { id: 'donate', emoji: '🎗️', name: '捐助行善', cd: 8, type: 'decision',
      prompt: '这份心意，想以什么方式送出去？',
      choices: [
        { label: '🤲 社区志愿服务', effects: { mood: 5, wealth: -1, flags: { kind: true }, pers: { A: 0.5 } }, plants: ['goodwill'], log: '搬了一下午物资，累但心里踏实。' },
        { label: '🎓 结对资助学生', effects: { mood: 6, wealth: -12, flags: { kind: true }, pers: { A: 0.7 } }, plants: ['goodwill'], condition: (p) => p.wealth >= 15, log: '远方来信说成绩进步了，你觉得这笔钱花得值。' },
        { label: '🎗️ 匿名捐赠', effects: { mood: 4, wealth: -6, flags: { kind: true }, pers: { A: 0.4 } }, plants: ['goodwill'], log: '不留名的好事，像一封没有署名的信。' },
        { label: '🛋️ 这次先等等', effects: {}, log: '心意先记下，下月再说的样子。' },
      ],
      effects: { mood: 6, wealth: -5, flags: { kind: true }, pers: { A: 0.6 } },
      cond: (p) => Game.state.s.clock.age >= 18 && p.wealth >= 5 },

    // —— 职场黄金期专属行动（v2.3.0）：给"上学 → 退休"主战场三个主动抓手 ——
    { id: 'certify', emoji: '📜', name: '考证进修', cd: 6, effects: { knowledge: 5, mood: -2, wealth: -2, stress: 2, pers: { O: 0.3, C: 0.4 } }, gain: { chance: 0.2, intelligence: 1 }, cond: (p) => Game.state.s.clock.age >= 20 && p.career && p.career.phase === 'employed' },
    { id: 'networking', emoji: '🤝', name: '维系人脉', cd: 4, effects: { mood: 2, stress: -2, wealth: -1, pers: { E: 0.4, A: 0.2 } }, plants: ['network'], cond: (p) => Game.state.s.clock.age >= 18 && p.career && p.career.phase !== 'retired' },
    { id: 'tutor_kid', emoji: '📖', name: '辅导孩子', cd: 3, effects: { mood: 2, stress: 2, knowledge: 1, pers: { A: 0.3 } }, cond: (p) => !!(p.relationship && p.relationship.children && p.relationship.children.some((c) => Game.state.s.clock.age - (c.birthAge || 0) < 18)) },

    // —— 行业专属行动：仅在职且职业匹配时解锁（actions 的 jobs 门控）——
    { id: 'labor_gig', emoji: '💪', name: '多揽一份活', cd: 2, jobs: ['搬运工', '保洁员', '农活短工', '流水线普工', '快递分拣员', '建筑小工', '餐饮服务员', '临时零工', '拾荒度日'], effects: { wealth: 5, health: -4, stress: 4, mood: -1 } },
    { id: 'artisan_craft', emoji: '🛠️', name: '打磨手艺', cd: 3, jobs: ['技工', '汽修技师', '技术员'], effects: { knowledge: 3, mood: 1, stress: 1, wealth: 1 }, gain: { chance: 0.18, intelligence: 1 } },
    { id: 'sales_dinner', emoji: '🤝', name: '陪客户应酬', cd: 3, jobs: ['销售员', '销售主管', '市场专员', '店长助理'], effects: { wealth: 4, mood: -2, health: -1, stress: 3 } },
    { id: 'clerk_paperwork', emoji: '📋', name: '伏案公文', cd: 3, jobs: ['公务员', '行政文员', '客服专员'], effects: { knowledge: 1, wealth: 2, mood: -1, stress: 2 } },
    { id: 'teach_nurture', emoji: '🍎', name: '悉心育人', cd: 4, jobs: ['人民教师', '高校教师', '高校辅导员'], effects: { mood: 5, knowledge: 1, wealth: 1, stress: 1, pers: { A: 0.4, O: 0.2 } }, plants: ['goodwill'] },
    { id: 'eng_grind', emoji: '💻', name: '攻坚项目', cd: 3, jobs: ['工程师', '高级工程师', '算法工程师'], effects: { knowledge: 3, wealth: 3, health: -2, stress: 4, pers: { C: 0.3 } }, gain: { chance: 0.25, intelligence: 1 } },
    { id: 'sci_research', emoji: '🔬', name: '埋首科研', cd: 5, jobs: ['研究员', '首席科学家'], effects: { intelligence: 1, knowledge: 4, mood: 3, wealth: 2, stress: 3, pers: { O: 0.5 } }, plants: ['goodwill'], gain: { chance: 0.3, intelligence: 1 } },

    // —— 金融交易（先"入市"解锁，之后可随时按现价买卖）——
    { id: 'buy_stock', emoji: '📈', name: '买入A股', cd: 1, cond: (p) => Game.invest.canTrade('stock'), apply: (p) => Game.invest.buy('stock', Game.config.invest.buyFrac) || {} },
    { id: 'sell_stock', emoji: '💰', name: '清仓A股', cd: 1, cond: (p) => Game.invest.has('stock'), apply: (p) => Game.invest.sell('stock') || {} },
    { id: 'buy_crypto', emoji: '🪙', name: '买入虚拟币', cd: 1, cond: (p) => Game.invest.canTrade('crypto'), apply: (p) => Game.invest.buy('crypto', Game.config.invest.buyFrac) || {} },
    { id: 'sell_crypto', emoji: '💸', name: '清仓虚拟币', cd: 1, cond: (p) => Game.invest.has('crypto'), apply: (p) => Game.invest.sell('crypto') || {} },
  ],

  // ================= 行动熟练度（G4：反复实践 → 精通 → 效果增强） =================
  // 只对带 effects 的"养成型"行动累计熟练度；跨过档位阈值后，该行动的正负数值
  // 效果按 bonus 放大（性格漂移 pers 与随机 gain 不放大，保持后天轨迹语义）。
  // ================= 习惯养成闭环（v1.3.0） =================
  // 玩家从习惯面板"立一个习惯"，每月坚持累加 streak；达到 persist 个月即"内化"，
  // 一次性获得性格漂移与属性增益（把"性格可塑"从被动变主动）。失败仅断 streak，不惩罚。
  habit: {
    defs: [
      { id: 'exercise', name: '坚持锻炼', emoji: '🏃', desc: '每周运动，身体更有活力', persist: 12,
        monthly: { health: 0.4, mood: 0.3 },
        unlock: { stats: { health: 3, immunity: 2, mood: 4 }, pers: { C: 3, N: -2 }, note: '体质更扎实，自律沉淀为性格里的尽责。' } },
      { id: 'reading', name: '每日阅读', emoji: '📚', desc: '读书明理，内心丰盈', persist: 12,
        monthly: { mood: 0.3, knowledge: 0.2 },
        unlock: { stats: { knowledge: 6, intelligence: 2, mood: 3 }, pers: { O: 2, C: 1 }, note: '见识与开放性悄然提升。' } },
      { id: 'meditate', name: '冥想静心', emoji: '🧘', desc: '每天留出觉察与独处', persist: 10,
        monthly: { mood: 0.4, stress: -0.3 },
        unlock: { stats: { mood: 4 }, pers: { N: -3, A: 1 }, note: '情绪更稳，内耗更少。' } },
      { id: 'writing', name: '坚持写作', emoji: '✍️', desc: '记录思绪，沉淀想法', persist: 12,
        monthly: { mood: 0.2, knowledge: 0.2 },
        unlock: { stats: { knowledge: 4, intelligence: 2, mood: 2 }, pers: { O: 1, C: 1 }, note: '表达与自省力增强。' } },
      { id: 'saving', name: '强制储蓄', emoji: '🐖', desc: '每月存一点，心里有底', persist: 18,
        monthly: { mood: 0.2 },
        unlock: { stats: { wealth: 8, mood: 3 }, note: '财务安全感提升。' } },
      { id: 'social', name: '经营友情', emoji: '🤝', desc: '常与朋友联络', persist: 12,
        monthly: { mood: 0.3 },
        unlock: { stats: { mood: 3 }, pers: { E: 2, A: 1 }, note: '归属感与亲和力提升。' } },
      { id: 'volunteer', name: '志愿服务', emoji: '🌟', desc: '助人亦悦己', persist: 10,
        monthly: { mood: 0.3 },
        unlock: { stats: { mood: 4 }, pers: { A: 2 }, flags: { kind: true }, note: '意义感与亲和提升，亦算一件善行。' } },
      { id: 'cooking', name: '学做饭', emoji: '🍳', desc: '好好吃饭，好好生活', persist: 10,
        monthly: { health: 0.3, mood: 0.2 },
        unlock: { stats: { health: 3, mood: 2 }, note: '生活自理能力增强。' } },
    ],
  },

  // ================= 未竟之事 / 人生留白（v1.3.0） =================
  // 结算时计算"这一生从没走过"的路，给玩家回味与重开动机。predicate 在死亡时评估。
  roads: {
    paths: [
      { id: 'love', name: '亲密与羁绊', desc: '从未恋爱、成家或育有子女',
        miss: (p) => !(p.relationship && (p.relationship.married || p.relationship.widowed || p.relationship.divorced || (p.relationship.children && p.relationship.children.length > 0))) },
      { id: 'children', name: '膝下承欢', desc: '一生膝下空空，从未养育过孩子',
        miss: (p) => !(p.relationship && p.relationship.children && p.relationship.children.length > 0) },
      { id: 'home', name: '安家置业', desc: '一生从未拥有属于自己的房子',
        miss: (p) => !(Game.assets && typeof Game.assets.summary === 'function' && Game.assets.summary().houses.length > 0) },
      { id: 'abroad', name: '远行求学', desc: '从未走出国门见识更大的世界',
        miss: (p) => !p.flags.studyAbroad },
      { id: 'risk', name: '孤注一掷', desc: '一生四平八稳，从未为某件事赌上过',
        miss: (p) => !p.flags.tookRisk },
    ],
  },

  // ======================================================================
  // 玩法层（v1.6.0）—— 四项**彼此独立**的玩法增强，各自有独立文件 / state 子树 /
  //   存档格 / 测试；互不引用，也都不引用金手指三模块。任一项缺失不影响其它三项。
  //     ① contracts 人生合约  ② persona 倾向标签  ③ meta 元进度解锁  ④ ap 月行动点
  // ======================================================================

  // —— ① 人生合约（中期目标）📜 ——
  //   每 period 年一期，自动下发 2~3 张，玩家主动认领 1 张，到期结算。
  //   奖励一律是**单项收益**（徽章 / 属性 / 现金），**不发跨模块通用货币**。
  //   违约不扣分，只写一条日志（保持"人生不惩罚你，只是错过"的基调）。
  contracts: {
    enabled: true,
    period: 5,          // 每 5 年一期
    offerCount: 3,      // 每期下发候选张数
    minAge: 18,         // 成年后才开始下发
    maxAge: 70,         // 到这个年龄后不再下发新合约
    // 合约池：test(track, ctx) 判定达标；track 由本系统自己维护（认领时的快照 + 累计）
    pool: [
      {
        id: 'scholar', tag: '学业', emoji: '📚', name: '寒窗五载',
        desc: '5 年内拿到本科及以上学历',
        test: (t) => !!t.eduAtLeast(['本科', '硕士', '博士']),
        reward: { knowledge: 20, mood: 6 }, badge: '🎓', badgeName: '寒窗',
      },
      {
        id: 'climber', tag: '事业', emoji: '📈', name: '掌舵',
        desc: '5 年内做到管理层',
        test: (t) => !!t.reachedManagement,
        reward: { wealth: 30, mood: 5 }, badge: '🧭', badgeName: '掌舵',
      },
      {
        id: 'bond', tag: '关系', emoji: '🤝', name: '知交',
        desc: '5 年内维持 3 位以上稳固的朋友',
        test: (t) => t.maxFriends >= 3,
        reward: { mood: 10, stress: -6 }, badge: '🫂', badgeName: '知交',
      },
      {
        id: 'fitter', tag: '身体', emoji: '🏃', name: '强身',
        desc: '5 年内把生命与免疫都保持在 70 以上',
        test: (t) => t.minHealth >= 70 && t.minImmunity >= 70,
        reward: { health: 8, immunity: 8 }, badge: '💪', badgeName: '强身',
      },
      {
        id: 'saver', tag: '财富', emoji: '🏦', name: '积攒',
        desc: '5 年内现金净增 20 万',
        test: (t) => (t.wealthEnd - t.wealthStart) >= 20,
        reward: { wealth: 15, mood: 4 }, badge: '🐖', badgeName: '积攒',
      },
      {
        id: 'serene', tag: '心境', emoji: '🕊️', name: '清净',
        desc: '5 年内心理压力始终不高于 30',
        test: (t) => t.maxStress <= 30,
        reward: { stress: -12, mood: 8 }, badge: '🕊️', badgeName: '清净',
      },
      {
        id: 'clean', tag: '清净', emoji: '🪶', name: '凭自己',
        desc: '5 年内没有动用任何金手指',
        // 只读三个模块各自的 used_* 账（与加成纯净徽章同源），不做共享货币
        test: (t) => !t.used.hex && !t.used.tycoon && !t.used.datalize,
        reward: { mood: 8 }, badge: '🪶', badgeName: '凭自己',
      },
      {
        id: 'spender', tag: '生活', emoji: '🍷', name: '活得讲究',
        desc: '5 年内消费达到 10 万',
        test: (t) => t.consumeSpent >= 10,
        reward: { mood: 12, stress: -6 }, badge: '🍷', badgeName: '讲究',
      },
    ],
  },

  // —— ② 倾向标签（结算页身份感）🏷️ ——
  //   不做硬性流派系统（那会逼模块产生耦合），只在结算页按**各自的使用量/风格**打标签。
  //   每条 tag 的 test(ctx) 只看自己关心的字段，互不依赖。
  persona: {
    enabled: true,
    maxTags: 5,       // 结算页最多展示几张
    tags: [
      { id: 'rigorous', emoji: '🧬', name: '逆天改命', desc: '把命运掰弯了很多次',
        test: (c) => c.hexSpent >= 150 },
      { id: 'rich', emoji: '💰', name: '富甲一方', desc: '钱从来不是问题',
        test: (c) => c.tycoonInjected >= 200 },
      { id: 'networker', emoji: '📊', name: '八面玲珑', desc: '人心在你手里是一张网',
        test: (c) => c.dpSpent >= 80 },
      { id: 'purist', emoji: '🪶', name: '凭自己', desc: '这一生，一次挂都没开',
        test: (c) => c.pure, requiresModules: true },
      { id: 'seeker', emoji: '🎓', name: '求知者', desc: '把书读到了头',
        test: (c) => c.eduRank >= 7 },
      { id: 'builder', emoji: '🏛️', name: '开创者', desc: '创下过属于自己的产业',
        test: (c) => c.ownedHouses >= 2 || c.ownedCars >= 2 },
      { id: 'giver', emoji: '🎗️', name: '行善者', desc: '予人玫瑰，手有余香',
        test: (c) => c.deeds >= 3 },
      { id: 'wanderer', emoji: '✈️', name: '远行者', desc: '世界那么大，你去看过',
        test: (c) => !!c.studyAbroad || c.travelMastery >= 30 },
      { id: 'survivor', emoji: '🛡️', name: '坚韧者', desc: '从很深的低谷里爬了回来',
        test: (c) => c.peakStress >= 70 && c.stress <= 40 },
      { id: 'connoisseur', emoji: '🍷', name: '生活家', desc: '懂得把日子过成想要的样子',
        test: (c) => c.consumeTierRank >= 2 },
      { id: 'plain', emoji: '🍚', name: '安分者', desc: '平平淡淡才是真',
        test: (c) => c.masteredHabits >= 2 && c.assetTrades <= 2 && c.consumeTierRank <= 1 },
    ],
  },

  // —— ③ 元进度解锁（跨周目）🔓 ——
  //   localStorage: lifesim_meta 记录累计成就数、通关次数、已达成结局。
  //   三个模块**各自独立解锁**：任一模块缺失或锁定时，其它模块不得有任何行为差异。
  meta: {
    enabled: true,
    key: 'lifesim_meta',           // 独立存储键，不与存档/榜单混用
    // ⚠️ 默认 **soft**：只计算解锁状态、在 UI 标注"尚未解锁"，**不强制关闭模块**——
    //   避免"开了元进度就把既有玩法锁死"的破坏性体验。玩家可在设置里开 hardLock 收紧。
    hardLock: false,
    // 各模块的解锁条件；unlock 为 null 表示默认可用（神壕：最好懂，新手第一扇门）
    gates: [
      { module: 'tycoon', unlock: null },
      { module: 'hex', unlock: { deaths: 1 }, note: '完整走完 1 局' },
      { module: 'datalize', unlock: { achievements: 15, endings: 3, mode: 'or' }, note: '累计 ≥15 枚成就，或达成 ≥3 种结局' },
    ],
  },

  // —— ④ 月行动点 AP（软模式）⚡ ——
  //   ⚠️ 涉及 actions.js 全部行动项，属全局改动 —— 因此**默认关闭**，且默认 soft（只提示计数，
  //   不硬性阻断），避免破坏既有玩法手感。玩家手动开启后可切 hard（耗尽即拦）。
  //   AP 是玩法层的通用规则，不属于任何一个金手指模块；不开也不影响其它任何系统。
  ap: {
    enabled: false,     // 默认关闭：不改变缺省手感
    mode: 'soft',       // 'soft' 只计数+提示；'hard' 耗尽则拒绝行动
    perMonth: 3,        // 每月回充
    cap: 6,             // 可攒上限
    start: 3,           // 开局点数
    costByAction: {},   // 单项覆盖：{ exercise: 2 }
    defaultCost: 1,     // 默认每次行动消耗
  },

  actionMastery: {
    gainMin: 2, gainMax: 4,  // 每次熟练度增长区间
    cap: 100,
    tiers: [
      { at: 30, label: '熟练', bonus: 0.5 },
      { at: 60, label: '精通', bonus: 1.0 },
      { at: 85, label: '宗师', bonus: 1.6 },
    ],
  },

  // ================= 金融投资（市场行情 · 持仓 · 买卖） =================
  invest: {
    minAge: 18,
    buyFrac: 0.25,   // 每次买入动用可投现金的比例
    minBuy: 3,       // 单笔最低（万元）
    winMood: 6,      // 卖出盈利的心情
    lossMood: -8,    // 卖出亏损的心情
    // 可交易资产：start 起始价、drift 年漂移、vol 年波动、crashChance 年崩盘概率、crashDip 崩盘跌幅
    assets: {
      stock:  { name: 'A股',    emoji: '📈', start: 100, drift: 0.06, vol: 0.20, crashChance: 0.07, crashDip: 0.35 },
      crypto: { name: '虚拟币', emoji: '🪙', start: 20,  drift: 0.14, vol: 0.60, crashChance: 0.16, crashDip: 0.62 },
    },
  },

  // ================= 生理需求（v1.8.0：饱食/精力/卫生/娱乐四条需求条） =================
  // 设计取向：不制造打卡 chore——有钱人过普通日子需求自然稳在"凑合线"，
  // 想拿"神清气爽"加成得主动把四项推上 70+；穷/负债才会跌穿惩罚线（营养不良链）。
  needs: {
    decay: { satiety: 16, energy: 16, hygiene: 8, fun: 10 }, // 每月自然衰减
    workExtraEnergy: 4,   // 在职：额外精力消耗（上班耗神）
    debtExtraSatiety: 4,  // 负债：吃得更快更差
    // 生存兜底（月末自动，语义是"补到线"而非"加固定值"，否则衰减>回复时均衡点钉在低位）：
    // 饿了且买得起 → 花小钱吃到 eatFloor；困了睡到 restFloor；日常洗漱/刷手机免费兜底
    auto: { eatBelow: 45, eatCost: 0.6, eatFloor: 48, restBelow: 40, restFloor: 42, cleanBelow: 55, cleanFloor: 58, playBelow: 30, playFloor: 32 },
    lowThreshold: 25,     // 跌穿此线开始月度惩罚
    severeThreshold: 10,  // 跌穿此线惩罚加重 + 偶尔哭诉日志
    labels: { satiety: '饥肠辘辘', energy: '疲惫不堪', hygiene: '邋里邋遢', fun: '生活乏味' },
    cries: {
      satiety: '🥣 冰箱空了，胃也在抗议——再穷，饭也要吃。',
      energy: '😵 连着熬，眼前发黑——至少睡个整觉吧。',
      hygiene: '🧼 屋里已经下不去脚了，衣服也该洗了。',
      fun: '📺 日子过得像白开水，好久没有开心过了。',
    },
    lowPenalty: {
      satiety: { health: -2, immunity: -2, mood: -2 },
      energy:  { stress: 5, immunity: -1 },
      hygiene: { immunity: -3, mood: -1 },
      fun:     { mood: -3, depression: 2 },
    },
    severeExtra: {
      satiety: { health: -3 },
      energy:  { health: -2, mood: -2 },
      hygiene: { health: -2 },
      fun:     { depression: 2 },
    },
    wellThreshold: 70,    // 四项全部 ≥70 → 月度"神清气爽"加成
    idealThreshold: 85,   // 四项全部 ≥85 → 额外健康加成
    wellBonus: { mood: 2, immunity: 1 },
    idealBonus: { health: 1 },
    // 行动 → 需求增量（needs 只读 action:done 事件，不改 actions.js）
    actionNeeds: {
      relax: { energy: 30, fun: 10 },
      socialize: { fun: 18 },
      travel: { fun: 30 },
      family: { fun: 8 },
      exercise: { energy: -4 },
      study: { energy: -3 },
      sidejob: { energy: -3 },
      feast: { satiety: 45, fun: 6 },
      chores: { hygiene: 50, energy: -2 },
      hobby: { fun: 35, energy: 5 },
      // v2.3.0 职场黄金期行动的需求联动
      certify: { energy: -6, fun: -4 },
      networking: { fun: 10 },
      tutor_kid: { energy: -4, fun: -3 },
    },
    // 一次性消费 → 需求增量（needs 只读 consume:treat 事件）
    treatNeeds: {
      hotpot: { satiety: 25, fun: 8 },
      fine_dine: { satiety: 20, fun: 10 },
      cinema: { fun: 15 },
      ktv: { fun: 15 },
      concert: { fun: 18 },
      spa: { hygiene: 20, fun: 8, energy: 8 },
      gallery_buy: { fun: 12 },
      first_class: { fun: 15 },
      yacht_party: { fun: 20 },
      default: { fun: 5 },
    },
  },

  // 寿命 / 死亡相关（Gompertz 型年龄死亡风险 + 健康修正）
  lifespan: {
    maxAge: 122,
    gompertzA: 0.00028, // 基础系数
    gompertzB: 0.09,    // 随年龄指数增长斜率
    hazardAgeRef: 10,   // 参考年龄
    healthMortality: { ref: 100, lo: 0.35, hi: 1.7 }, // 健康越低，死亡风险乘数越大
    // 各年龄段慢性病易感性（用于疾病系统注入慢性风险）
    chronicAgeRisk: (age) => (age > 45 ? Math.min(0.05, (age - 45) * 0.0006) : 0.001),
  },

  // ================= 资产系统（B6：房产 / 车辆 · 房贷 · 卖出决策） =================
  // 价格以"万元"为单位，与 p.wealth 同量纲；房价随资产价格指数演化。
  // 购房可全款或按揭：按揭产生 monthly 月供，未还清时计入负债（p.assets.mortgage）。
  assets: {
    priceIndex: { start: 1, growth: 0.012, drift: 0.018 },  // 每年价格指数增长（叠加随机漂移与剧本 assetDrift）
    houseLimit: 3,  // 名下房产上限
    carLimit: 2,    // 名下车辆上限
    // 房贷参数：年利率 / 首付比例 / 贷款年限
    mortgageRate: 0.049,
    downRatio: { house: 0.3, car: 0.2 },
    loanYears: { house: 25, car: 5 },
    maxDebtRatio: 0.6,   // 月供不得超过月收入的 60%（银行审核）
    upkeepRate: 0.012,   // 房产年维护费（占原值）
    carUpkeep: 0.6,      // 车辆年养护/油费/保险（万元，固定）
    carDepreciation: 0.12, // 车辆年折旧（占现价）
    sellFee: 0.02,       // 卖出税费（占成交价）
    savingRate: 0.015,   // 现金存款年利率
    savingCap: 200,      // 计息现金上限（万元）
    richMark: 300,       // "广厦千间"标记的净资产门槛（万元）
    houses: [
      { key: 'studio',    name: '单身公寓', emoji: '🏢', price: 60,  years: 20, mood: 6,  desc: '三十平米的小窝，也是自己的' },
      { key: 'two_room',  name: '两居室',   emoji: '🏠', price: 140, years: 25, mood: 9,  desc: '一家人住得下的安稳' },
      { key: 'three_room',name: '三居室',   emoji: '🏡', price: 260, years: 30, mood: 11, desc: '有书房，也有孩子的房间' },
      { key: 'villa',     name: '别墅',     emoji: '🏘️', price: 600, years: 30, mood: 14, desc: '院里有树，门口有车' },
    ],
    cars: [
      { key: 'scooter', name: '代步车', emoji: '🛵', price: 12, years: 8,  mood: 4,  desc: '通勤路上终于有了自己的空间' },
      { key: 'sedan',   name: '中级车', emoji: '🚗', price: 30, years: 10, mood: 7,  desc: '体面，也实用' },
      { key: 'luxury',  name: '豪车',   emoji: '🏎️', price: 90, years: 12, mood: 10, desc: '有些东西，是给自己看的' },
    ],
  },

  // ================= 消费模式（v1.5.0） =================
  // 「钱多了，日子就该过得不一样」：把财富从"账面数字"变成"能兑换的生活体验"。
  // 三块结构（彼此独立，各自一套 config 数组）：
  //   ① goods[]    耐用品：一次性买入 → 持有若干年，期间持续给属性加成，到期折旧退役
  //   ② treats[]   一次性消费：即时兑换心情/健康/知识…（餐饮 / 娱乐 / 美容 / 演唱会）
  //   ③ services[] 服务业订阅：每月扣月费，持续加成，可随时停订（私教 / 家政 / 私人医生）
  // 解锁按财富分层（tiers）：钱越多，能解锁的档次越高——这是"钱多了放开"的核心。
  consume: {
    // 财富分层门槛（万元，现金口径 p.wealth）：达到才解锁该档及以下所有档位的消费。
    // 门槛按实机净资产分位校准（p25≈45 / p50≈109 / p75≈630）：钱越多，能解锁的档次越高 ·
    // 这是"消费模式放开"的核心——一开始只能吃顿火锅，富起来后才买得起游艇与收藏画。
    tiers: [
      { key: 'modest',   name: '温饱',   min: 0,   note: '先顾好吃喝，偶尔犒劳自己' },
      { key: 'comfort',  name: '小康',   min: 15,  note: '有点余钱了，可以讲究一点' },
      { key: 'affluent', name: '富足',   min: 120, note: '消费开始有了品质的味道' },
      { key: 'luxury',   name: '奢华',   min: 600, note: '钱多到可以只为自己高兴' },
    ],
    // 耐用品：持有期按 kind 给月度/年度加成；持有期满按 residual 残值退役
    // hold 单位：年；monthly 是每月生效的加成；yearly 是每年一次性加成
    goods: [
      // —— 温饱档：实用为主 ——
      { key: 'bike',      name: '一辆自行车',   emoji: '🚲', tier: 'modest',   price: 0.4,  hold: 6,  residual: 0.2,
        monthly: { health: 0.15 }, note: '上下班骑车，省了车钱也练了身体' },
      { key: 'console',   name: '家用游戏机',   emoji: '🎮', tier: 'modest',   price: 0.5,  hold: 5,  residual: 0.15,
        monthly: { mood: 0.35, stress: -0.4 }, note: '下班后的快乐小屋' },
      { key: 'coffee_m',  name: '家用咖啡机',   emoji: '☕', tier: 'modest',   price: 0.8,  hold: 5,  residual: 0.2,
        monthly: { mood: 0.25, stress: -0.3 }, note: '每天早上那杯，是自己给自己的仪式' },
      // —— 小康档：品质起步 ——
      { key: 'bike_road', name: '公路自行车',   emoji: '🚴', tier: 'comfort',  price: 3,    hold: 8,  residual: 0.3,
        monthly: { health: 0.3, immunity: 0.15 }, note: '周末的骑行，成了生活的一部分' },
      { key: 'hifi',      name: '一套好音响',   emoji: '🎵', tier: 'comfort',  price: 5,    hold: 10, residual: 0.25,
        monthly: { mood: 0.5, stress: -0.5 }, note: '音乐一响，屋子就活了' },
      { key: 'camera',    name: '一台相机',     emoji: '📷', tier: 'comfort',  price: 4,    hold: 8,  residual: 0.25,
        monthly: { mood: 0.35 }, yearly: { knowledge: 1 }, note: '开始记录生活，也记录自己' },
      { key: 'piano',     name: '一架钢琴',     emoji: '🎹', tier: 'comfort',  price: 8,    hold: 20, residual: 0.3,
        monthly: { mood: 0.4, stress: -0.4 }, yearly: { intelligence: 1 }, note: '琴声是留给自己的一处安静' },
      // —— 富足档：体面与享受 ——
      { key: 'watch',     name: '一块名表',     emoji: '⌚', tier: 'affluent', price: 20,   hold: 15, residual: 0.4,
        monthly: { mood: 0.6 }, yearly: { }, note: '手腕上的分量，是给自己的交代' },
      { key: 'massage',   name: '按摩椅',       emoji: '💆', tier: 'affluent', price: 15,   hold: 10, residual: 0.2,
        monthly: { health: 0.3, stress: -0.8, mood: 0.3 }, note: '回家躺上去的那一刻，值了' },
      { key: 'boat',      name: '一艘游艇',     emoji: '🛥️', tier: 'affluent', price: 60,   hold: 12, residual: 0.35,
        monthly: { mood: 0.7, stress: -0.6 }, note: '海上没有电话，只有风' },
      // —— 奢华档：只为自己高兴 ——
      { key: 'art',       name: '一幅收藏画',   emoji: '🖼️', tier: 'luxury',   price: 120,  hold: 30, residual: 0.6,
        monthly: { mood: 0.8 }, yearly: { knowledge: 1 }, note: '挂在客厅，每次路过都会多看两眼' },
      { key: 'villa_pool',name: '私人泳池',     emoji: '🏊', tier: 'luxury',   price: 80,   hold: 25, residual: 0.3,
        monthly: { health: 0.4, mood: 0.6, stress: -1 }, note: '清晨的第一泳，是一天的开始' },
    ],
    // 一次性消费：即时兑换（不持有、不折旧）；tier 门槛同上
    treats: [
      { key: 'hotpot',    name: '一顿火锅',     emoji: '🍲', tier: 'modest',   cost: 0.3,  effects: { mood: 3, stress: -2 }, note: '辣得冒汗，也辣得舒服' },
      { key: 'cinema',    name: '看场电影',     emoji: '🎬', tier: 'modest',   cost: 0.2,  effects: { mood: 2, stress: -2 }, note: '两小时的另一个人生' },
      { key: 'ktv',       name: 'KTV 唱一晚',   emoji: '🎤', tier: 'modest',   cost: 0.5,  effects: { mood: 4, stress: -4 }, note: '吼出来，心里就空了' },
      { key: 'spa',       name: '做一次 SPA',   emoji: '💅', tier: 'comfort',  cost: 1.5,  effects: { mood: 4, health: 1, stress: -6 }, note: '从头发丝放松到脚趾' },
      { key: 'concert',   name: '看一场演唱会', emoji: '🎫', tier: 'comfort',  cost: 2,    effects: { mood: 8, stress: -8, depression: -3 }, note: '和几万人一起大声合唱' },
      { key: 'fine_dine', name: '米其林晚餐',   emoji: '🍽️', tier: 'affluent', cost: 6,    effects: { mood: 7, knowledge: 1, stress: -5 }, note: '原来食物可以这样被对待' },
      { key: 'first_class', name: '坐一次头等舱', emoji: '✈️', tier: 'affluent', cost: 10, effects: { mood: 8, stress: -6 }, note: '贵是有道理的，躺平也是' },
      { key: 'yacht_party', name: '办一场海上派对', emoji: '🥂', tier: 'luxury', cost: 40, effects: { mood: 12, stress: -8 }, note: '那晚的海，属于你' },
      { key: 'gallery_buy', name: '拍下一件拍品', emoji: '🔨', tier: 'luxury', cost: 150, effects: { mood: 10, knowledge: 2 }, note: '落槌的那一刻，你举牌了' },
    ],
    // 服务业订阅：月费 service.tier；每月扣款并给持续加成；wealth 不足自动停订
    services: [
      { key: 'gym',       name: '健身房私教',   emoji: '🏋️', tier: 'comfort',  fee: 0.3,  monthly: { health: 0.3, immunity: 0.2, stress: -0.4 }, note: '有人盯着，才练得下去' },
      { key: 'cleaner',   name: '家政保洁',     emoji: '🧹', tier: 'comfort',  fee: 0.25, monthly: { mood: 0.4, stress: -0.6 }, note: '周末不用再跟拖把较劲' },
      { key: 'diet',      name: '营养师配餐',   emoji: '🥗', tier: 'affluent', fee: 0.8,  monthly: { health: 0.4, immunity: 0.2 }, note: '吃什么，有人替你算好' },
      { key: 'doctor',    name: '私人医生',     emoji: '🩺', tier: 'affluent', fee: 1.5,  monthly: { health: 0.5, immunity: 0.4, stress: -0.3 }, note: '有一根线，随时为你留着' },
      { key: 'shrink',    name: '心理咨询师',   emoji: '🛋️', tier: 'affluent', fee: 1.2,  monthly: { stress: -1.2, depression: -0.5 }, note: '每周一次，把心事说给专业的人' },
      { key: 'butler',    name: '私人管家',     emoji: '🎩', tier: 'luxury',   fee: 5,    monthly: { mood: 0.8, stress: -1 }, note: '生活里所有琐碎，都有人接手' },
    ],
    // 折旧/退役参数
    sellFee: 0.15,      // 卖出耐用品的手续费（占残值）
    highSpendMark: 200, // "挥金如土"累计消费门槛（万元）
  },

  // ================= 因果链叙事化 + 故事积分（E1 / E3 / G5） =================
  // storyline：伏笔种子按主题归入故事线，记录"开了哪些线、推进到哪"。
  // dims：五维故事积分（主角后天轨迹），结算页画雷达图，并决定特殊结局。
  story: {
    startValue: 8,          // 五维起点（0-100）
    gain: { event: 4, action: 3 }, // 决策命中 / 行动命中的单次加成
    dims: [
      { key: 'ambition',    name: '雄心', emoji: '🚀' },
      { key: 'benevolence', name: '善心', emoji: '❤️' },
      { key: 'risk',        name: '冒险', emoji: '🎲' },
      { key: 'intellect',   name: '智识', emoji: '📚' },
      { key: 'vitality',    name: '活力', emoji: '🌿' },
    ],
    keywords: {
      ambition:    ['创业', '升职', '晋升', '加班', '跳槽', '事业', '资产', '购置', '置业', '房产', '汽车', '加薪', '职称', '外包', '副业', '老板', '上市', '扩张', '接手', '项目', 'KPI', '业绩', '公司', '职场', '工作'],
      benevolence: ['捐', '善', '志愿', '公益', '陪伴', '家人', '孝', '赡养', '照顾', '帮助', '探望', '互助', '育', '哺', '亲情', '父母', '子女', '慈善'],
      risk:        ['风险', '赌', '冒险', '投资', '股票', '虚拟币', '杠杆', '抄底', '全仓', '押', '投机', '崩盘', '裸辞', '币', '暴富'],
      intellect:   ['学习', '读书', '考', '研究', '知识', '进修', '培训', '思考', '阅读', '学历', '科研', '学位', '智力', '技术', '学术', '论文'],
      vitality:    ['锻炼', '健身', '运动', '跑步', '旅行', '旅游', '游泳', '爬山', '瑜伽', '体检', '健康', '养生', '跳舞', '徒步', '活力', '身体', '休息', '睡眠', '疗养', '精力'],
    },
    // 故事线：按顺序匹配关键词，命中第一条即归入该线；decisive 用于高光节点（big）
    groups: [
      { key: 'career',  name: '事业', emoji: '💼', keywords: ['事业', '工作', '加班', '跳槽', '升职', '晋升', '创业', '老板', '职业', '应聘', '面试', '职场', '绩效', '项目', '年终', '同事', '公司', '外包', '副业', '职称', '下岗', '裁员', '退休', '职级', '人脉', '内推', '竞聘', '外派', '考证'], seeds: ['boss', 'new_job', 'burnout', 'network'] },
      { key: 'wealth',  name: '财富', emoji: '💰', keywords: ['财富', '钱', '理财', '投资', '股票', '虚拟币', '房产', '买房', '购房', '贷款', '负债', '彩票', '年终奖', '存款', '破产', '资产', '置业', '卖房', '买车', '变现'], seeds: ['investor', 'debt_habit'] },
      { key: 'romance', name: '情感', emoji: '💞', keywords: ['恋爱', '结婚', '婚姻', '相亲', '分手', '离婚', '配偶', '恋人', '情侣', '求婚', '冷战', '感情', '约会', '心动', '暧昧', '再婚'], seeds: ['cold_war'] },
      { key: 'health',  name: '健康', emoji: '🩺', keywords: ['健康', '疾病', '体检', '锻炼', '熬夜', '身体', '医院', '手术', '戒', '失眠', '慢性', '养生', '免疫', '病', '疗程', '复健'], seeds: ['fit'] },
      { key: 'family',  name: '家庭', emoji: '👨‍👩‍👧', keywords: ['父母', '家人', '子女', '孩子', '家庭', '赡养', '孝', '遗产', '遗嘱', '养老', '陪伴', '亲情', '血缘', '兄弟姐妹'], seeds: ['goodwill'] },
      { key: 'mind',    name: '心境', emoji: '🧘', keywords: ['压力', '焦虑', '抑郁', '创伤', '情绪', '冥想', '心情', '心理咨询', '低谷', '和解', '崩溃', '孤独', '迷惘', '旅居'], seeds: ['wanderlust'] },
    ],
    groupBase: 20,   // 故事线起步进度（有伏笔即视为开启）
    groupStep: 6,    // 伏笔回响 / 高光节点的进度加成
    seedStep: 14,    // 埋下伏笔的进度加成
    fallbackGroup: 5,// 未命中任何关键词时归入的故事线（心境）
    // 五维 ← OCEAN 出生气质（先天气质 vs 后天轨迹，结算页对照展示）
    oceanMap: {
      ambition:    { C: 0.45, O: 0.35, E: 0.20 },
      benevolence: { A: 0.80, E: 0.20 },
      risk:        { O: 0.60, N: 0.40 },
      intellect:   { O: 0.70, C: 0.30 },
      vitality:    { C: 0.45, E: 0.35, N: -0.20 },
    },
    // "凤凰涅槃"判定：曾跌入低谷（高压力 / 负债 / 触底 / 长期郁结）后重新站起
    rebound: { stress: 80, debt: 50, net: 60, calm: 55 },
    // 特殊结局：按顺序判定，命中即止；最后一条为兜底
    endings: [
      { id: 'gambler',  emoji: '🎰', name: '赌神',     desc: '雄心与冒险皆至极境，你把人生下成了一场大注', test: (c) => c.dims.ambition >= 90 && c.dims.risk >= 90 },
      { id: 'sage',     emoji: '📜', name: '大儒',     desc: '心怀苍生而又手不释卷，你活成了一部书', test: (c) => c.dims.benevolence >= 90 && c.dims.intellect >= 90 },
      { id: 'complete', emoji: '🌟', name: '完满人生', desc: '五维皆臻高境，你活出了罕见的圆满', test: (c) => ['ambition', 'benevolence', 'risk', 'intellect', 'vitality'].every((k) => c.dims[k] >= 80) },
      { id: 'phoenix',  emoji: '🔥', name: '涅槃重生', desc: '你曾跌入谷底，又凭自己走了回来', test: (c) => !!c.flags.rebound && c.age >= 40 },
      { id: 'wanderer', emoji: '🌄', name: '逍遥旅人', desc: '老去的只是年岁，你的脚步从未停下', test: (c) => c.dims.vitality >= 85 && c.age >= 70 },
      { id: 'settled',  emoji: '🍵', name: '岁月静好', desc: '没有惊天动地，只有细水长流', test: (c) => c.age >= 70 && ['ambition', 'benevolence', 'risk', 'intellect', 'vitality'].every((k) => c.dims[k] >= 55) },
      { id: 'wasted',   emoji: '🥀', name: '虚度光阴', desc: '五维皆低，岁月从指缝里流走了', test: (c) => c.age >= 35 && ['ambition', 'benevolence', 'risk', 'intellect', 'vitality'].every((k) => c.dims[k] < 20) },
      { id: 'plain',    emoji: '🪷', name: '平凡一生', desc: '普通人的一生，也有它的分量', test: () => true },
    ],
  },

  // ================= 音效 / 背景音乐（B13 · Web Audio 实时合成） =================
  // 不依赖任何外部音频文件：以振荡器按谱合成 SFX 与 BGM。
  // 默认静音（enabledDefault: false），顶栏可一键开启；首次用户手势后才启动 AudioContext。
  audio: {
    enabledDefault: false,
    volume: 0.4,
    bgmVolume: 0.3,
    bgmOn: true,
    pauseWhenIdle: true, // 暂停/抉择冻结时压低 BGM
    // SFX 谱：[频率Hz, 时长s, 延迟s, 波形, 音量]
    sfx: {
      on:     [[660, 0.12, 0, 'sine', 0.5], [880, 0.16, 0.1, 'sine', 0.45]],
      click:  [[520, 0.05, 0, 'square', 0.28]],
      ask:    [[440, 0.12, 0, 'sine', 0.4], [622, 0.16, 0.1, 'sine', 0.4]],
      act:    [[392, 0.07, 0, 'triangle', 0.34]],
      ach:    [[784, 0.12, 0, 'triangle', 0.5], [988, 0.12, 0.1, 'triangle', 0.5], [1319, 0.24, 0.2, 'triangle', 0.5]],
      up:     [[523, 0.1, 0, 'triangle', 0.4], [659, 0.14, 0.08, 'triangle', 0.4]],
      buy:    [[392, 0.1, 0, 'triangle', 0.45], [523, 0.18, 0.09, 'triangle', 0.45]],
      coin:   [[988, 0.07, 0, 'square', 0.32], [1319, 0.1, 0.06, 'square', 0.32]],
      wed:    [[523, 0.14, 0, 'sine', 0.5], [659, 0.14, 0.12, 'sine', 0.5], [784, 0.32, 0.24, 'sine', 0.5]],
      birth:  [[880, 0.1, 0, 'sine', 0.42], [1175, 0.18, 0.1, 'sine', 0.42]],
      sick:   [[220, 0.18, 0, 'sawtooth', 0.28], [185, 0.26, 0.14, 'sawtooth', 0.28]],
      sad:    [[392, 0.25, 0, 'sine', 0.4], [311, 0.36, 0.2, 'sine', 0.4]],
      retire: [[440, 0.2, 0, 'sine', 0.45], [330, 0.34, 0.18, 'sine', 0.4]],
      end:    [[659, 0.18, 0, 'sine', 0.45], [523, 0.22, 0.16, 'sine', 0.45], [392, 0.44, 0.34, 'sine', 0.45]],
      death:  [[261, 0.5, 0, 'sine', 0.5], [196, 0.7, 0.4, 'sine', 0.45], [130, 1.1, 0.9, 'sine', 0.4]],
      // —— 金手指三模块专属（J7 反馈强化：各补 1~2 个合成 SFX）——
      hex:      [[311, 0.1, 0, 'sawtooth', 0.3], [415, 0.1, 0.08, 'sawtooth', 0.3], [554, 0.2, 0.16, 'sawtooth', 0.3]],
      shield:   [[622, 0.14, 0, 'sine', 0.42], [831, 0.22, 0.1, 'sine', 0.38]],
      gold:     [[988, 0.06, 0, 'square', 0.3], [1175, 0.06, 0.06, 'square', 0.3], [1568, 0.14, 0.12, 'square', 0.3]],
      backlash: [[196, 0.2, 0, 'sawtooth', 0.32], [147, 0.34, 0.16, 'sawtooth', 0.32]],
      data:     [[1200, 0.04, 0, 'square', 0.22], [1600, 0.04, 0.05, 'square', 0.22]],
      dataUp:   [[880, 0.07, 0, 'sine', 0.32], [1319, 0.12, 0.07, 'sine', 0.32]],
    },
    // BGM 谱：按人生阶段切换（五声音阶循环 + 低音）
    bgm: {
      child:   { beat: 560, wave: 'sine',     gain: 0.10, notes: [523, 587, 659, 587, 523, 659, 784, 659], bass: [131, 147], bassEvery: 4 },
      school:  { beat: 500, wave: 'triangle', gain: 0.09, notes: [440, 494, 523, 587, 523, 494, 440, 392], bass: [110, 123], bassEvery: 4 },
      work:    { beat: 460, wave: 'triangle', gain: 0.09, notes: [392, 440, 523, 440, 349, 392, 440, 392], bass: [98, 110],  bassEvery: 4 },
      retired: { beat: 620, wave: 'sine',     gain: 0.10, notes: [330, 392, 440, 392, 294, 330, 392, 330], bass: [82, 98],   bassEvery: 8 },
    },
  },

  log: {
    maxLines: 300, // 事件日志保留条数
  },

  // ================= 人生评分 & 高分榜 =================
  score: {
    leaderboardSize: 12, // 榜单保留条数
    weights: {
      age: 8,            // 每活 1 岁
      eduRank: 12,       // 学历等级序（—→博士 = 0..9）
      achievements: 22,  // 每枚成就
      married: 40,       // 步入过婚姻
      children: 15,      // 每个子女
      workYears: 5,      // 每工龄年
      deeds: 20,         // 每个善行标记
      investRealized: 0.25, // 每 1 万投资净盈亏（可为负）
      story: 1.2,
      habit: 10,         // 每内化 1 个习惯
      consumeTier: 25,   // 达到过的最高消费档（小康 ×1 / 富足 ×2 / 奢华 ×3）
      consumeSpent: 0.3, // 每 1 万累计消费
      consumeCap: 60,    // 累计消费计分上限（避免"只会花钱"也拿高分）
      contract: 30,      // v1.6.0 每达成 1 期人生合约
      persona: 6,        // v1.6.0 每枚结算页倾向标签
    },
    netWorthLog: 60,     // 60 × log10(1+总资产峰值)，对数压缩避免碾压
    // 善行/节操标记（计入 deeds）
    deedFlags: ['kind', 'filial', 'familyFirst', 'honest'],
  },

  // ======================================================================
  // 金手指三模块（v1.2.0）—— 三个系统彼此独立、互不引用对方的字段与资源
  //   海克斯：算力 HE；神壕：现金 + 月额度；数据化：观测点 DP + 人情 favor
  // 三者开关默认关闭；任一份被删掉，其余两份照常运行。
  // ======================================================================
  hex: {
    enabled: false,
    heMax: 100,
    heStart: 0,
    regenPerMonth: 4,        // 18 岁后每月回充
    regenPerAchievement: 8,  // 每解锁一枚成就
    scoreRebate: { per: 600, min: 0.4 }, // 结算折损：1 - 累计消耗/per，下限 min
    powers: [
      { id: 'reroll',      name: '命运重掷', emoji: '🎲', cost: 18,  cd: 6,  desc: '撤回当前人生岔路并重抽一次' },
      { id: 'luck',        name: '概率倾斜', emoji: '🍀', cost: 26,  cd: 3,  desc: '90 天内偶然判定成功率 ×1.35' },
      { id: 'fastforward', name: '时序快进', emoji: '⏩', cost: 30,  cd: 12, desc: '立刻跳过 6 个月' },
      { id: 'rewind',      name: '回溯',     emoji: '⏪', cost: 90,  cd: 0,  maxUse: 2, desc: '回到上个月初（终身 2 次）' },
      { id: 'cyber',       name: '义体改造', emoji: '🦾', cost: 120, cd: 0,  once: true, desc: '免疫上限 +20，每年维护费与心情代价' },
      { id: 'shield',      name: '死亡豁免', emoji: '🛡️', cost: 160, cd: 0,  maxUse: 1, desc: '下次死亡时拦下并恢复至 30 点健康' },
      { id: 'neuro',       name: '神经加速', emoji: '🧠', cost: 50,  cd: 2,  desc: '指定行动熟练度直接拉满（宗师）' },
      { id: 'nocd',        name: '无冷却',   emoji: '♾️', cost: 20,  cd: 2,  desc: '本月所有行动冷却清零一次' },
    ],
    burn: {                  // 氪命：用主角自己的东西换算力
      health:   { per: 5,  he: 14 },
      immunity: { per: 5,  he: 10 },
      mood:     { per: 10, he: 5  },
    },
    luck: { mul: 1.35, months: 3 },
    fastForwardMonths: 6,
    cyber: { immunityUp: 20, yearlyFee: 3, moodDrain: 1 },
    shieldHealth: 30,
  },

  tycoon: {
    enabled: false,
    scoreRebate: { per: 5000, min: 0.5 }, // 按累计注入金额折算
    withdraw: {
      base: 50,            // 基准金额（万元）
      refYear: 2026,       // 基准年份：金额随真实年份按 perYear 缩放
      perYear: 1.06,
      cdMonth: 2,
    },
    quota: {               // 每月操作额度（提款 / 兑换 / 清债各占一次）
      base: 1,
      byWealth: [          // 净资产越高额度越多（爽感随财富增长）
        { net: 0,    add: 0 },
        { net: 500,  add: 1 },
        { net: 5000, add: 2 },
      ],
    },
    convert: [             // 钞能力：钱 → 别的体征（同一条目本月第 n 次效果递减）
      { id: 'vip_medical',      name: '私立医院贵宾套餐', emoji: '🏥', cost: 80, effects: { health: 12 }, decay: 0.6 },
      { id: 'personal_trainer', name: '私人教练',        emoji: '🏋️', cost: 30, effects: { immunity: 8, mood: 2 }, decay: 0.6 },
      { id: 'social_banquet',   name: '一掷千金的饭局',  emoji: '🥂', cost: 40, effects: { mood: 10 }, decay: 0.6 },
      { id: 'hire_tutor',       name: '重金请名师',      emoji: '📚', cost: 25, effects: { knowledge: 15, intelligence: 1 }, decay: 0.6 },
    ],
    clearDebt: { feeRatio: 0.1, note: '按剩余负债收 10% 手续费' },
    backlash: {            // 树大招风：延时反噬（资金/人脉/税务/诈骗）
      threshold: 300,      // 净资产越过此阈值可能触发
      chance: 0.35,        // 每次提款后的触发概率（且每局最多一次）
      once: true,
      delay: [2, 12],      // 月
      effects: { wealth: -25, mood: -6 },
      log: '树大招风：税务稽查、远房亲戚与别有用心的朋友一起找上门，你疲于应付。',
    },
    persDrift: { C: -0.3, N: 0.2 },   // 大额兑换的性格漂移（走既有 G2 通道）
    driftMinWealthCost: 25,           // 单笔超过此金额才算"大额"
  },

  datalize: {
    enabled: false,
    dpMax: 60,
    dpStart: 0,
    dpPerMonth: 3,          // 每月回充
    scoreRebate: { per: 400, min: 0.6 },
    tags: ['讲义气', '势利', '嘴严', '热心', '记仇', '靠谱', '世故', '单纯', '急躁', '长袖善舞'],
    powers: [
      { id: 'reveal', name: '读取面板', emoji: '👁️', cost: 3,  target: true,  desc: '揭示某人的隐藏数值' },
      { id: 'gift',   name: '拉近关系', emoji: '🎁', cost: 5,  target: true,  desc: '好感 +（受真诚度与波动性影响，可能适得其反）' },
      { id: 'draw',   name: '支取人情', emoji: '🪝', cost: 8,  target: true,  desc: '消耗人情额度换取实质收益' },
      { id: 'cut',    name: '割席',     emoji: '✂️', cost: 6,  target: true,  desc: '立刻断绝关系（付心情代价）' },
      { id: 'relabel', name: '改写标签', emoji: '🖋️', cost: 30, target: true, maxUse: 2, desc: '扭转此人对你的核心印象（终身 2 次）' },
      { id: 'radar',  name: '全图雷达', emoji: '🔍', cost: 12, cd: 3,          desc: '按好感排序显示所有关系人' },
    ],
    relabel: { affinity: 6 },      // 换掉一个核心标签，顺带小幅抬高好感
    gift: { affinity: [6, 16], failChance: 0.2, moodCost: 1 },
    draw: {
      favorCost: 10,
      payouts: [            // 抽取一项作为收益
        { label: '引荐了一份更好的工作', effects: { wealth: 15, mood: 2 } },
        { label: '借给你一笔应急资金',   effects: { wealth: 25 } },
        { label: '替你摆平了一个麻烦',   effects: { mood: 6, health: 2 } },
        { label: '透漏了一个内部消息',   effects: { knowledge: 12, intelligence: 1 } },
      ],
      betrayalChance: 0.25, // 真诚度低时的掉链子概率
      betrayal: { mood: -5, wealth: -8, log: '他当面答应得好好的，最后却没了下文。' },
    },
    cut: { mood: -6 },
    drift: { perMonth: 1, toward: 50 },
    favorCap: 30,           // 单人可积累的人情上限（超过后不再增长）
  },
};
