/* ============================================================
   mock-data.js · 原网站数据结构的忠实镜像
   ------------------------------------------------------------
   规则 10：Mock Data 必须严格按照原网站真实数据结构。
   本文件一一对应后端 20 个 COS 文件（data/*.json），字段名、
   主键、嵌套层级、复合键写法全部照抄 cloud/etrain-api/index.js。

   业务常量（LEVELS / TASK_DEFS / READINESS_LINES / LV_STAGES）
   与判定函数（studyAutoPass / lvUnlocked / courseGateOf ...）
   照抄后端实现，保证 Mock 展示结果 = 线上真实判定结果。

   注意： 账号口径 = 线上真实（2026-10-04 核对，用户已决策去掉培训师角色）：
      admin 范文淼 / M1 郑丽薪（导师）/ M2 曾锃湘（导师）/ S001 朱子悦（学员）
      线上**没有 trainer 角色账号**，M2 是导师 -> 培训师角色已从沙盒移除。
   ============================================================ */

/* ---------- 1. data/settings.json ---------- */
//基线 L407 SETTINGS_DEFAULT = {enforceGate:false}；L656 严格 !== true 才生效
//
//【2026-10-04 用户决策】达标线阈值管理端可改 -> 覆盖值写进 settings。
//  注意： 与基线的关系（必须理解，否则会写歪）：
//    基线 READINESS_LINES 的 threshold/compare **是后端常量、从不参与判定**
//    （后端只用 key/name/source 三条判定：met 严格 === true 才算达标）。
//    所以这里新增的是"**展示口径覆盖**"，不是"判定阈值"。
//    覆盖只影响「412 / 800 人」这类**展示文案**与进度条，绝不参与 met 判定。
//  注意： 为什么覆盖值不写进 READINESS_LINES：那个常量在注释里被定义为"后端下发的"，
//    就地改写它会让人误以为后端返回值变了。分开放 -> 一眼看出"哪些是后端给的、哪些是本地改的"。
//  键：readinessThresholds[lineKey] = { value, by, byName, at }
const DB_SETTINGS = { enforceGate: false, readinessThresholds: {} };

/* ---------- 2. data/users.json ---------- Object<wid,User> */
// 字段：wid/role/name/dept/title(仅 mentor)/mentorId(仅 student)/planId/points/lastCheckin/passwordHash
const DB_USERS = {
  admin: { wid:'admin', role:'admin',  name:'范文淼', dept:'武汉校区', planId:'', points:0, lastCheckin:'' },
  M1:    { wid:'M1',    role:'mentor', name:'郑丽薪', dept:'武汉校区', title:'带教导师', planId:'', points:120, lastCheckin:'2026-10-03' },
  M2:    { wid:'M2',    role:'mentor', name:'曾锃湘', dept:'武汉校区', title:'带教导师', planId:'', points:80,  lastCheckin:'2026-10-02' },
  // 注意： 线上 S001 的密码已被用户改过，本文件不含 passwordHash，也不做登录校验
  S001:  { wid:'S001',  role:'student',name:'朱子悦', dept:'武汉校区', mentorId:'M1', planId:'P1', points:70, lastCheckin:'2026-10-03' }
};

/* ---------- 3. data/trainees.json ---------- Array<Trainee> */
const DB_TRAINEES = [
  { id:'S001', name:'朱子悦', wid:'S001', dept:'武汉校区', mentorId:'M1', planId:'P1',
    joinDate:'2026-09-23', stage:'成长期', week:2, note:'剪辑耗时 2.1 小时，离 1.5 还差 0.6' }
];

/* ---------- 4. data/mentors.json ---------- Array<Mentor> */
const DB_MENTORS = [
  { id:'M1', name:'郑丽薪', wid:'M1', dept:'武汉校区', title:'带教导师', planId:'', replyBy:'每工作日 20:00 前' },
  { id:'M2', name:'曾锃湘', wid:'M2', dept:'武汉校区', title:'带教导师', planId:'', replyBy:'每工作日 20:00 前' }
];

