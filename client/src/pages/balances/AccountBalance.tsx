import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Spin, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';

interface AccountBalanceRow {
  name: string;
  nature: string;
  tag: string | null;
  opening: number;
  debit: number;
  credit: number;
  balance: number;
}

interface AccountBalanceData {
  period: string;
  rows: AccountBalanceRow[];
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

export default function AccountBalance() {
  const { data } = useBootstrap();
  const [period, setPeriod] = useState(data?.period || '2026-11');
  const [rows, setRows] = useState<AccountBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.period) setPeriod(data.period);
  }, [data?.period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AccountBalanceData>('/balances/accounts', { period });
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
      opening: acc.opening + row.opening,
      debit: acc.debit + row.debit,
      credit: acc.credit + row.credit,
      balance: acc.balance + row.balance,
    }),
    { opening: 0, debit: 0, credit: 0, balance: 0 }
  );

  const handleExport = () => {
    exportCsv(`账户余额表_${period}.csv`, [
      ['账户名称', '账户性质', '标签', '期初余额', '本期借方（收款）', '本期贷方（付款）', '期末余额'],
      ...rows.map((row) => [
        row.name,
        row.nature,
        row.tag || '',
        fmt(row.opening),
        fmt(row.debit),
        fmt(row.credit),
        fmt(row.balance),
      ]),
      ['合计', '', '', fmt(totals.opening), fmt(totals.debit), fmt(totals.credit), fmt(totals.balance)],
    ]);
  };

  return (
    <div className="page">
      <PageHeader
        title="账户余额表"
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
                <th style={{ width: '18%' }}>账户名称</th>
                <th style={{ width: 110 }}>账户性质</th>
                <th style={{ width: 110 }}>标签</th>
                <th>期初余额</th>
                <th>本期借方（收款）</th>
                <th>本期贷方（付款）</th>
                <th>期末余额</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td style={{ textAlign: 'center' }}>{row.nature}</td>
                  <td style={{ textAlign: 'center' }}>{row.tag || '—'}</td>
                  <td className="num">
                    <span className="money">{fmt(row.opening)}</span>
                  </td>
                  <td className="num">
                    <span className="money">{fmt(row.debit)}</span>
                  </td>
                  <td className="num">
                    <span className="money">{fmt(row.credit)}</span>
                  </td>
                  <td className="num">
                    <span className="money">{fmt(row.balance)}</span>
                  </td>
                </tr>
              ))}
              <tr className="total">
                <td>合计</td>
                <td />
                <td />
                <td className="num">
                  <span className="money">{fmt(totals.opening)}</span>
                </td>
                <td className="num">
                  <span className="money">{fmt(totals.debit)}</span>
                </td>
                <td className="num">
                  <span className="money">{fmt(totals.credit)}</span>
                </td>
                <td className="num">
                  <span className="money">{fmt(totals.balance)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无账户余额数据" style={{ padding: '56px 0' }} />
        )}
      </Spin>
    </div>
  );
}
