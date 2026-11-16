const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const initSqlJs = require('sql.js');

function resolveDataFile() {
  const dirs = process.env.XF_DATA_DIR
    ? [process.env.XF_DATA_DIR]
    : [path.join(__dirname, '..', 'data'), path.join(os.tmpdir(), 'xiaofan-finance')];
  for (const dir of dirs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, `.write-test-${process.pid}`);
      fs.writeFileSync(probe, '');
      fs.unlinkSync(probe);
      return path.join(dir, 'finance.db');
    } catch {
      // 目录不可写时尝试下一个位置（部署环境回退到临时目录）
    }
  }
  return null;
}

const dbPath = resolveDataFile();

let sqlite = null;
let persistTimer = null;

function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!dbPath || !sqlite) return;
  try {
    fs.writeFileSync(dbPath, Buffer.from(sqlite.export()));
  } catch (err) {
    console.error('数据保存失败:', err.message);
  }
}

function persist() {
  if (!dbPath || persistTimer) return;
  persistTimer = setTimeout(flushPersist, 200);
  if (persistTimer.unref) persistTimer.unref();
}

function bind(stmt, params) {
  if (params.length) stmt.bind(params.map((v) => (v === undefined ? null : v)));
}

function all(sql, ...params) {
  const stmt = sqlite.prepare(sql);
  try {
    bind(stmt, params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function one(sql, ...params) {
  return all(sql, ...params)[0];
}

function run(sql, ...params) {
  const stmt = sqlite.prepare(sql);
  try {
    bind(stmt, params);
    stmt.step();
  } finally {
    stmt.free();
  }
  const changes = sqlite.getRowsModified();
  const last = all('SELECT last_insert_rowid() AS id')[0];
  persist();
  return { changes, lastInsertRowid: Number(last?.id || 0) };
}

const db = {
  prepare: (sql) => ({
    run: (...params) => run(sql, ...params),
    get: (...params) => one(sql, ...params),
    all: (...params) => all(sql, ...params),
  }),
  exec: (sql) => {
    sqlite.run(sql);
    persist();
  },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS account_books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '智能版',
  company TEXT,
  tax_no TEXT,
  start_month TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT '超级管理员'
);
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  direction TEXT NOT NULL,
  parent_id INTEGER,
  report_line TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  nature TEXT NOT NULL,
  tag TEXT,
  subject_id INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS counterparties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '客户',
  contact TEXT,
  phone TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  spec TEXT,
  unit TEXT,
  warehouse_id INTEGER
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  group_name TEXT,
  direction TEXT NOT NULL,
  parent_id INTEGER,
  subject_id INTEGER,
  offset_subject_id INTEGER,
  report_line TEXT,
  internal INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  no INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  summary TEXT,
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  account_id INTEGER,
  counterparty_id INTEGER,
  project_id INTEGER,
  inventory_id INTEGER,
  quantity REAL,
  settle_type TEXT,
  settled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '未审核',
  creator TEXT NOT NULL DEFAULT '小番游乐场用户',
  auditor TEXT,
  audited_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  no INTEGER NOT NULL,
  summary TEXT,
  source_flow_no INTEGER,
  status TEXT NOT NULL DEFAULT '已保存',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS voucher_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id INTEGER NOT NULL,
  summary TEXT,
  subject_id INTEGER NOT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS closings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL UNIQUE,
  closed_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  operator TEXT
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  text TEXT NOT NULL
);
`;

function empty() {
  const r = one('SELECT COUNT(*) AS c FROM account_books');
  return !r || r.c === 0;
}

function insert(table, data) {
  const keys = Object.keys(data);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  return Number(run(sql, ...keys.map((k) => data[k])).lastInsertRowid);
}

const SUBJECTS = [
  ['1001', '库存现金', '资产', '借', 'asset'],
  ['1002', '银行存款', '资产', '借', 'asset'],
  ['1012', '其他货币资金', '资产', '借', 'asset'],
  ['1122', '应收账款', '资产', '借', 'asset'],
  ['1123', '预付账款', '资产', '借', 'asset'],
  ['1221', '其他应收款', '资产', '借', 'asset'],
  ['1405', '库存商品', '资产', '借', 'asset'],
  ['1601', '固定资产', '资产', '借', 'asset'],
  ['2202', '应付账款', '负债', '贷', 'liability'],
  ['2203', '预收账款', '负债', '贷', 'liability'],
  ['2211', '应付职工薪酬', '负债', '贷', 'liability'],
  ['2221', '应交税费', '负债', '贷', 'liability'],
  ['4001', '实收资本', '权益', '贷', 'equity'],
  ['4103', '本年利润', '权益', '贷', 'equity'],
  ['6001', '主营业务收入', '收入', '贷', 'revenue'],
  ['6401', '主营业务成本', '成本', '借', 'cost'],
  ['6601', '销售费用', '费用', '借', 'expense'],
  ['6602', '管理费用', '费用', '借', 'expense'],
  ['6603', '财务费用', '费用', '借', 'expense'],
  ['6301', '营业外收入', '收入', '贷', 'other_income'],
  ['6711', '营业外支出', '费用', '借', 'other_loss'],
  ['6801', '所得税费用', '费用', '借', 'tax'],
];

const CATEGORIES = [
  { name: '营业收入', group: '营业收入', direction: '收', subject: '6001', report: 'revenue', sort: 1 },
  { name: '销售收入', parent: '营业收入', direction: '收', subject: '6001', report: 'revenue' },
  { name: '营业支出', group: '营业支出', direction: '付', subject: '6401', report: 'cost', sort: 2 },
  { name: '商品采购', parent: '营业支出', direction: '付', subject: '1405', report: null },
  { name: '费用支出', group: '费用支出', direction: '付', subject: '6602', report: 'expense', sort: 3 },
  { name: '办公费用', parent: '费用支出', direction: '付', subject: '6602', report: 'expense' },
  { name: '差旅费用', parent: '费用支出', direction: '付', subject: '6602', report: 'expense' },
  { name: '经营租金', parent: '费用支出', direction: '付', subject: '6602', report: 'expense' },
  { name: '物业相关费用', parent: '费用支出', direction: '付', subject: '6602', report: 'expense' },
  { name: '车辆使用费用', parent: '费用支出', direction: '付', subject: '6602', report: 'expense' },
  { name: '广告宣传费用', parent: '费用支出', direction: '付', subject: '6601', report: 'expense' },
  { name: '公关招待费用', parent: '费用支出', direction: '付', subject: '6602', report: 'expense' },
  { name: '财务费用', parent: '费用支出', direction: '付', subject: '6603', report: 'expense' },
  { name: '其他费用', parent: '费用支出', direction: '付', subject: '6602', report: 'expense' },
  { name: '薪酬支出', group: '薪酬支出', direction: '付', subject: '2211', report: 'expense', sort: 4 },
  { name: '工资薪金', parent: '薪酬支出', direction: '付', subject: '2211', report: 'expense' },
  { name: '税费支出', group: '税费支出', direction: '付', subject: '2221', report: 'tax', sort: 5 },
  { name: '增值税', parent: '税费支出', direction: '付', subject: '2221', report: 'tax' },
  { name: '所得税', parent: '税费支出', direction: '付', subject: '6801', report: 'tax' },
  { name: '营业外收入', group: '营业外收入', direction: '收', subject: '6301', report: 'other_income', sort: 6 },
  { name: '营业外支出', group: '营业外支出', direction: '付', subject: '6711', report: 'other_loss', sort: 7 },
  { name: '暂收款项', group: '暂收款项', direction: '收', subject: '2203', report: null, sort: 8 },
  { name: '暂付款项', group: '暂付款项', direction: '付', subject: '1221', report: null, sort: 9 },
  { name: '长期资产', group: '长期资产', direction: '付', subject: '1601', report: null, sort: 10 },
  { name: '固定资产', parent: '长期资产', direction: '付', subject: '1601', report: null },
  { name: '资本', group: '资本', direction: '收', subject: '4001', report: null, sort: 11 },
  { name: '货物成本结转', group: '内部核算', direction: '付', subject: '6401', offset: '1405', report: 'cost', internal: 1, sort: 12 },
  { name: '存货组装拆卸', group: '内部核算', direction: '付', subject: '1405', offset: '1405', report: null, internal: 1, sort: 13 },
  { name: '账户互转', group: '内部核算', direction: '转账', subject: '1002', offset: '1002', report: null, internal: 1, sort: 14 },
];

const ACCOUNTS = [
  ['工商银行8830', '银行存款', '一般户', '1002'],
  ['招商银行1069', '银行存款', '一般户', '1002'],
  ['企业支付宝', '其他货币资金', '支付宝', '1012'],
  ['微信账户', '其他货币资金', '微信', '1012'],
  ['现金', '库存现金', '现金', '1001'],
  ['员工备用金账户', '其他货币资金', '其他', '1012'],
];

function seed() {
  insert('account_books', {
    name: '智能版演示账套(含演示数据)',
    company: '小番游乐场有限公司',
    tax_no: '91310000MA1K35XXXX',
    start_month: '2026-01',
  });
  insert('users', { name: '小番游乐场用户', phone: '13800000000', role: '超级管理员' });

  const subjectId = {};
  for (const [code, name, category, direction, report] of SUBJECTS) {
    subjectId[code] = insert('subjects', { code, name, category, direction, report_line: report });
  }

  for (const [name, nature, tag, code] of ACCOUNTS) {
    insert('accounts', { name, nature, tag, subject_id: subjectId[code] });
  }

  insert('counterparties', { name: '小番游乐场用户', type: '客户', contact: '王经理', phone: '13900001111' });
  insert('counterparties', { name: '××物流有限公司', type: '供应商', contact: '李经理', phone: '13900002222' });
  insert('counterparties', { name: '××电器有限公司', type: '供应商', contact: '张经理', phone: '13900003333' });
  insert('counterparties', { name: '美团平台', type: '客户', contact: '渠道部', phone: '13900004444' });
  insert('counterparties', { name: '大华集团', type: '客户', contact: '刘总', phone: '13900005555' });

  insert('projects', { name: '旗舰店', note: '线下旗舰门店' });
  insert('projects', { name: '自营店', note: '自营门店' });
  insert('projects', { name: '卖场店', note: '卖场渠道' });
  insert('projects', { name: '总部', note: '总部管理' });

  const wh = insert('warehouses', { name: '总部仓库' });
  insert('inventories', { name: '厨房智能两件套（3系列-油烟机&燃气灶）', spec: '3系列', unit: '套', warehouse_id: wh });
  insert('inventories', { name: '厨房智能两件套（1系列-消毒柜&油烟机）', spec: '1系列', unit: '套', warehouse_id: wh });
  insert('inventories', { name: '智能净水器 Pro', spec: 'Pro', unit: '台', warehouse_id: wh });

  const catId = {};
  for (const c of CATEGORIES) {
    catId[c.name] = insert('categories', {
      name: c.name,
      group_name: c.group || null,
      direction: c.direction,
      parent_id: c.parent ? catId[c.parent] : null,
      subject_id: c.subject ? subjectId[c.subject] : null,
      offset_subject_id: c.offset ? subjectId[c.offset] : null,
      report_line: c.report || null,
      internal: c.internal || 0,
      sort: c.sort || 0,
    });
  }

  const accountId = {};
  for (const a of all('SELECT id, name FROM accounts')) accountId[a.name] = a.id;
  db.exec(`UPDATE categories SET group_name = (SELECT p.name FROM categories p WHERE p.id = categories.parent_id) WHERE parent_id IS NOT NULL AND group_name IS NULL;`);
  const cpId = {};
  for (const c of all('SELECT id, name FROM counterparties')) cpId[c.name] = c.id;
  const prjId = {};
  for (const p of all('SELECT id, name FROM projects')) prjId[p.name] = p.id;
  const invId = {};
  for (const i of all('SELECT id, name FROM inventories')) invId[i.name] = i.id;

  const flows = [
    ['2026-11-21', 30, '销售收入', '1.11-1.21自营店销售收入', '收款', 279100, null, '小番游乐场用户', '自营店', null, '收款', 0, 0],
    ['2026-11-21', 29, '销售收入', '1.11-1.21自营店销售收入', '收款', 267100, null, '小番游乐场用户', '自营店', null, '收款', 0, 0],
    ['2026-11-21', 28, '销售收入', '1.11-1.21旗舰店销售收入', '收款', 235900, null, '小番游乐场用户', '旗舰店', null, '收款', 0, 0],
    ['2026-11-15', 27, '固定资产', '购进展台(账户:工商银行8830)', '付款', 3750, null, null, null, null, null, 0, 0],
    ['2026-11-15', 26, '财务费用', '收到银行结息(账户:工商银行8830)', '收款', 1740.79, '工商银行8830', null, '总部', null, null, 1, 1],
    ['2026-11-14', 31, '商品采购', '1月中旬补货(往来单位:××物流有限公司)', '付款', 6000, null, '××物流有限公司', '旗舰店', null, '付款', 0, 0],
    ['2026-11-13', 25, '公关招待费用', '接待品牌华东区领导(账户:工商银行8830)', '付款', 20000, null, null, '总部', null, null, 0, 0],
    ['2026-11-13', 24, '商品采购', '残次品退回，金额抵扣下次进货款(往来单位:××电器有限公司)', '付款', -2800, null, '××电器有限公司', '旗舰店', null, '退款', 0, 0],
    ['2026-11-13', 23, '工资薪金', '发放12月旗舰店员工绩效工资(账户:工商银行8830)', '付款', 58500, null, null, '旗舰店', null, null, 0, 0],
    ['2026-11-13', 21, '工资薪金', '发放12月自营店员工绩效工资(账户:工商银行8830)', '付款', 30000, null, null, '自营店', null, null, 0, 0],
    ['2026-11-13', 19, '工资薪金', '发放12月旗舰店员工绩效工资(账户:工商银行8830)', '付款', 52000, null, null, '旗舰店', null, null, 0, 0],
    ['2026-11-12', 22, '工资薪金', '发放12月卖场店员工基础工资(账户:工商银行8830)', '付款', 50000, null, null, '卖场店', null, null, 0, 0],
    ['2026-11-12', 20, '工资薪金', '发放12月自营店员工基础工资(账户:工商银行8830)', '付款', 40000, null, null, '自营店', null, null, 0, 0],
    ['2026-11-12', 18, '工资薪金', '发放12月旗舰店员工基础工资(账户:工商银行8830)', '付款', 36000, null, null, '旗舰店', null, null, 0, 0],
    ['2026-11-12', 17, '货物成本结转', '赠送集团客户体验机(存货:厨房智能两件套（3系列-油烟机&燃气灶） 仓库:总部仓库 5 套)', '付款', 9000, null, null, '旗舰店', '厨房智能两件套（3系列-油烟机&燃气灶）', null, 1, 1],
    ['2026-11-11', 16, '货物成本结转', '1.1-1.10确认销售的货物成本(存货:厨房智能两件套（1系列-消毒柜&油烟机） 仓库:总部仓库 7.0000 套 项目:旗舰店)', '付款', 6300, null, null, '旗舰店', '厨房智能两件套（1系列-消毒柜&油烟机）', null, 1, 1],
    ['2026-11-11', 15, '存货组装拆卸', '组合销售的货物做组装处理(存货:厨房智能两件套（1系列-消毒柜&油烟机）;仓库:总部仓库;22套)', '付款', 19800, null, null, '总部', '厨房智能两件套（1系列-消毒柜&油烟机）', null, 1, 1],
    ['2026-11-10', 14, '销售收入', '1.1-1.10卖场店销售收入(账户:工商银行8830)', '收款', 201300, null, '小番游乐场用户', '卖场店', null, '收款', 0, 0],
    ['2026-11-10', 14, '销售收入', '1.1-1.10卖场店销售收入(账户:招商银行1069)', '收款', 22200, null, '小番游乐场用户', '卖场店', null, '收款', 0, 0],
    ['2026-11-10', 14, '销售收入', '1.1-1.10卖场店销售收入(账户:微信账户)', '收款', 39000, null, '小番游乐场用户', '卖场店', null, '收款', 0, 0],
    ['2026-11-09', 13, '销售收入', '1.1-1.10旗舰店销售收入(账户:工商银行8830)', '收款', 98600, null, '小番游乐场用户', '旗舰店', null, '收款', 1, 1],
    ['2026-11-08', 12, '办公费用', '采购办公用品及打印耗材', '付款', 3200, '工商银行8830', null, '总部', null, null, 1, 1],
    ['2026-11-07', 11, '经营租金', '10月门店租金(旗舰店)', '付款', 45000, '工商银行8830', null, '旗舰店', null, null, 1, 1],
    ['2026-11-06', 10, '广告宣传费用', '抖音本地生活推广费', '付款', 12000, '工商银行8830', null, '卖场店', null, null, 1, 1],
    ['2026-11-05', 9, '销售收入', '1.1-1.10自营店销售收入(账户:招商银行1069)', '收款', 156800, '招商银行1069', '小番游乐场用户', '自营店', null, '收款', 1, 1],
    ['2026-11-04', 8, '差旅费用', '出差杭州机票及住宿', '付款', 4600, '工商银行8830', null, '总部', null, null, 1, 1],
    ['2026-11-03', 7, '商品采购', '11月首批进货(往来单位:××物流有限公司)', '付款', 126000, '招商银行1069', '××物流有限公司', '旗舰店', null, '付款', 1, 1],
    ['2026-11-02', 6, '销售收入', '1.1-1.10卖场店销售收入(账户:微信账户)', '收款', 88200, '微信账户', '小番游乐场用户', '卖场店', null, '收款', 1, 1],
    ['2026-11-01', 5, '资本', '股东投入注册资本', '收款', 500000, '工商银行8830', null, '总部', null, null, 1, 1],
    ['2026-11-01', 4, '物业相关费用', '门店物业管理费及押金', '付款', 18000, '工商银行8830', null, '旗舰店', null, null, 1, 1],
  ];

  for (const [date, no, cat, summary, type, amount, account, cp, project, inv, settleType, settled, audited] of flows) {
    const id = insert('flows', {
      date,
      no,
      category_id: catId[cat],
      summary,
      type,
      amount,
      account_id: account ? accountId[account] : null,
      counterparty_id: cp ? cpId[cp] : null,
      project_id: project ? prjId[project] : null,
      inventory_id: inv ? invId[inv] : null,
      settle_type: settleType,
      settled,
      status: audited ? '已审核' : '未审核',
      auditor: audited ? '小番游乐场用户' : null,
      audited_at: audited ? `${date} 10:00:00` : null,
    });
    if (audited) createVoucher(one('SELECT * FROM flows WHERE id = ?', id));
  }

  insert('logs', { text: '账套「智能版演示账套」初始化完成' });
}

// —— 科目取值辅助 ——
function accountSubject(accountId) {
  const a = accountId ? one('SELECT subject_id FROM accounts WHERE id = ?', accountId) : null;
  return a?.subject_id || one("SELECT id FROM subjects WHERE code = '1002'").id;
}

function createVoucher(flow) {
  const cat = one('SELECT * FROM categories WHERE id = ?', flow.category_id);
  const accSubject = flow.account_id
    ? accountSubject(flow.account_id)
    : one("SELECT id FROM subjects WHERE code = ?", flow.type === '收款' ? '1122' : '2202').id;
  let debitSubject = cat?.subject_id;
  let creditSubject = cat?.subject_id;
  if (flow.type === '收款') {
    debitSubject = accSubject;
    creditSubject = cat?.subject_id;
  } else if (flow.type === '付款') {
    debitSubject = cat?.subject_id;
    creditSubject = accSubject;
  } else {
    debitSubject = cat?.subject_id;
    creditSubject = cat?.offset_subject_id || cat?.subject_id;
  }
  const no = (one('SELECT COALESCE(MAX(no),0) AS n FROM vouchers')?.n || 0) + 1;
  const vid = insert('vouchers', {
    date: flow.date,
    no,
    summary: flow.summary,
    source_flow_no: flow.no,
    status: '已保存',
  });
  insert('voucher_items', { voucher_id: vid, summary: flow.summary, subject_id: debitSubject, debit: Math.abs(flow.amount), credit: 0 });
  insert('voucher_items', { voucher_id: vid, summary: flow.summary, subject_id: creditSubject, debit: 0, credit: Math.abs(flow.amount) });
  return vid;
}

async function init() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(path.dirname(require.resolve('sql.js')), file),
  });
  if (dbPath && fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
    sqlite = new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)));
    sqlite.run('PRAGMA foreign_keys = ON;');
  } else {
    sqlite = new SQL.Database();
    sqlite.run('PRAGMA foreign_keys = ON;');
    sqlite.exec(SCHEMA);
    if (empty()) seed();
    flushPersist();
  }
  return { dbPath };
}

process.on('exit', flushPersist);

module.exports = { init, db, one, all, insert, createVoucher, seed, dbPath, flushPersist };
