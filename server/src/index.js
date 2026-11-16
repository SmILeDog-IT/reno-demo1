const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const { one, all, insert } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const currentPeriod = () => {
  const row = one('SELECT MAX(date) AS d FROM flows');
  return (row?.d || new Date().toISOString().slice(0, 10)).slice(0, 7);
};
const periodOf = (value) => {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value;
  return currentPeriod();
};
const log = (text) => insert('logs', { text });

/* ---------------- 基础数据 ---------------- */
function buildCategoryTree() {
  const rows = all('SELECT * FROM categories ORDER BY sort, id');
  const byId = new Map();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const tree = [];
  rows.forEach((r) => {
    const node = byId.get(r.id);
    if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).children.push(node);
    else tree.push(node);
  });
  return tree;
}

function subjectTree() {
  const rows = all('SELECT * FROM subjects ORDER BY code');
  const byId = new Map();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const tree = [];
  rows.forEach((r) => {
    if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).children.push(byId.get(r.id));
    else tree.push(byId.get(r.id));
  });
  return tree;
}

app.post('/api/login', (req, res) => {
  const user = one('SELECT * FROM users LIMIT 1');
  log(`${user?.name || '用户'} 登录`);
  res.json({ token: 'demo-token', user });
});

app.get('/api/meta', (req, res) => {
  const book = one('SELECT * FROM account_books LIMIT 1');
  const users = all('SELECT * FROM users');
  res.json({ book, users, project: '小番财务（仿）' });
});

app.get('/api/bootstrap', (req, res) => {
  const book = one('SELECT * FROM account_books LIMIT 1');
  res.json({
    book,
    users: all('SELECT * FROM users'),
    accounts: all('SELECT * FROM accounts ORDER BY id'),
    counterparties: all('SELECT * FROM counterparties ORDER BY id'),
    projects: all('SELECT * FROM projects ORDER BY id'),
    inventories: all('SELECT * FROM inventories ORDER BY id'),
    warehouses: all('SELECT * FROM warehouses ORDER BY id'),
    subjects: subjectTree(),
    categories: buildCategoryTree(),
    period: currentPeriod(),
  });
});

app.get('/api/dashboard', (req, res) => {
  const period = periodOf(req.query.period);
  const counts = {
    flows: one('SELECT COUNT(*) AS c FROM flows')?.c || 0,
    pending: one("SELECT COUNT(*) AS c FROM flows WHERE status = '未审核'")?.c || 0,
    audited: one("SELECT COUNT(*) AS c FROM flows WHERE status = '已审核'")?.c || 0,
    vouchers: one('SELECT COUNT(*) AS c FROM vouchers')?.c || 0,
    unsettled: one('SELECT COUNT(*) AS c FROM flows WHERE settled = 0 AND counterparty_id IS NOT NULL')?.c || 0,
  };
  const totals = one(
    `SELECT COALESCE(SUM(CASE WHEN type='收款' THEN amount ELSE 0 END),0) AS inflow,
            COALESCE(SUM(CASE WHEN type='付款' THEN amount ELSE 0 END),0) AS outflow
     FROM flows WHERE date LIKE ?`,
    `${period}%`
  );
  const logs = all('SELECT * FROM logs ORDER BY id DESC LIMIT 8');
  const pendingFlows = all(
    `SELECT f.id, f.date, f.no, c.name AS category, f.summary, f.amount, f.type
     FROM flows f JOIN categories c ON c.id = f.category_id
     WHERE f.status = '未审核' ORDER BY f.date DESC, f.no DESC LIMIT 6`
  );
  const balances = all(
    `SELECT a.name, a.nature,
      COALESCE(SUM(CASE WHEN f.type='收款' AND f.status='已审核' THEN f.amount ELSE 0 END),0) -
      COALESCE(SUM(CASE WHEN f.type='付款' AND f.status='已审核' THEN f.amount ELSE 0 END),0) AS balance
     FROM accounts a LEFT JOIN flows f ON f.account_id = a.id GROUP BY a.id ORDER BY a.id`
  );
  res.json({ period, counts, totals: { inflow: r2(totals.inflow), outflow: r2(totals.outflow) }, logs, pendingFlows, balances });
});

