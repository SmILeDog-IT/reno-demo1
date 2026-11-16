import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmt } from '../api';
import { BizIcon } from '../components/BizIcon';

interface Dashboard {
  period: string;
  counts: { flows: number; pending: number; audited: number; vouchers: number; unsettled: number };
  totals: { inflow: number; outflow: number };
  logs: { id: number; time: string; text: string }[];
  pendingFlows: { id: number; date: string; no: number; category: string; summary: string; amount: number; type: string }[];
  balances: { name: string; nature: string; balance: number }[];
}

const QUICK_TILES = {
  entry: [
    { label: '录入流水', path: '/entry', icon: 'edit', color: 'blue' },
    { label: '流水管理', path: '/flows', icon: 'flow', color: 'blue' },
    { label: '凭证管理', path: '/vouchers', icon: 'voucher', color: 'orange' },
  ],
  report: [
    { label: '利润表', path: '/reports/profit', icon: 'profit', color: 'blue' },
    { label: '资产负债表', path: '/reports/balance-sheet', icon: 'asset', color: 'blue' },
    { label: '现金流量表', path: '/reports/cash-flow', icon: 'cash', color: 'blue' },
    { label: '应交税费表', path: '/reports/tax', icon: 'tax', color: 'blue' },
    { label: '阿米巴损益表', path: '/reports/project-profit', icon: 'project', color: 'blue' },
  ],
  balance: [
    { label: '账户余额表', path: '/balances/account', icon: 'account', color: 'blue' },
    { label: '往来余额表', path: '/balances/counterparty', icon: 'counterparty', color: 'blue' },
    { label: '项目余额表', path: '/balances/project', icon: 'project', color: 'blue' },
    { label: '存货余额表', path: '/balances/inventory', icon: 'inventory', color: 'blue' },
    { label: '收支余额表', path: '/balances/category', icon: 'category', color: 'blue' },
    { label: '类型余额表', path: '/balances/type', icon: 'category', color: 'blue' },
    { label: '科目余额表', path: '/balances/subject', icon: 'subject', color: 'orange' },
  ],
  ledger: [
    { label: '账户明细表', path: '/ledgers/account', icon: 'account', color: 'blue' },
    { label: '往来明细表', path: '/ledgers/counterparty', icon: 'counterparty', color: 'blue' },
    { label: '项目明细表', path: '/ledgers/project', icon: 'project', color: 'blue' },
    { label: '存货明细表', path: '/ledgers/inventory', icon: 'inventory', color: 'blue' },
    { label: '收支明细表', path: '/ledgers/category', icon: 'category', color: 'blue' },
    { label: '类型明细表', path: '/ledgers/type', icon: 'category', color: 'blue' },
    { label: '科目明细表', path: '/ledgers/subject', icon: 'subject', color: 'orange' },
  ],
};

export default function Home() {
  const navigate = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    api.get<Dashboard>('/dashboard').then(setData).catch(() => {});
  }, []);

  return (
    <div className="home">
      <div className="home-welcome">
        <div>
          <div className="home-hi">你好，小番游乐场用户</div>
          <div className="home-sub">本期（{data?.period || '—'}）经营概览</div>
        </div>
        <div className="home-kpis">
          <div className="kpi">
            <span>本期收款</span>
            <b className="kpi-in">+{fmt(data?.totals.inflow || 0)}</b>
          </div>
          <div className="kpi">
            <span>本期付款</span>
            <b className="kpi-out">-{fmt(data?.totals.outflow || 0)}</b>
          </div>
          <div className="kpi">
            <span>待审核</span>
            <b>{data?.counts.pending ?? 0} 条</b>
          </div>
          <div className="kpi">
            <span>待核销</span>
            <b>{data?.counts.unsettled ?? 0} 条</b>
          </div>
        </div>
      </div>

      <div className="home-notice">
        <span className="dot" />
        本账套数据仅供体验使用，次日自动清空且不能导出。当前版本：智能版演示账套（含演示数据）。
      </div>

      <div className="home-grid">
        <div className="home-col">
          <div className="home-card">
            <div className="home-card-head">
              <span>智能记账</span>
              <a onClick={() => navigate('/flows')}>全部流水</a>
            </div>
            <div className="tiles">
              {QUICK_TILES.entry.map((t) => (
                <div className="tile" key={t.path} onClick={() => navigate(t.path)}>
                  <div className={`tile-square ${t.color}`}>
                    <BizIcon name={t.icon} />
                  </div>
                  <div className="tile-label">{t.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="home-card">
            <div className="home-card-head">
              <span>财务动态</span>
              <a onClick={() => navigate('/flows')}>查看更多</a>
            </div>
            <div className="activity">
              {(data?.logs || []).slice(0, 6).map((l) => (
                <div className="activity-row" key={l.id}>
                  <span className="activity-time">{l.time}</span>
                  <span className="activity-text">{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="home-col">
          <div className="home-card">
            <div className="home-card-head">
              <span>报表</span>
              <a onClick={() => navigate('/reports/profit')}>查看利润表</a>
            </div>
            <div className="tiles">
              {QUICK_TILES.report.map((t) => (
                <div className="tile" key={t.path} onClick={() => navigate(t.path)}>
                  <div className={`tile-square ${t.color}`}>
                    <BizIcon name={t.icon} />
                  </div>
                  <div className="tile-label">{t.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="home-card">
            <div className="home-card-head">
              <span>余额表</span>
              <a onClick={() => navigate('/balances/account')}>账户余额</a>
            </div>
            <div className="tiles">
              {QUICK_TILES.balance.map((t) => (
                <div className="tile" key={t.path} onClick={() => navigate(t.path)}>
                  <div className={`tile-square ${t.color}`}>
                    <BizIcon name={t.icon} />
                  </div>
                  <div className="tile-label">{t.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="home-card">
            <div className="home-card-head">
              <span>明细表</span>
              <a onClick={() => navigate('/ledgers/account')}>账户明细</a>
            </div>
            <div className="tiles">
              {QUICK_TILES.ledger.map((t) => (
                <div className="tile" key={t.path} onClick={() => navigate(t.path)}>
                  <div className={`tile-square ${t.color}`}>
                    <BizIcon name={t.icon} />
                  </div>
                  <div className="tile-label">{t.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="home-card">
            <div className="home-card-head">
              <span>待审核流水</span>
              <a onClick={() => navigate('/flows')}>进入审核</a>
            </div>
            {(data?.pendingFlows || []).length ? (
              (data?.pendingFlows || []).map((f) => (
                <div className="pending-row" key={f.id} onClick={() => navigate('/flows')}>
                  <span className="pending-date">{f.date}</span>
                  <span className="pending-no">{f.no} 号</span>
                  <span className="pending-cat">{f.category}</span>
                  <span className="pending-summary">{f.summary}</span>
                  <span className={`pending-amount ${f.type === '收款' ? 'in' : 'out'}`}>
                    {f.type === '收款' ? '+' : '-'}
                    {fmt(f.amount)}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-tip">暂无待审核流水</div>
            )}
          </div>
        </div>
      </div>

      <div className="home-footer">xfannix 5.2.15（仿）</div>
    </div>
  );
}