/* ---------- 5. data/plans.json ---------- Array<Plan> */
// competencies = 出师前置校验用的胜任力项（后端 L838 只取 comps）
// 注意：【需要确认 #4】沙盒写死 5 项；线上 mentor.planId 恒 ""，真实项来源待确认
const DB_PLANS = [
  { id:'P1', name:'5 周新人转正计划', owner:'M1',
    competencies:['能独立剪出一条可发布的视频','能找对标并说清对标为什么爆','能按飞书规范提交数据','能稳定拿到初始流量池','能做出高加粉的导流钩子'],
    weeks:[
      { w:1, phase:'新手期', levels:'L01–L06', focus:'跑通一次完整推流', gates:['L01','L02','L03','L04','L05','L06'] },
      { w:'2–3', phase:'成长期', levels:'L07–L09', focus:'沉淀模板，冲月引流 800 人', gates:['L07','L08','L09'] },
      { w:'4–5', phase:'成熟期', levels:'L10–L12', focus:'独立操盘 4 个账号，成果验收', gates:['L10','L11','L12'] }
    ] },
  { id:'P2', name:'进阶带教计划', owner:'M2',
    competencies:['能独立带新人','能拆解爆款并输出方法论','能跑通矩阵分发'],
    weeks:[
      { w:1, phase:'成长期', levels:'L07–L09', focus:'带 1 名新人', gates:[] },
      { w:'2–3', phase:'成熟期', levels:'L10–L12', focus:'独立操盘', gates:[] }
    ] }
];

/* ---------- 6. data/courses.json ---------- Array<Course> */
// 课程 <-> 关卡映射严格照抄后端 levelOfCourseIn（L412）：
//   C1->L01  C11->L02  C5->L03  C7->L04  C4->L05  C6->L06  C8->L07  C9->L08  C10->L09
// C2 / C3 已删除且「不复活」（seedlog-courses.json 登记）
// 视频待上传 = C5（飞书高效实战 L03）+ C6（行业内部爆款讲解 L06）
// chapters[] 保留双标识：type（video/sync/quiz）+ gate（后端 gateMentee/Mentor 不校验 gate，
//这是基线既有缺陷 L776/L787，迁移不得"顺手修"，此处照抄）
const DB_COURSES = [
  { id:'C1', title:'新人启动课堂', lecturer:'范文淼', subject:'公司业务', difficulty:'入门',
    hot:98, rating:4.8, status:'on', minutes:22,
    // desc / docs 照抄线上后端种子 COURSES[0]（后端 L512 C1_META = COURSES[0]）
    desc:'流量团队是什么、流量团队的核心使命、核心工作链路、赛道以及成长地图（课程需要加载几分钟）',
    docs:[ { name:'流量团队新人启动课堂', size:'1.9 MB', url:'/assets/docs/流量团队新人启动课堂.pdf' } ],
    chapters:[ { id:'c1', title:'公司业务怎么跑 · 转正标准 · 你的带教是谁', type:'video', src:'assets/videos/C1-c1.mp4', dur:1320, gate:false } ] },

  { id:'C11', title:'剪辑基础课 · 剪映提效', lecturer:'曾锃湘', subject:'剪辑', difficulty:'入门',
    hot:95, rating:4.7, status:'on', minutes:41,
    chapters:[
      { id:'c11a', title:'剪映基础操作',type:'video', src:'assets/videos/C11-c11a.mp4', dur:1020, gate:false },
      { id:'c11b', title:'批量字幕：3 个提效技巧', type:'video', src:'assets/videos/C11-c11b.mp4', dur:858, gate:false },
      { id:'c11c', title:'关键帧与智能剪辑', type:'video', src:'', dur:1380, gate:false } ] },

  { id:'C5', title:'飞书高效实战', lecturer:'范文淼', subject:'飞书', difficulty:'进阶',
    hot:91, rating:4.6, status:'on', minutes:55, videoPending:true,
    chapters:[
      { id:'c5a', title:'飞书文档协作',type:'video', src:'', dur:840, gate:false },
      { id:'c5b', title:'多维表格：把数据变成台账', type:'video', src:'', dur:1020, gate:false },
      { id:'c5c', title:'审批流配置实战',type:'video', src:'', dur:1260, gate:false },
      { id:'c5d', title:'日报周报自动化',      type:'video', src:'', dur:1080, gate:false } ] },

  { id:'C7', title:'流量一站式入门', lecturer:'崔慧欣', subject:'流量获客', difficulty:'入门',
    hot:94, rating:4.7, status:'on', minutes:31,
    chapters:[
      { id:'c7a', title:'找对标 <svg class="ic"><use href="#i-arrow-r"/></svg> 做对标：完整链路', type:'video', src:'assets/videos/C7-c7a.mp4', dur:1104, gate:false },
      { id:'c7b', title:'推客资到微信：话术与承接',   type:'video', src:'assets/videos/C7-c7b.mp4', dur:768,  gate:true } ] },

  { id:'C4', title:'账号冷启动', lecturer:'郑丽薪', subject:'账号运营', difficulty:'进阶',
    hot:90, rating:4.5, status:'on', minutes:38,
    // desc / docs 照抄线上后端种子 COURSES[C4]
    desc:'账号起号教程，破解抖音账号冷启动的底层逻辑',
    docs:[ { name:'飞书文档', url:'https://jcnau8fbjuns.feishu.cn/docx/PyA1dxiiEov56SxjquscdX2TnGc?from=from_copylink' } ],
    chapters:[
      { id:'c4a', title:'新号前 7 天怎么养',     type:'video', src:'assets/videos/C4-c4a.mp4', dur:860, gate:false },
      { id:'c4b', title:'发布节奏与初始流量池', type:'video', src:'assets/videos/C4-c4b.mp4', dur:725, gate:false },
      { id:'c4c', title:'限流了怎么诊断',       type:'video', src:'assets/videos/C4-c4c.mp4', dur:695, gate:false } ] },

  { id:'C6', title:'行业内部爆款讲解', lecturer:'崔慧欣', subject:'爆款拆解', difficulty:'进阶',
    hot:89, rating:4.6, status:'on', minutes:67, videoPending:true,
    chapters:[
      { id:'c6a', title:'钩子四型：悬念 / 痛点 / 反常识 / 身份认同', type:'video', src:'', dur:1000, gate:false },
      { id:'c6b', title:'选题公式：为什么他总能踩中', type:'video', src:'', dur:940, gate:false },
      { id:'c6c', title:'结构：钩子之后怎么留人',type:'video', src:'', dur:880,  gate:false },
      { id:'c6d', title:'结尾：把流量变成私信',     type:'video', src:'', dur:820,  gate:false },
      { id:'c6e', title:'案例：10 条同赛道爆款',    type:'video', src:'', dur:1370, gate:false } ] },

  { id:'C8', title:'百万爆款之剪辑工作流', lecturer:'王璐瑶', subject:'剪辑', difficulty:'高阶',
    hot:93, rating:4.8, status:'on', minutes:44,
    chapters:[
      { id:'c8a', title:'爆款拆解：从素材到成片', type:'video', src:'assets/videos/C8-c8a.mp4', dur:1180, gate:false },
      { id:'c8b', title:'素材采集清单',           type:'video', src:'assets/videos/C8-c8b.mp4', dur:760,  gate:false },
      { id:'c8c', title:'字幕节奏控制',           type:'video', src:'assets/videos/C8-c8c.mp4', dur:700,  gate:false } ] },

  { id:'C9', title:'高导粉获客秘籍', lecturer:'王璐瑶', subject:'流量获客', difficulty:'高阶',
    hot:92, rating:4.7, status:'on', minutes:29,
    chapters:[
      { id:'c9a', title:'一条视频带来 800+ 加微', type:'video', src:'assets/videos/C9-c9a.mp4', dur:980, gate:false },
      { id:'c9b', title:'钩子结构化模板',         type:'video', src:'assets/videos/C9-c9b.mp4', dur:760, gate:false } ] },

  { id:'C10', title:'矩阵分发', lecturer:'范文淼', subject:'账号运营', difficulty:'高阶',
    hot:88, rating:4.5, status:'on', minutes:36,
    chapters:[
      { id:'c10a', title:'多账号内容分发', type:'video', src:'assets/videos/C10-c10a.mp4', dur:900, gate:false },
      { id:'c10b', title:'发布时序与去重', type:'video', src:'assets/videos/C10-c10b.mp4', dur:840, gate:false },
      { id:'c10c', title:'跨平台适配差异',   type:'video', src:'assets/videos/C10-c10c.mp4', dur:840, gate:false } ] }
];