/* ---------------- 流水 ---------------- */
const flowSelect = `
  SELECT f.*, c.name AS category_name, c.group_name, c.report_line, c.direction AS category_direction,
         a.name AS account_name, cp.name AS counterparty_name, p.name AS project_name,
         i.name AS inventory_name
  FROM flows f
  LEFT JOIN categories c ON c.id = f.category_id
  LEFT JOIN accounts a ON a.id = f.account_id
  LEFT JOIN counterparties cp ON cp.id = f.counterparty_id
  LEFT JOIN projects p ON p.id = f.project_id
  LEFT JOIN inventories i ON i.id = f.inventory_id
`;

function categoryIds(categoryId) {
  if (!categoryId) return null;
  const rows = all('SELECT id, parent_id FROM categories');
  const result = new Set([Number(categoryId)]);
  let changed = true;
  while (changed) {
    changed = false;
    rows.forEach((r) => {
      if (r.parent_id && result.has(r.parent_id) && !result.has(r.id)) {
        result.add(r.id);
        changed = true;
      }
    });
  }
  return Array.from(result);
}

app.get('/api/flows', (req, res) => {
  const { tab = 'all', keyword = '', status, settle } = req.query;
  const period = req.query.period ? periodOf(req.query.period) : '';
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.max(1, Number(req.query.pageSize) || 100);
  const where = [];
  const params = [];
  if (period) {
    where.push('f.date LIKE ?');
    params.push(`${period}%`);
  }
  if (tab === 'pending' || status === '未审核') where.push("f.status = '未审核'");
  if (tab === 'pending' && settle === '1') where.push('f.settled = 0 AND f.counterparty_id IS NOT NULL');
  if (settle === '0') where.push('f.settled = 0');
  if (keyword) {
    where.push('(f.summary LIKE ? OR CAST(f.no AS TEXT) LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (req.query.categoryId) {
    const ids = categoryIds(req.query.categoryId);
    where.push(`f.category_id IN (${ids.join(',')})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = one(`SELECT COUNT(*) AS c FROM flows f ${whereSql}`, ...params)?.c || 0;
  const sum = one(
    `SELECT COALESCE(SUM(CASE WHEN f.type='收款' THEN f.amount ELSE 0 END),0) AS debit,
            COALESCE(SUM(CASE WHEN f.type='付款' THEN f.amount ELSE 0 END),0) AS credit
     FROM flows f ${whereSql}`,
    ...params
  );
  const rows = all(
    `${flowSelect} ${whereSql} ORDER BY f.date DESC, f.no DESC, f.id ASC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize
  );
  res.json({ rows, total, page, pageSize, summary: { debit: r2(sum.debit), credit: r2(sum.credit) } });
});

app.post('/api/flows', (req, res) => {
  const { date, categoryId, summary = '', lines } = req.body || {};
  if (!date || !categoryId) return res.status(400).json({ message: '日期和流水类别必填' });
  const list = Array.isArray(lines) && lines.length ? lines : [req.body];
  const month = date.slice(0, 7);
  const maxNo = one('SELECT COALESCE(MAX(no),0) AS n FROM flows WHERE date LIKE ?', `${month}%`)?.n || 0;
  const no = maxNo + 1;
  const created = [];
  for (const line of list) {
    const amount = r2(line.amount);
    if (!amount) continue;
    const id = insert('flows', {
      date,
      no,
      category_id: Number(categoryId),
      summary: line.summary || summary,
      type: line.type || '付款',
      amount,
      account_id: line.accountId || null,
      counterparty_id: line.counterpartyId || null,
      project_id: line.projectId || null,
      inventory_id: line.inventoryId || null,
      quantity: line.quantity || null,
      settle_type: line.settleType || (line.counterpartyId ? (line.type === '收款' ? '收款' : '付款') : null),
      settled: 0,
      status: '未审核',
    });
    created.push(one(`${flowSelect} WHERE f.id = ?`, id));
  }
  if (!created.length) return res.status(400).json({ message: '请至少填写一条金额' });
  log(`录入流水 ${no} 号，共 ${created.length} 条`);
  res.json({ no, rows: created });
});

app.post('/api/flows/audit', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: '请选择要审核的流水' });
  const { db, createVoucher } = require('./db');
  let audited = 0;
  for (const id of ids) {
    const flow = one('SELECT * FROM flows WHERE id = ?', id);
    if (!flow || flow.status === '已审核') continue;
    db.prepare("UPDATE flows SET status='已审核', auditor='小番游乐场用户', audited_at=datetime('now','localtime') WHERE id=?").run(id);
    createVoucher(flow);
    audited += 1;
  }
  log(`审核流水 ${audited} 条`);
  res.json({ audited });
});

