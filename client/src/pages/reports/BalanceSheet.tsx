import { useCallback, useEffect, useState } from 'react';
import { Button, Spin, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';

interface SheetItem {
  name: string;
  amount: number;
}

interface BalanceSheetData {
  period: string;
  assets: SheetItem[];
  liabilities: SheetItem[];
  equity: SheetItem[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
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

export default function BalanceSheet() {
  const { data } = useBootstrap();
  const [period, setPeriod] = useState(data?.period || '2026-11');
  const [sheet, setSheet] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.period) setPeriod(data.period);
  }, [data?.period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<BalanceSheetData>('/reports/balance-sheet', { period });
      setSheet(res);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const assets = sheet?.assets || [];
  const liabilities = sheet?.liabilities || [];
  const equity = sheet?.equity || [];
  const equityTotal = equity.reduce((sum, item) => sum + item.amount, 0);

  const handleExport = () => {
    exportCsv(`资产负债表_${period}.csv`, [
      ['资产', '期末余额'],
      ...assets.map((item) => [item.name, fmt(item.amount)]),
      ['资产合计', fmt(sheet?.totalAssets || 0)],
      [],
      ['负债和所有者权益', '期末余额'],
      ...liabilities.map((item) => [item.name, fmt(item.amount)]),
      ['负债合计', fmt(sheet?.totalLiabilities || 0)],
      ...equity.map((item) => [item.name, fmt(item.amount)]),
      ['所有者权益合计', fmt(equityTotal)],
      ['负债和所有者权益合计', fmt(sheet?.totalEquity || 0)],
    ]);
  };

  return (
    <div className="page">
      <PageHeader
        title="资产负债表"
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
        <span className="muted">{period ? `${period} 期末` : ''}</span>
        <span className="report-legend">单位：元</span>
      </div>

      <Spin spinning={loading}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '70%' }}>资产</th>
                <th>期末余额</th>
              </tr>
            </thead>
            <tbody>
              {assets.length ? (
                assets.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td className="num">
                      <span className="money">{fmt(item.amount)}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="muted" style={{ textAlign: 'center' }}>
                    暂无数据
                  </td>
                </tr>
              )}
              <tr className="total">
                <td>资产合计</td>
                <td className="num">
                  <span className="money">{fmt(sheet?.totalAssets || 0)}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '70%' }}>负债和所有者权益</th>
                <th>期末余额</th>
              </tr>
            </thead>
            <tbody>
              <tr className="group">
                <td colSpan={2}>负债</td>
              </tr>
              {liabilities.length ? (
                liabilities.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td className="num">
                      <span className="money">{fmt(item.amount)}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="muted" style={{ textAlign: 'center' }}>
                    暂无数据
                  </td>
                </tr>
              )}
              <tr className="total">
                <td>负债合计</td>
                <td className="num">
                  <span className="money">{fmt(sheet?.totalLiabilities || 0)}</span>
                </td>
              </tr>

              <tr className="group">
                <td colSpan={2}>所有者权益</td>
              </tr>
              {equity.length ? (
                equity.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td className="num">
                      <span className="money">{fmt(item.amount)}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="muted" style={{ textAlign: 'center' }}>
                    暂无数据
                  </td>
                </tr>
              )}
              <tr className="total">
                <td>权益合计</td>
                <td className="num">
                  <span className="money">{fmt(equityTotal)}</span>
                </td>
              </tr>
              <tr className="total">
                <td>负债和所有者权益合计</td>
                <td className="num">
                  <span className="money">{fmt(sheet?.totalEquity || 0)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Spin>
    </div>
  );
}