/* ---------- 7. data/seedlog-courses.json ---------- Array<string>（不复活已删课程）*/
const DB_SEEDLOG_COURSES = ['C2','C3'];

/* ---------- 8. 业务常量（照抄后端） ---------- */
const LV_STAGES   = ['study','practice','exam'];         // L615
const LV_STAGE_CN = { study:'学', practice:'练', exam:'考' }; // L616
const EXAM_TASK   = 'EXAM';// L489 「考」环节伪任务 id
const TASK_ST_CN  = { submitted:'待审核', passed:'已通过', rejected:'已打回' }; // L676

// 后端 L477-482。注意：threshold/compare/unit/rule/hint 服务端从不用于判定，纯下发
const READINESS_LINES = [
  { key:'study',name:'学习达标',   rule:'12 关全部通关',        source:'site',unit:'',threshold:null, compare:'gte', hint:'课程+任务卡+考核' },
  { key:'traffic', name:'月引流',    rule:'月引流 ≥ 800',          source:'feishu',unit:'人', threshold:800,  compare:'gte', hint:'口径以飞书为准' },
  { key:'editing', name:'剪辑效率',  rule:'长视频剪辑 < 1.5 小时', source:'feishu',unit:'小时',threshold:1.5, compare:'lt',  hint:'越小越好' },
  { key:'accounts',name:'账号运营',  rule:'运营 4 个账号',source:'feishu',unit:'个', threshold:4,    compare:'gte', hint:'口径以飞书为准' }
];