app.post('/api/flows/settle', (req, res) => {
  const { ids, settleType } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: '请选择要核销的流水' });
  const { db } = require('./db');
  for (const id of ids) {
    db.prepare('UPDATE flows SET settled=1, settle_type=? WHERE id=?').run(settleType || '收款', id);
  }
  log(`收付核销 ${ids.length} 条`);
  res.json({ settled: ids.length });
});

app.delete('/api/flows', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: '请选择要删除的流水' });
  const { db } = require('./db');
  let deleted = 0;
  for (const id of ids) {
    const flow = one('SELECT * FROM flows WHERE id = ?', id);
    if (!flow) continue;
    if (flow.status === '已审核') continue;
    db.prepare('DELETE FROM flows WHERE id=?').run(id);
    deleted += 1;
  }
  log(`删除流水 ${deleted} 条（已审核流水不可删除）`);
  res.json({ deleted });
});

/* ---------------- 凭证 ---------------- */
app.get('/api/vouchers', (req, res) => {
  const period = req.query.period ? periodOf(req.query.period) : '';
  const where = period ? 'WHERE date LIKE ?' : '';
  const params = period ? [`${period}%`] : [];
  const vouchers = all(`SELECT * FROM vouchers ${where} ORDER BY date DESC, no DESC`, ...params);
  vouchers.forEach((v) => {
    v.items = all(
      `SELECT vi.*, s.code AS subject_code, s.name AS subject_name FROM voucher_items vi
       JOIN subjects s ON s.id = vi.subject_id WHERE vi.voucher_id = ?`,
      v.id
    );
    v.debit = r2(v.items.reduce((s, i) => s + i.debit, 0));
    v.credit = r2(v.items.reduce((s, i) => s + i.credit, 0));
  });
  res.json({ rows: vouchers, total: vouchers.length });
});

app.delete('/api/vouchers', (req, res) => {
  const { ids } = req.body || {};
  const { db } = require('./db');
  for (const id of ids || []) {
    db.prepare('DELETE FROM voucher_items WHERE voucher_id=?').run(id);
    db.prepare('DELETE FROM vouchers WHERE id=?').run(id);
  }
  res.json({ deleted: (ids || []).length });
});

/* ---------------- 记账引擎 ---------------- */
function cashSubjectId(flow) {
  if (flow.account_id) {
    const a = one('SELECT subject_id FROM accounts WHERE id = ?', flow.account_id);
    if (a?.subject_id) return a.subject_id;
  }
  const code = flow.type === '收款' ? '1122' : '2202';
  return one('SELECT id FROM subjects WHERE code = ?', code)?.id || 0;
}

function entriesOf(flow, cat) {
  const subjectId = cat?.subject_id;
  if (!subjectId) return [];
  if (flow.type === '收款') return [{ subjectId: cashSubjectId(flow), debit: Math.abs(flow.amount), credit: 0 }, { subjectId, debit: 0, credit: Math.abs(flow.amount) }];
  if (flow.type === '付款') return [{ subjectId, debit: Math.abs(flow.amount), credit: 0 }, { subjectId: cashSubjectId(flow), debit: 0, credit: Math.abs(flow.amount) }];
  const offset = cat.offset_subject_id || subjectId;
  return [{ subjectId, debit: Math.abs(flow.amount), credit: 0 }, { subjectId: offset, debit: 0, credit: Math.abs(flow.amount) }];
}

function auditedFlows(period) {
  const where = ["f.status = '已审核'"];
  const params = [];
  if (period) {
    where.push('f.date LIKE ?');
    params.push(`${period}%`);
  }
  return all(
    `SELECT f.*, c.name AS category_name, c.group_name, c.report_line, c.subject_id, c.offset_subject_id
     FROM flows f JOIN categories c ON c.id = f.category_id
     WHERE ${where.join(' AND ')} ORDER BY f.date, f.no, f.id`,
    ...params
  );
}

function sumByReportLine(period) {
  const rows = all(
    `SELECT c.report_line AS line,
            COALESCE(SUM(CASE
              WHEN c.report_line IN ('revenue','other_income')
                THEN CASE WHEN f.type='收款' THEN f.amount ELSE -f.amount END
              ELSE CASE WHEN f.type='付款' THEN f.amount ELSE -f.amount END
            END),0) AS amount
     FROM flows f JOIN categories c ON c.id = f.category_id
     WHERE f.status='已审核' AND f.date LIKE ? AND c.report_line IS NOT NULL
     GROUP BY c.report_line`,
    `${period}%`
  );
  const map = {};
  rows.forEach((r) => (map[r.line] = r.amount));
  return map;
}

