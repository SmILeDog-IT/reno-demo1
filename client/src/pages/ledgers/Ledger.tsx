import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Empty, Select, Spin, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../../api';
import { flattenCategories, useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';
import type { Category, Subject } from '../../types';

type LedgerDim = 'account' | 'counterparty' | 'project' | 'inventory' | 'category' | 'type' | 'subject';

const DIM_TITLES: Record<LedgerDim, string> = {
  account: '账户明细表',
  counterparty: '往来明细表',
  project: '项目明细表',
  inventory: '存货明细表',
  category: '收支明细表',
  type: '类型明细表',
  subject: '科目明细表',
};

const DIMS: LedgerDim[] = ['account', 'counterparty', 'project', 'inventory', 'category', 'type', 'subject'];
const TYPES = ['收款', '付款', '退款', '转账'];

interface LedgerRow {
  date: string;
  no: number;
  category: string;
  summary: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

interface LedgerData {
  period: string;
  rows: LedgerRow[];
  totals: { debit: number; credit: number };
}

interface LedgerOption {
  value: string | number;
  label: string;
}

function flattenSubjects(list: Subject[]): Subject[] {
  const out: Subject[] = [];
  const walk = (items: Subject[]) => {
    items.forEach((item) => {
      out.push(item);
      if (item.children?.length) walk(item.children);
    });
  };
  walk(list || []);
  return out;
}

function exportCsv(filename: string, rows: (string | number)[][]) {
  const content = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Ledger() {
  const params = useParams<{ dim: string }>();
  const rawDim = params.dim || 'account';
  const dim: LedgerDim = DIMS.includes(rawDim as LedgerDim) ? (rawDim as LedgerDim) : 'account';

  const { data } = useBootstrap();
  const [period, setPeriod] = useState(data?.period || '2026-11');
  const [target, setTarget] = useState<string | number | undefined>();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.period) setPeriod(data.period);
  }, [data?.period]);

  const options = useMemo<LedgerOption[]>(() => {
    if (!data) return [];
    switch (dim) {
      case 'account':
        return data.accounts.map((item) => ({ value: item.id, label: item.name }));
      case 'counterparty':
        return data.counterparties.map((item) => ({ value: item.id, label: item.name }));
      case 'project':
        return data.projects.map((item) => ({ value: item.id, label: item.name }));
      case 'inventory':
        return data.inventories.map((item) => ({ value: item.id, label: item.name }));
      case 'category': {
        const flat = flattenCategories(data.categories) as Category[];
        return flat.filter((item) => !item.children?.length).map((item) => ({ value: item.id, label: item.name }));
      }
      case 'subject':
        return flattenSubjects(data.subjects).map((item) => ({ value: item.id, label: `${item.code} ${item.name}` }));
      case 'type':
        return TYPES.map((item) => ({ value: item, label: item }));
      default:
        return [];
    }
  }, [data, dim]);

  useEffect(() => {
    setTarget((current) => {
      if (!options.length) return undefined;
      const exists = options.some((option) => String(option.value) === String(current));
      return exists ? current : options[0].value;
    });
  }, [options]);

  const load = useCallback(async () => {
    if (target === undefined || target === '') {
      setRows([]);
      setTotals({ debit: 0, credit: 0 });
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<LedgerData>('/ledger', { dim, id: target, period });
      setRows(res.rows || []);
      setTotals(res.totals || { debit: 0, credit: 0 });
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dim, target, period]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedLabel = options.find((option) => String(option.value) === String(target))?.label || '—';
  const lastBalance = rows.length ? rows[rows.length - 1].balance : 0;

  const handleExport = () => {
    exportCsv(`${DIM_TITLES[dim]}_${selectedLabel}_${period}.csv`, [
      ['日期', '流水号', '类别', '摘要', '类型', '借方', '贷方', '余额'],
      ...rows.map((row) => [
        row.date,
        `${row.no} 号`,
        row.category,
        row.summary,
        row.type,
        fmt(row.debit),
        fmt(row.credit),
        fmt(row.balance),
      ]),
      ['合计', '', '', '', '', fmt(totals.debit), fmt(totals.credit), fmt(lastBalance)],
    ]);
  };

  return (
    <div className="page">
      <PageHeader
        title={DIM_TITLES[dim]}
        period={period}
        onPeriodChange={setPeriod}
        extra={
          <>
            <Button size="small" icon={<DownloadOutlined />} onClick={handleExport}>
              导 出
            </Button>
            <Button size="small" icon={<ReloadOutlined />} onClick={load}>
              刷 新
            </Button>
          </>
        }
      />

      <div className="report-toolbar">
        <span className="muted">目标</span>
        <Select
          showSearch
          optionFilterProp="label"
          size="small"
          style={{ width: 220 }}
          placeholder="请选择"
          value={target}
          options={options}
          onChange={(value) => setTarget(value)}
        />
        <span className="report-legend">
          当前：{selectedLabel} · 单位：元
        </span>
      </div>

      <Spin spinning={loading}>
        {rows.length ? (
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>日期</th>
                <th style={{ width: 80 }}>流水号</th>
                <th style={{ width: 110 }}>类别</th>
                <th>摘要</th>
                <th style={{ width: 70 }}>类型</th>
                <th style={{ width: 120 }}>借方</th>
                <th style={{ width: 120 }}>贷方</th>
                <th style={{ width: 130 }}>余额</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.date}-${row.no}-${index}`}>
                  <td>{row.date}</td>
                  <td>{row.no} 号</td>
                  <td style={{ color: '#3b6fd8' }}>{row.category}</td>
                  <td>{row.summary}</td>
                  <td style={{ textAlign: 'center' }}>{row.type}</td>
                  <td className="num">
                    <span className="money">{row.debit ? fmt(row.debit) : ''}</span>
                  </td>
                  <td className="num">
                    <span className="money">{row.credit ? fmt(row.credit) : ''}</span>
                  </td>
                  <td className="num">
                    <span className="money">{fmt(row.balance)}</span>
                  </td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={5}>合计</td>
                <td className="num">
                  <span className="money">{fmt(totals.debit)}</span>
                </td>
                <td className="num">
                  <span className="money">{fmt(totals.credit)}</span>
                </td>
                <td className="num">
                  <span className="money">{fmt(lastBalance)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细数据" style={{ padding: '56px 0' }} />
        )}
      </Spin>
    </div>
  );
}
