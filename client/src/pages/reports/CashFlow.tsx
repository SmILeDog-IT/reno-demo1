import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Spin, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';

interface CashFlowRow {
  name: string;
  direction: string;
  amount: number;
  count: number;
}

interface CashFlowData {
  period: string;
  rows: CashFlowRow[];
  inflow: number;
  outflow: number;
  net: number;
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

export default function CashFlow() {
  const { data } = useBootstrap();
  const [period, setPeriod] = useState(data?.period || '2026-11');
  const [result, setResult] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.period) setPeriod(data.period);
  }, [data?.period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<CashFlowData>('/reports/cash-flow', { period });
      setResult(res);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = result?.rows || [];
  const inflowRows = rows.filter((row) => row.direction === '收');
  const outflowRows = rows.filter((row) => row.direction !== '收');

  const handleExport = () => {
    exportCsv(`现金流量表_${period}.csv`, [
      ['项目', '方向', '金额', '笔数'],
      ...inflowRows.map((row) => [row.name, '收', fmt(row.amount), row.count]),
      ...outflowRows.map((row) => [row.name, row.direction, fmt(row.amount), row.count]),
      ['现金流入小计', '收', fmt(result?.inflow || 0), ''],
      ['现金流出小计', '付', fmt(result?.outflow || 0), ''],
      ['现金净流量', '', fmt(result?.net || 0), ''],
    ]);
  };

  const renderRow = (row: CashFlowRow) => (
    <tr key={`${row.direction}-${row.name}`}>
      <td>{row.name}</td>
      <td className="num">
        <span className="money">{fmt(row.amount)}</span>
      </td>
      <td className="num">{row.count} 笔</td>
    </tr>
  );

  return (
    <div className="page">
      <PageHeader
        title="现金流量表"
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
                <th style={{ width: '58%' }}>项目</th>
                <th>金额</th>
                <th style={{ width: 110 }}>笔数</th>
              </tr>
            </thead>
            <tbody>
              <tr className="group">
                <td colSpan={3}>一、经营活动现金流入</td>
              </tr>
              {inflowRows.length ? (
                inflowRows.map(renderRow)
              ) : (
                <tr>
                  <td colSpan={3} className="muted" style={{ textAlign: 'center' }}>
                    暂无流入
                  </td>
                </tr>
              )}
              <tr className="group">
                <td colSpan={3}>二、经营活动现金流出</td>
              </tr>
              {outflowRows.length ? (
                outflowRows.map(renderRow)
              ) : (
                <tr>
                  <td colSpan={3} className="muted" style={{ textAlign: 'center' }}>
                    暂无流出
                  </td>
                </tr>
              )}
              <tr className="total">
                <td>现金流入小计</td>
                <td className="num">
                  <span className="money">{fmt(result?.inflow || 0)}</span>
                </td>
                <td className="num">{inflowRows.reduce((sum, row) => sum + row.count, 0)} 笔</td>
              </tr>
              <tr className="total">
                <td>现金流出小计</td>
                <td className="num">
                  <span className="money">{fmt(result?.outflow || 0)}</span>
                </td>
                <td className="num">{outflowRows.reduce((sum, row) => sum + row.count, 0)} 笔</td>
              </tr>
              <tr className="total">
                <td>现金净流量</td>
                <td className="num">
                  <span className="money" style={{ color: (result?.net || 0) < 0 ? '#c9372c' : undefined }}>
                    {fmt(result?.net || 0)}
                  </span>
                </td>
                <td className="num">—</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无现金流量数据" style={{ padding: '56px 0' }} />
        )}
      </Spin>
    </div>
  );
}