/* ---------------- 报表 ---------------- */
app.get('/api/reports/profit', (req, res) => {
  const period = periodOf(req.query.period);
  const year = period.slice(0, 4);
  const build = (map) => {
    const revenue = r2(map.revenue || 0);
    const cost = r2(map.cost || 0);
    const expense = r2(map.expense || 0);
    const tax = r2(map.tax || 0);
    const otherIncome = r2(map.other_income || 0);
    const otherLoss = r2(map.other_loss || 0);
    const businessProfit = r2(revenue - cost - expense);
    const netProfit = r2(businessProfit + otherIncome - otherLoss - tax);
    const base = revenue || 1;
    const pct = (v) => r2((v / base) * 100);
    return [
      { name: '一、营业收入', value: revenue, ratio: pct(revenue), bold: true },
      { name: '减：营业成本', value: cost, ratio: pct(cost) },
      { name: '减：营业税金', value: 0, ratio: 0 },
      { name: '减：营业费用', value: expense, ratio: pct(expense) },
      { name: '二、业务利润', value: businessProfit, ratio: pct(businessProfit), bold: true },
      { name: '加：其他收益', value: otherIncome, ratio: pct(otherIncome) },
      { name: '减：其他损失', value: otherLoss, ratio: pct(otherLoss) },
      { name: '减：所得税费用', value: tax, ratio: pct(tax) },
      { name: '三、净利润', value: netProfit, ratio: pct(netProfit), bold: true },
    ];
  };
  const periodRows = build(sumByReportLine(period));
  const ytdRows = build(sumByReportLine(year));
  const rows = periodRows.map((row, i) => ({
    ...row,
    ytdValue: ytdRows[i].value,
    ytdRatio: ytdRows[i].ratio,
    diff: r2(row.ratio - ytdRows[i].ratio),
  }));
  res.json({ period, rows, updatedAt: new Date().toLocaleString('zh-CN') });
});

app.get('/api/reports/cash-flow', (req, res) => {
  const period = periodOf(req.query.period);
  const rows = all(
    `SELECT c.group_name AS name,
            CASE WHEN f.type='收款' THEN '收' ELSE '付' END AS direction,
            COALESCE(SUM(f.amount),0) AS amount, COUNT(*) AS count
     FROM flows f JOIN categories c ON c.id = f.category_id
     WHERE f.status='已审核' AND f.date LIKE ? AND c.internal = 0 AND f.account_id IS NOT NULL
     GROUP BY c.group_name, f.type ORDER BY 2 DESC, 1`,
    `${period}%`
  );
  const inflow = r2(rows.filter((r) => r.direction === '收').reduce((s, r) => s + r.amount, 0));
  const outflow = r2(rows.filter((r) => r.direction !== '收').reduce((s, r) => s + r.amount, 0));
  res.json({ period, rows, inflow, outflow, net: r2(inflow - outflow) });
});

app.get('/api/reports/balance-sheet', (req, res) => {
  const period = periodOf(req.query.period);
  const flows = auditedFlows(null).filter((f) => f.date <= `${period}-31`);
  const balances = {};
  flows.forEach((f) => {
    entriesOf(f, {
      subject_id: f.subject_id,
      offset_subject_id: f.offset_subject_id,
    }).forEach((e) => {
      balances[e.subjectId] = balances[e.subjectId] || { debit: 0, credit: 0 };
      balances[e.subjectId].debit += e.debit;
      balances[e.subjectId].credit += e.credit;
    });
  });
  const subjects = all('SELECT * FROM subjects');
  const balanceOf = (id) => {
    const b = balances[id] || { debit: 0, credit: 0 };
    return r2(b.debit - b.credit);
  };
  const assetSubjects = subjects.filter((s) => s.category === '资产');
  const liabilitySubjects = subjects.filter((s) => s.category === '负债');
  const equitySubjects = subjects.filter((s) => s.category === '权益');
  const assets = assetSubjects.map((s) => ({ name: s.name, amount: balanceOf(s.id) })).filter((x) => x.amount !== 0);
  const liabilities = liabilitySubjects.map((s) => ({ name: s.name, amount: r2(-balanceOf(s.id)) })).filter((x) => x.amount !== 0);
  const equity = equitySubjects.map((s) => ({ name: s.name, amount: r2(-balanceOf(s.id)) })).filter((x) => x.amount !== 0);
  const totalAssets = r2(assets.reduce((sum, x) => sum + x.amount, 0));
  const totalLiabilities = r2(liabilities.reduce((sum, x) => sum + x.amount, 0));
  const capital = r2(equity.filter((e) => e.name === '实收资本').reduce((sum, e) => sum + e.amount, 0));
  const retained = r2(totalAssets - totalLiabilities - capital);
  res.json({
    period,
    assets,
    liabilities,
    equity: [...equity.filter((e) => e.name !== '本年利润'), { name: '未分配利润', amount: retained }],
    totalAssets,
    totalLiabilities,
    totalEquity: r2(totalLiabilities + capital + retained),
  });
});

