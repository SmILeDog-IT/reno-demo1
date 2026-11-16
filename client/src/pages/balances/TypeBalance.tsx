import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Spin, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';

interface TypeBalanceRow {
  name: string;
  debit: number;
  credit: number;
  balance: number;
  count: number;
}

interface TypeBalanceData {
  period: string;
  rows: TypeBalanceRow[];
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

export default function TypeBalance() {
  const { data } = useBootstrap();
  const [period, setPeriod] = useState(data?.period || '2026-11');
  const [rows, setRows] = useState<TypeBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.period) setPeriod(data.period);
  }, [data?.period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<TypeBalanceData>('/balances/type', { period });
      setRows(res.rows || []);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

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
    exportCsv(`类型余额表_${period}.csv`, [
      ['流水类型', '本期收款', '本期付款', '余额', '笔数'],
      ...rows.map((row) => [row.name, fmt(row.debit), fmt(row.credit), fmt(row.balance), row.count]),
      ['合计', fmt(totals.debit), fmt(totals.credit), fmt(totals.balance), totals.count],
    ]);
  };

  return (
    <div className="page">
      <PageHeader
        title="类型余额表"
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
                <th style={{ width: '32%' }}>流水类型</th>
                <th>本期收款</th>
                <th>本期付款</th>
                <th>余额</th>
                <th style={{ width: 110 }}>笔数</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
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
                <td>合计</td>
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
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无类型余额数据" style={{ padding: '56px 0' }} />
        )}
      </Spin>
    </div>
  );
}