/* ---------- 8b. 有效阈值解析（唯一口径，所有展示方都必须走这里） ----------
   背景：阈值是"后端常量 + 本地覆盖"两层。任何地方直接用 line.threshold 都会
        在管理端改过阈值后显示旧数值 —— 所以**禁止**再直接读 line.threshold。
   规则：
     · source==='site' 的线（学习达标）：阈值 = 关卡总数，**天然不可改**（改它没有意义）
     · 其余线：effectiveThreshold = settings 覆盖值 ?? 后端常量
   返回 { threshold, compare, unit, custom, by, byName, at }
     custom=true 表示当前用的是本地覆盖值（UI 要标出来，否则管理员会忘了自己改过）
   注意： 本函数**只服务展示**。判定一律走 rec.met === true（基线口径），不比较数值。 */
function effectiveThreshold(key){
  const line=READINESS_LINES.find(l=>l.key===key);
  if(!line) return null;
  if(line.source==='site')
    return { threshold:DB_LEVELS.length, compare:'gte', unit:'关', custom:false, by:null, byName:null, at:null };
  const ov=(DB_SETTINGS.readinessThresholds||{})[key];
  const custom=!!(ov&&typeof ov.value==='number'&&isFinite(ov.value));
  return { threshold: custom?ov.value:line.threshold, compare:line.compare, unit:line.unit,
           custom, by:custom?ov.by:null, byName:custom?ov.byName:null, at:custom?ov.at:null };
}

// 后端 L490-504，13 张，全部指向 L05–L12（L01–L04 无任务卡）
// 注意： id 顺序：T-G3 在 T-G2 之前（基线原样，不得重排）
// 注意：【2026-10-04 补】原沙盒漏了后端的 `req` 字段（任务要求原文）-> 页面只能显示兜底文案。
//    这里照抄后端 L491-503 的 req，保持沙盒与后端字段一致（接入时页面代码不用动）。
const TASK_DEFS = [
  { id:'T-N1', levelId:'L05', title:'账号准备',   req:'按账号规范完成头像/昵称/简介设置，截图提交' },
  { id:'T-N2', levelId:'L05', title:'标准起号',   req:'完成新账号冷启动设置与首条内容发布，附截图或链接' },
  { id:'T-N3', levelId:'L05', title:'发布规范',   req:'按发布规范完成一次标准发布，附截图' },
  { id:'T-N4', levelId:'L06', title:'对标爆款',   req:'拆解 3 个对标爆款（结构/钩子/转化点），提交拆解笔记' },
  { id:'T-G1', levelId:'L07', title:'体裁剪辑',   req:'剪辑 3 条不同体裁作品，附成片链接' },
  { id:'T-G3', levelId:'L07', title:'封面开头',   req:'完成 1 条作品的封面与开头 3 秒优化，附前后对比' },
  { id:'T-G2', levelId:'L08', title:'导流',       req:'发 20 条私信导流并记录回复情况，附记录' },
  { id:'T-G4', levelId:'L09', title:'矩阵发布',   req:'完成 1 次矩阵分发发布，附各平台链接' },
  { id:'T-M1', levelId:'L10', title:'剪辑效率',   req:'长视频剪辑耗时 < 1.5 小时，附剪辑工程与耗时记录' },
  { id:'T-M2', levelId:'L10', title:'多账号运营', req:'同时运营 4 个账号并保持更新，附账号清单' },
  { id:'T-M3', levelId:'L11', title:'数据复盘',   req:'完成 1 次数据复盘（播放/加粉/转化），提交复盘文档' },
  { id:'T-M4', levelId:'L11', title:'诊断优化',   req:'诊断 1 个数据问题并提出优化方案，附诊断记录' },
  { id:'T-M5', levelId:'L12', title:'转正项目',   req:'从 0 起一个新号到稳定产出导流，提交完整项目总结' }
];