app.get('/api/reports/tax', (req, res) => {
  const period = periodOf(req.query.period);
  const rows = all(
    `SELECT c.name, c.direction, COALESCE(SUM(f.amount),0) AS amount, COUNT(*) AS count
     FROM flows f JOIN categories c ON c.id = f.category_id
     WHERE f.status='已审核' AND f.date LIKE ? AND (c.report_line='tax' OR c.name LIKE '%税%')
     GROUP BY c.id ORDER BY c.name`,
    `${period}%`
  );
  res.json({ period, rows });
});

app.get('/api/reports/project-profit', (req, res) => {
  const period = periodOf(req.query.period);
  const rows = all(
    `SELECT COALESCE(p.name,'未分配项目') AS name,
       COALESCE(SUM(CASE WHEN c.report_line='revenue' THEN f.amount ELSE 0 END),0) AS revenue,
       COALESCE(SUM(CASE WHEN c.report_line='cost' THEN f.amount ELSE 0 END),0) AS cost,
       COALESCE(SUM(CASE WHEN c.report_line='expense' THEN f.amount ELSE 0 END),0) AS expense
     FROM flows f JOIN categories c ON c.id=f.category_id LEFT JOIN projects p ON p.id=f.project_id
     WHERE f.status='已审核' AND f.date LIKE ? GROUP BY p.id ORDER BY p.id`,
    `${period}%`
  );
  res.json({
    period,
    rows: rows.map((r) => ({ ...r, profit: r2(r.revenue - r.cost - r.expense) })),
  });
});

/* ---------------- 余额表 ---------------- */
app.get('/api/balances/accounts', (req, res) => {
  const period = periodOf(req.query.period);
  const rows = all('SELECT * FROM accounts ORDER BY id').map((a) => {
    const opening = one(
      `SELECT COALESCE(SUM(CASE WHEN type='收款' THEN amount ELSE -amount END),0) AS v
       FROM flows WHERE status='已审核' AND account_id=? AND date < ?`,
      a.id,
      `${period}-01`
    )?.v;
    const cur = one(
      `SELECT COALESCE(SUM(CASE WHEN type='收款' THEN amount ELSE 0 END),0) AS debit,
              COALESCE(SUM(CASE WHEN type='付款' THEN amount ELSE 0 END),0) AS credit
       FROM flows WHERE status='已审核' AND account_id=? AND date LIKE ?`,
      a.id,
      `${period}%`
    );
    return {
      name: a.name,
      nature: a.nature,
      tag: a.tag,
      opening: r2(opening),
      debit: r2(cur.debit),
      credit: r2(cur.credit),
      balance: r2(opening + cur.debit - cur.credit),
    };
  });
  res.json({ period, rows });
});

app.get('/api/balances/subjects', (req, res) => {
  const period = periodOf(req.query.period);
  const subjects = all('SELECT * FROM subjects ORDER BY code');
  const map = {};
  auditedFlows(period).forEach((f) => {
    entriesOf(f, { subject_id: f.subject_id, offset_subject_id: f.offset_subject_id }).forEach((e) => {
      map[e.subjectId] = map[e.subjectId] || { debit: 0, credit: 0 };
      map[e.subjectId].debit += e.debit;
      map[e.subjectId].credit += e.credit;
    });
  });
  const rows = subjects.map((s) => {
    const m = map[s.id] || { debit: 0, credit: 0 };
    const direction = m.debit >= m.credit ? '借' : '贷';
    return {
      code: s.code,
      name: s.name,
      category: s.category,
      direction: s.direction,
      debit: r2(m.debit),
      credit: r2(m.credit),
      balance: r2(Math.abs(m.debit - m.credit)),
      balanceDirection: direction,
    };
  });
  res.json({ period, rows });
});

