import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Spin, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';

interface TaxRow {
  name: string;
  direction: string;
  amount: number;
  count: number;
}

interface TaxData {
  period: string;
  rows: TaxRow[];
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

export default function TaxReport() {
  const { data } = useBootstrap();
  const [period, setPeriod] = useState(data?.period || '2026-11');
  const [rows, setRows] = useState<TaxRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.period) setPeriod(data.period);
  }, [data?.period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<TaxData>('/reports/tax', { period });
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

  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);

  const handleExport = () => {
    exportCsv(`应交税费表_${period}.csv`, [
      ['项目', '方向', '本期金额', '笔数'],
      ...rows.map((row) => [row.name, row.direction, fmt(row.amount), row.count]),
      ['合计', '', fmt(totalAmount), totalCount],
    ]);
  };

  return (
    <div className="page">
      <PageHeader
        title="应交税费表"
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

      <div className="page-note">演示账套仅统计税费类流水，实际申报请以税务口径为准。</div>

      <Spin spinning={loading}>
        {rows.length ? (
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '46%' }}>项目</th>
                <th style={{ width: 120 }}>方向</th>
                <th>本期金额</th>
                <th style={{ width: 110 }}>笔数</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td style={{ textAlign: 'center' }}>{row.direction}</td>
                  <td className="num">
                    <span className="money">{fmt(row.amount)}</span>
                  </td>
                  <td className="num">{row.count} 笔</td>
                </tr>
              ))}
              <tr className="total">
                <td>合计</td>
                <td />
                <td className="num">
                  <span className="money">{fmt(totalAmount)}</span>
                </td>
                <td className="num">{totalCount} 笔</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本期暂无税费类流水" style={{ padding: '56px 0' }} />
        )}
      </Spin>
    </div>
  );
}