// 后端 L330-381，12 关。
// study.courseIds 为空或[] -> studyAutoPass 永不可自动通过，只能靠管理端代录（L12 就是这种）
// practice.tasks 用**裸编号**（与 TASK_DEFS 的 "T-N1" 不对齐，后端不 join —— 基线原样）
const DB_LEVELS = [
  { no:1,  id:'L01', title:'新人启动课堂',phase:'新手期',week:'第1周',
    stages:{ study:{courseIds:['C1']}, practice:null, exam:null } },
  { no:2,  id:'L02', title:'剪辑基础课 + 剪映提效', phase:'新手期',week:'第1周',
    stages:{ study:{courseIds:['C11']}, practice:null, exam:{by:'文淼'} } },
  { no:3,  id:'L03', title:'飞书高效实战',   phase:'新手期',week:'第1周',
    stages:{ study:{courseIds:['C5']},  practice:null, exam:{by:'文淼'} } },
  { no:4,  id:'L04', title:'流量一站式入门', phase:'新手期',week:'第1周',
    stages:{ study:{courseIds:['C7']},  practice:null, exam:{by:'慧欣'} } },
  { no:5,  id:'L05', title:'账号冷启动',     phase:'新手期',week:'第1周',
    stages:{ study:{courseIds:['C4']},  practice:{tasks:['N1 账号准备','N2 标准起号','N3 发布规范'],by:'带教'}, exam:{by:'力丹'} } },
  { no:6,  id:'L06', title:'行业内部爆款讲解', phase:'新手期',week:'第1周',
    stages:{ study:{courseIds:['C6']},  practice:{tasks:['N4 对标爆款'],by:'带教'}, exam:null } },
  { no:7,  id:'L07', title:'百万爆款之剪辑工作流', phase:'成长期',week:'第2-3周',
    stages:{ study:{courseIds:['C8']},  practice:{tasks:['G1 体裁剪辑','G3 封面开头'],by:'带教'}, exam:{by:'璐瑶'} } },
  { no:8,  id:'L08', title:'高导粉获客秘籍', phase:'成长期',week:'第2-3周',
    stages:{ study:{courseIds:['C9']},  practice:{tasks:['G2 导流'],by:'带教'}, exam:{} } },
  { no:9,  id:'L09', title:'矩阵分发',       phase:'成长期',week:'第2-3周',
    stages:{ study:{courseIds:['C10']}, practice:{tasks:['G4 矩阵发布'],by:'带教'}, exam:{} } },
  { no:10, id:'L10', title:'账号分配方案',   phase:'成熟期',week:'第4-5周',
    stages:{ study:null,             practice:{tasks:['M1 剪辑效率','M2 多账号运营'],by:'带教'}, exam:null } },
  { no:11, id:'L11', title:'数据复盘与诊断', phase:'成熟期',week:'第4-5周',
    stages:{ study:null,             practice:{tasks:['M3 数据复盘','M4 诊断优化'],by:'带教'}, exam:null } },
  { no:12, id:'L12', title:'转正项目',       phase:'成熟期',week:'第4-5周',
    stages:{ study:{courseIds:[]},    practice:{tasks:['M5 转正项目'],by:'带教'}, exam:{} } }
];
const LEVEL_PHASES = [
  { name:'新手期', from:1, to:6,  week:'第 1 周' },
  { name:'成长期', from:7, to:9,  week:'第 2–3 周' },
  { name:'成熟期', from:10,to:12, week:'第 4–5 周' }
];
// 26 分制：学 10 + 练 8 + 考 8（后端 L322-325 注释）
// 注意：【需要确认 #3】基线只给合计 26，无「每章 2 分」这类细则；此处只按关卡阶段折算，不自造细则
const SCORE_TOTAL = 26;

/* ---------- 9. data/learn.json ----------Object<"wid|cid", LearnRec> */
// 复合键：严格用 "wid|cid" 拼接，不可按 wid 重索引（后端 L742 注释）
// events[] 只增不删、无上限；wrong[] 记错题
const DB_LEARN = {
  'S001|C1' : { done:['c1'],speed:1,   resumeAt:1320, dragSkip:false, events:[{ts:'2026-09-23T15:02:00Z',t:1320,d:0}], wrong:[] },
  'S001|C11': { done:['c11a','c11b','c11c'], speed:1.25,resumeAt:0,   dragSkip:false, events:[], wrong:[] },
  'S001|C5' : { done:['c5a','c5b','c5c','c5d'], speed:1,  resumeAt:0,   dragSkip:false, events:[], wrong:[] },
  'S001|C7' : { done:['c7a','c7b'],  speed:1,   resumeAt:768,  dragSkip:false, events:[], wrong:[] },
  'S001|C4' : { done:['c4a','c4b','c4c'],speed:1.5,resumeAt:0,   dragSkip:false, events:[], wrong:[] },
  'S001|C8' : { done:['c8a'],        speed:1,   resumeAt:1180, dragSkip:false, events:[
    {ts:'2026-10-03T20:14:00Z',t:1180,d:0},
    {ts:'2026-10-04T09:41:00Z',t:300, d:18}
  ], wrong:[] }
};

/* ---------- 10. data/journey.json ---------- Object<wid,Object<levelId,Object<stage,JRec>>> */
// JRec:{ ok:true, by, byName, at, note(≤300), auto }
// auto：管理端代录**无**（L1413），审核端**有**（L1502/L1509）—— 基线原样
const DB_JOURNEY = {
  S001: {
    L01:{ study:{ ok:true, by:'system', byName:'系统自动', at:'2026-09-23T15:20:00Z', auto:true } },
    L02:{ study:{ ok:true, by:'system', byName:'系统自动', at:'2026-09-25T11:04:00Z', auto:true },
          exam: { ok:true, by:'M1', byName:'郑丽薪', at:'2026-09-27T16:20:00Z', note:'剪映基础操作完整，批量字幕技巧已落地。' } },
    L03:{ study:{ ok:true, by:'system', byName:'系统自动', at:'2026-09-29T20:31:00Z', auto:true },
          exam: { ok:true, by:'M1', byName:'郑丽薪', at:'2026-10-02T10:05:00Z', note:'飞书审批流演示完整，表格规范。' } }
    // L03 之后的关卡无线上记录 -> 全部未过（与「解锁链卡死」的真实状态一致）
  }
};

/* ---------- 11. data/tasks.json ---------- Object<wid,Object<levelId,Object<taskId,TaskRec>>> */
// TaskRec:{ status, note(≤500), at, by, byName, reviewNote(≤300), reviewedAt, reviewedBy, reviewedByName }
// rejected 允许覆盖重提（L1448 只拦 passed）
const DB_TASKS = { S001:{} };

/* ---------- 12. data/readiness.json ---------- Object<wid,Object<lineKey,RRec>+认证三字段> */
// RRec:{ value, met(严格===true), note(≤200), by, byName, at }
// 同层认证：certifiedAt / certifiedBy / certifiedByName
const DB_READINESS = {
  S001: {
    traffic: { value:412, met:false, note:'飞书「线上成员信息库」9 月自然月加粉 412 人', by:'M1', byName:'郑丽薪', at:'2026-10-01T10:00:00Z' },
    editing: { value:2.1, met:false, note:'最近 5 条视频平均剪辑耗时 2.1 小时',by:'M1', byName:'郑丽薪', at:'2026-10-01T10:00:00Z' },
    accounts:{ value:2,   met:false, note:'2 个账号近 7 天有更新',by:'M1', byName:'郑丽薪', at:'2026-10-01T10:00:00Z' }
    // study 线是 source==="site"，管理端只读「系统自动判定」，服务端不存记录
  }
};

/* ---------- 13. data/gates.json ---------- Object<"wid|cid|chid",Gate> */
// Gate:{ mentee, menteeNote, mentor, unlockedAt }；unlockedAt = g.mentee && g.mentor（L390）
const DB_GATES = {
  'S001|C7|c7b': { mentee:true, menteeNote:'已提交话术表截图，请导师确认', mentor:true, unlockedAt:'2026/10/1 15:20:32' }
};

/* ---------- 14. data/competency.json ---------- Object<wid,{byPlan:{[pid]:{comps:{[name]:bool}}}}> */
const DB_COMPETENCY = {
  S001: { byPlan:{ P1:{ comps:{
    '能独立剪出一条可发布的视频':true,
    '能找对标并说清对标为什么爆':true,
    '能按飞书规范提交数据':true,
    '能稳定拿到初始流量池':false,
    '能做出高加粉的导流钩子':false } } } }
};

/* ---------- 15. data/signoffs.json ---------- Object<wid,{planId,rating,mentorName,ts}> */
// 注意： 只存一个 planId -> 一个学员只能出师一次（基线既有限制）
const DB_SIGNOFFS = {};

/* ---------- 16. data/coaching.json ---------- Object<wid,{id,events:[{ts,ev,txt}]}> */
// ev ∈ { 同频, 出师, 任务 }
const DB_COACHING = {
  S001: { id:'S001', events:[
    { ts:'2026-10-01T15:20:00Z', ev:'同频', txt:'推客资话术对齐，C7 章节二解锁。' },
    { ts:'2026-10-03T20:14:00Z', ev:'任务', txt:'盯办T-N1 账号命名规范自查。' }
  ] }
};

/* ---------- 17. data/fav.json ---------- Object<wid,{courses:{}}> */
const DB_FAV = { S001:{ courses:{} } };

/* ---------- 18. data/qa.json ---------- Object<cid,{id,items:[{u,ts,txt}]}> */
// [红] 基线缺陷：qa 全量透传不过滤（L774），带教反馈走 cid="__coach_"+tid（HTML L1396）
// -> 学员能读到所有人的伪课程反馈。本文件原样体现该行为，不擅自修
const DB_QA = {};

/* ---------- 19. data/rating.json ---------- Object<cid,{id,scores}> */
const DB_RATING = {};

/* ---------- 20. data/_fix_tmp_audit.json ---------- 一次性标记，本Mock 无此文件 ---------- */

/* ============================================================
   判定函数 —— 照抄后端，保证 Mock 结果 = 线上真实结果
   ============================================================ */
const DB = {
  users:DB_USERS, trainees:DB_TRAINEES, mentors:DB_MENTORS, plans:DB_PLANS,
  courses:DB_COURSES, levels:DB_LEVELS, tasks:DB_TASKS, journey:DB_JOURNEY,
  readiness:DB_READINESS, learn:DB_LEARN, gates:DB_GATES, competency:DB_COMPETENCY,
  signoffs:DB_SIGNOFFS, coaching:DB_COACHING, fav:DB_FAV, qa:DB_QA, rating:DB_RATING,
  settings:DB_SETTINGS, seedlogCourses:DB_SEEDLOG_COURSES,
  taskDefs:TASK_DEFS, readinessLines:READINESS_LINES, phases:LEVEL_PHASES
};

const KEY=(a,b)=>a+'|'+b;             // 后端复合键写法（learn: "wid|cid"）
const KEY3=(a,b,c)=>a+'|'+b+'|'+c;     // gates: "wid|cid|chid" —— 三段，不能用 KEY
const courseOf = cid=>DB.courses.find(c=>c.id===cid);
const levelOf  = lid=>DB.levels.find(l=>l.id===lid);
const userOf   = wid=>DB.users[wid];
const planOf   = pid=>DB.plans.find(p=>p.id===pid);
const traineeOf= wid=>DB.trainees.find(t=>t.id===wid);
const mentorOf = mid=>DB.mentors.find(m=>m.id===mid);

// 后端 L412 levelOfCourseIn：一门课只属于一个关卡
function levelOfCourseIn(cid){
  const lv=DB.levels.find(l=>(l.stages.study&&l.stages.study.courseIds||[]).includes(cid));
  return lv||null;
}

// 后端 L623-636 studyAutoPass：绑定课程**全部 video 章节**都 done 才通过
// 三个提前 return false 是基线硬约束，缺一不可：
function studyAutoPass(lv, wid){
  const ids=(lv.stages&&lv.stages.study&&lv.stages.study.courseIds)||[];
  if(!ids.length) return false;                                  // 1. 没挂课（L12 就是这种）
  for(const cid of ids){
    const c=courseOf(cid);
    if(!c) return false;                                         // 2. 课程找不到
    const vids=(c.chapters||[]).filter(ch=>ch.type==='video').map(ch=>ch.id);
    if(!vids.length) return false;                               // 3. 课里没有视频章节
    const rec=DB.learn[KEY(wid,cid)];const done=(rec&&rec.done)||[];
    for(const v of vids) if(!done.includes(v)) return false;
  }
  return true;
}

// 后端 L639-644 lvStageOf：人工代录优先 -> 「学」系统自动 -> 其余 null
function lvStageOf(j, levelId, stage, wid){
  const r=(j&&j[levelId]&&j[levelId][stage])||null;
  if(r&&r.ok) return r;
  const lv=levelOf(levelId); if(!lv) return null;
  if(stage==='study'){ if(studyAutoPass(lv,wid)) return { ok:true, by:'system', byName:'系统自动', auto:true }; }
  return null;
}
function lvStageOk(wid, levelId, stage){
  return !!lvStageOf(DB.journey[wid],levelId,stage,wid);
}
// 后端 L1504-1508：「练」= 该关全部卡都 passed 才写 journey.practice
function practiceDone(wid,levelId){
  const defs=TASK_DEFS.filter(t=>t.levelId===levelId);
  if(!defs.length) return lvStageOk(wid,levelId,'practice');
  return defs.every(t=>(DB.tasks[wid]&&DB.tasks[wid][levelId]&&DB.tasks[wid][levelId][t.id]||{}).status==='passed');
}
// [红]【2026-10-04 修正】原实现 `LV_STAGES.every(...)` 遍历**全部 3 个环节**，
//   但 L01–L04 只有 study（practice/exam 为 null）-> 后两个环节永远判 false
//   -> levelDone 永远 false -> 整个解锁链锁死（真实线上就是这个现象）。
//   后端 L437-440 levelDoneFor 只遍历 `stagesOfLevel(lv)`（该关**实际存在**的环节），
//   且要求 `ss.length > 0`。这里对齐后端，不是自创规则。
function levelDone(wid, lv){
  const present=LV_STAGES.filter(s=>!!(lv.stages&&lv.stages[s]));
  if(!present.length) return false;                     // 无任何环节 -> 不算通过（后端同款防御）
  return present.every(s=> s==='practice'
    ? practiceDone(wid,lv.id)
    : lvStageOk(wid,lv.id,s));
}
// 后端 L650 lvUnlocked：第 1 关恒开；第 N 关需第 N−1 关全环节通过
function levelUnlocked(wid, lv){
  if(!lv) return false;
  if(lv.no<=1) return true;
  const prev=DB.levels.find(l=>l.no===lv.no-1);
  return levelDone(wid,prev);
}
// 当前关 = 第一个未全过的关
function currentLevelOf(wid){
  return DB.levels.find(l=>!levelDone(wid,l))||DB.levels[DB.levels.length-1];
}
// 关卡「已过 n / 共 m 环节」—— m 恒等于 3（学/练/考），已按你的决策改回基线口径
// 【已修正】原沙盒出现 1·4 / 1·2 / 0·2，是把「练」拆成每张卡计数
const stageCountOf = lv=>LV_STAGES.filter(s=>!!(lv.stages&&lv.stages[s])).length;
function levelProgress(wid, lv){
  const present=LV_STAGES.filter(s=>!!(lv.stages&&lv.stages[s]));
  const done=present.filter(s=> s==='practice' ? practiceDone(wid,lv.id) : lvStageOk(wid,lv.id,s));
  return { done:done.length, total:present.length, states:present.map(s=>({stage:s, ok:(s==='practice'?practiceDone(wid,lv.id):lvStageOk(wid,lv.id,s))})) };
}
// 26 分：按三环节累计数×权重折算，不自造「每章 2 分」细则
function scoreOf(wid){
  let got=0;
  DB.levels.forEach(lv=>{
    LV_STAGES.forEach(s=>{
      if(!(lv.stages&&lv.stages[s])) return;
      const ok = s==='practice' ? practiceDone(wid,lv.id) : lvStageOk(wid,lv.id,s);
      if(ok) got += s==='study' ? 1 : 1;
    });
  });
  return got; // 上限 = 实际存在的环节总数
}