app.get('/api/balances/dimension', (req, res) => {
  const period = periodOf(req.query.period);
  const dim = req.query.dim || 'counterparty';
  const config = {
    counterparty: { table: 'counterparties', join: 'JOIN counterparties x ON x.id = f.counterparty_id', name: 'x.name', type: 'x.type' },
    project: { table: 'projects', join: 'JOIN projects x ON x.id = f.project_id', name: 'x.name', type: null },
    inventory: { table: 'inventories', join: 'JOIN inventories x ON x.id = f.inventory_id', name: 'x.name', type: 'x.spec' },
    category: { table: 'categories', join: 'JOIN categories x ON x.id = f.category_id', name: 'x.name', type: 'x.group_name' },
  }[dim];
  if (!config) return res.status(400).json({ message: '未知维度' });
  const rows = all(
    `SELECT ${config.name} AS name, ${config.type ? `${config.type} AS type,` : ''}
      COALESCE(SUM(CASE WHEN f.type='收款' THEN f.amount ELSE 0 END),0) AS debit,
      COALESCE(SUM(CASE WHEN f.type='付款' THEN f.amount ELSE 0 END),0) AS credit,
      COUNT(*) AS count
     FROM flows f ${config.join}
     WHERE f.status='已审核' AND f.date LIKE ?
     GROUP BY x.id ORDER BY x.id`,
    `${period}%`
  );
  res.json({
    period,
    rows: rows.map((r) => ({ ...r, debit: r2(r.debit), credit: r2(r.credit), balance: r2(r.debit - r.credit) })),
  });
});

app.get('/api/balances/type', (req, res) => {
  const period = periodOf(req.query.period);
  const rows = all(
    `SELECT f.type AS name,
            COALESCE(SUM(CASE WHEN f.type='收款' THEN f.amount ELSE 0 END),0) AS debit,
            COALESCE(SUM(CASE WHEN f.type='付款' THEN f.amount ELSE 0 END),0) AS credit,
            COUNT(*) AS count
     FROM flows f WHERE f.status='已审核' AND f.date LIKE ?
     GROUP BY f.type ORDER BY f.type`,
    `${period}%`
  );
  res.json({
    period,
    rows: rows.map((r) => ({ ...r, debit: r2(r.debit), credit: r2(r.credit), balance: r2(r.debit - r.credit) })),
  });
});

/* ---------------- 明细账 ---------------- */
app.get('/api/ledger', (req, res) => {
  const period = periodOf(req.query.period);
  const dim = req.query.dim || 'account';
  const id = Number(req.query.id) || 0;
  const flows = auditedFlows(period);
  const rows = [];
  for (const f of flows) {
    let debit = 0;
    let credit = 0;
    let matched = false;
    if (dim === 'account') {
      if (f.account_id === id) {
        matched = true;
        if (f.type === '收款') debit = Math.abs(f.amount);
        else credit = Math.abs(f.amount);
      }
    } else if (dim === 'subject') {
      entriesOf(f, { subject_id: f.subject_id, offset_subject_id: f.offset_subject_id }).forEach((e) => {
        if (e.subjectId === id) {
          matched = true;
          debit += e.debit;
          credit += e.credit;
        }
      });
    } else if (dim === 'counterparty') {
      if (f.counterparty_id === id) {
        matched = true;
        if (f.type === '收款') debit = Math.abs(f.amount);
        else credit = Math.abs(f.amount);
      }
    } else if (dim === 'project') {
      if (f.project_id === id) {
        matched = true;
        if (f.type === '收款') debit = Math.abs(f.amount);
        else credit = Math.abs(f.amount);
      }
    } else if (dim === 'inventory') {
      if (f.inventory_id === id) {
        matched = true;
        if (f.type === '收款') debit = Math.abs(f.amount);
        else credit = Math.abs(f.amount);
      }
    } else if (dim === 'category') {
      if (f.category_id === id) {
        matched = true;
        if (f.type === '收款') debit = Math.abs(f.amount);
        else credit = Math.abs(f.amount);
      }
    } else if (dim === 'type') {
      if (f.type === String(req.query.id)) {
        matched = true;
        if (f.type === '收款') debit = Math.abs(f.amount);
        else credit = Math.abs(f.amount);
      }
    }
    if (matched) {
      rows.push({
        date: f.date,
        no: f.no,
        category: f.category_name,
        summary: f.summary,
        type: f.type,
        debit: r2(debit),
        credit: r2(credit),
        status: f.status,
      });
    }
  }
  let balance = 0;
  rows.forEach((r) => {
    balance = r2(balance + r.debit - r.credit);
    r.balance = balance;
  });
  const totals = {
    debit: r2(rows.reduce((s, r) => s + r.debit, 0)),
    credit: r2(rows.reduce((s, r) => s + r.credit, 0)),
  };
  res.json({ period, rows, totals });
});

