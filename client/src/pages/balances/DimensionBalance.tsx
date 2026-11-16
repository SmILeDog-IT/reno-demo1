import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Empty, Spin, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';

type Dimension = 'counterparty' | 'project' | 'inventory' | 'category';

const DIM_TITLES: Record<Dimension, string> = {
  counterparty: '往来余额表',
  project: '项目余额表',
  inventory: '存货余额表',
  category: '收支余额表',
};

interface DimensionRow {
  name: string;
  type?: string;
  debit: number;
  credit: number;
  balance: number;
  count: number;
}

interface DimensionData {
  period: string;
  rows: DimensionRow[];
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

export default function DimensionBalance() {
  const params = useParams<{ dim: string }>();
  const dim: Dimension = (['counterparty', 'project', 'inventory', 'category'] as const).includes(
    (params.dim || 'counterparty') as Dimension
  )
    ? ((params.dim || 'counterparty') as Dimension)
    : 'counterparty';

  const { data } = useBootstrap();
  const [period, setPeriod] = useState(data?.period || '2026-11');
  const [rows, setRows] = useState<DimensionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.period) setPeriod(data.period);
  }, [data?.period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DimensionData>('/balances/dimension', { dim, period });
      setRows(res.rows || []);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dim, period]);

  useEffect(() => {
    load();
  }, [load]);

  const showType = rows.some((row) => row.type);
  const totals = rows.reduce(
    (acc, row) => ({
      debit: acc.debit + row.debit,
      credit: acc.credit + row.credit,
      balance: acc.balance + row.balance,
      count: acc.count + row.count,
    }),
    { debit: 0, credit: 0, balance: 0, count: 0 }
  );

  const handleExport = () => {
    exportCsv(`${DIM_TITLES[dim]}_${period}.csv`, [
      showType ? ['名称', '类型', '本期收款', '本期付款', '余额', '笔数'] : ['名称', '本期收款', '本期付款', '余额', '笔数'],
      ...rows.map((row) =>
        showType
          ? [row.name, row.type || '', fmt(row.debit), fmt(row.credit), fmt(row.balance), row.count]
          : [row.name, fmt(row.debit), fmt(row.credit), fmt(row.balance), row.count]
      ),
      showType
        ? ['合计', '', fmt(totals.debit), fmt(totals.credit), fmt(totals.balance), totals.count]
        : ['合计', fmt(totals.debit), fmt(totals.credit), fmt(totals.balance), totals.count],
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
        <span className="muted">{period ? `${period} 本期` : ''}</span>
        <span className="report-legend">单位：元</span>
      </div>

      <Spin spinning={loading}>
        {rows.length ? (
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>名称</th>
                {showType ? <th style={{ width: 130 }}>类型</th> : null}
                <th>本期收款</th>
                <th>本期付款</th>
                <th>余额</th>
                <th style={{ width: 100 }}>笔数</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  {showType ? <td style={{ textAlign: 'center' }}>{row.type || '—'}</td> : null}
                  <td className="num">
                    <span className="money">{fmt(row.debit)}</span>
                  </td>
                  <td className="num">
                    <span className="money">{fmt(row.credit)}</span>
                  </td>
                  <td className="num">
                    <span className="money">{fmt(row.balance)}</span>
                  </td>
                  <td className="num">{row.count} 笔</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={showType ? 2 : 1}>合计</td>
                <td className="num">
                  <span className="money">{fmt(totals.debit)}</span>
                </td>
                <td className="num">
                  <span className="money">{fmt(totals.credit)}</span>
                </td>
                <td className="num">
                  <span className="money">{fmt(totals.balance)}</span>
                </td>
                <td className="num">{totals.count} 笔</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无余额数据" style={{ padding: '56px 0' }} />
        )}
      </Spin>
    </div>
  );
}