/* ---------- courseGateOf（L656-664）：严格 !==true，"true"/1 都算关闭 ---------- */
function courseGateOf(cid, wid){
  if(!DB.settings || DB.settings.enforceGate!==true) return {unlocked:true,levelNo:0,needNo:0,needTitle:''};
  const lv=levelOfCourseIn(cid);
  if(!lv) return {unlocked:true,levelNo:0,needNo:0,needTitle:''};   // C2/C3 未挂关卡 -> 放行（基线既有行为）
  const unlocked=levelUnlocked(wid||'S001',lv);
  return { unlocked, levelNo:lv.no, needNo:unlocked?0:lv.no-1,
           needTitle:(DB.levels.find(l=>l.no===lv.no-1)||{}).title||'' };
}
function courseLocked(cid, wid){ return courseGateOf(cid,wid).unlocked===false; }
// 前端只读服务端下发结果，不自算（基线 L656 的硬约束）。这里等价实现，供Mock 使用
function lockReason(cid, wid){
  const g=courseGateOf(cid,wid);
  return g.needNo ? ('需先通过第 '+g.needNo+' 关 · '+g.needTitle) : '暂未解锁';
}

/* ---------- 待办计数 todoCounts()：全站唯一口径 ---------- */
function todoCounts(wid){
  const role=userOf(wid).role;
  let wids=[];
  if(role==='admin')                 wids=DB.trainees.map(t=>t.id);
  else if(role==='mentor')           wids=DB.trainees.filter(t=>t.mentorId===wid).map(t=>t.id);
  else                               wids=[wid];
  const out={practice:0,exam:0,total:0};
  wids.forEach(w=>{
    // DB.tasks 是 { 工号: { 关卡: { 任务id: rec } } } 三层普通对象，必须用 Object.keys 遍历
    const byLv=DB.tasks[w]||{};
    Object.keys(byLv).forEach(lvId=>{
      const one=byLv[lvId]||{};
      Object.keys(one).forEach(tid=>{
        const r=one[tid]; if(!r||r.status!=='submitted') return;
        // 待办口径：admin 全站（练+考）、mentor 只自己徒弟（练+考）、学员只自己
        if(tid===EXAM_TASK) out.exam++;
        else                out.practice++;
      });
    });
  });
  out.total=out.practice+out.exam;
  return out;
}

/* ---------- 导出给页面用 ---------- */
window.MOCK = {
  DB, LV_STAGES, LV_STAGE_CN, EXAM_TASK, TASK_ST_CN, TASK_DEFS, READINESS_LINES,
  LEVEL_PHASES, SCORE_TOTAL, DB_SEEDLOG_COURSES, effectiveThreshold,
  courseOf, levelOf, userOf, planOf, traineeOf, mentorOf, levelOfCourseIn,
  studyAutoPass, lvStageOf, lvStageOk, practiceDone, levelDone,
  levelUnlocked, currentLevelOf, levelProgress, stageCountOf, scoreOf,
  courseGateOf, courseLocked, lockReason, todoCounts, KEY, KEY3
};