/* ---------------- 设置 CRUD ---------------- */
const resources = {
  accounts: { table: 'accounts', fields: ['name', 'nature', 'tag', 'subject_id', 'enabled'], order: 'id' },
  counterparties: { table: 'counterparties', fields: ['name', 'type', 'contact', 'phone', 'note'], order: 'id' },
  projects: { table: 'projects', fields: ['name', 'note'], order: 'id' },
  inventories: { table: 'inventories', fields: ['name', 'spec', 'unit', 'warehouse_id'], order: 'id' },
  warehouses: { table: 'warehouses', fields: ['name'], order: 'id' },
  subjects: { table: 'subjects', fields: ['code', 'name', 'category', 'direction', 'parent_id', 'report_line', 'enabled'], order: 'code' },
  categories: { table: 'categories', fields: ['name', 'group_name', 'direction', 'parent_id', 'subject_id', 'offset_subject_id', 'report_line', 'internal', 'sort'], order: 'sort, id' },
};

for (const [name, cfg] of Object.entries(resources)) {
  app.get(`/api/settings/${name}`, (req, res) => {
    const rows = all(`SELECT * FROM ${cfg.table} ORDER BY ${cfg.order}`);
    if (name === 'accounts') {
      return res.json({ rows: rows.map((r) => ({ ...r, balance: 0 })) });
    }
    res.json({ rows });
  });
  app.post(`/api/settings/${name}`, (req, res) => {
    const data = {};
    cfg.fields.forEach((f) => {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    });
    if (!data.name && !data.code) return res.status(400).json({ message: '名称必填' });
    const id = insert(cfg.table, data);
    log(`新增${name}：${data.name || data.code}`);
    res.json(one(`SELECT * FROM ${cfg.table} WHERE id = ?`, id));
  });
  app.put(`/api/settings/${name}/:id`, (req, res) => {
    const data = {};
    cfg.fields.forEach((f) => {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    });
    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ message: '没有可更新字段' });
    const { db } = require('./db');
    db.prepare(`UPDATE ${cfg.table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`).run(...keys.map((k) => data[k]), Number(req.params.id));
    res.json(one(`SELECT * FROM ${cfg.table} WHERE id = ?`, Number(req.params.id)));
  });
  app.delete(`/api/settings/${name}/:id`, (req, res) => {
    const { db } = require('./db');
    try {
      db.prepare(`DELETE FROM ${cfg.table} WHERE id=?`).run(Number(req.params.id));
      log(`删除${name} id=${req.params.id}`);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ message: '该数据已被业务引用，无法删除' });
    }
  });
}

/* ---------------- 结账 ---------------- */
app.get('/api/closings', (req, res) => {
  res.json({ rows: all('SELECT * FROM closings ORDER BY period DESC'), current: currentPeriod() });
});

app.post('/api/closings', (req, res) => {
  const period = periodOf(req.body?.period);
  const pending = one("SELECT COUNT(*) AS c FROM flows WHERE status='未审核' AND date LIKE ?", `${period}%`)?.c || 0;
  if (pending > 0) return res.status(400).json({ message: `本期还有 ${pending} 条流水未审核，不能结账` });
  const exist = one('SELECT * FROM closings WHERE period = ?', period);
  if (exist) return res.status(400).json({ message: '该账期已结账' });
  insert('closings', { period, operator: '小番游乐场用户' });
  log(`完成 ${period} 结账`);
  res.json({ ok: true, period });
});

/* ---------------- 静态资源 ---------------- */
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || '服务器错误' });
});

const PORT = Number(process.env.PORT) || 4000;

require('./db')
  .init()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`小番财务（仿）服务已启动: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });
