import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Spin, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';

interface ProjectProfitRow {
  name: string;
  revenue: number;
  cost: number;
  expense: number;
  profit: number;
}

interface ProjectProfitData {
  period: string;
  rows: ProjectProfitRow[];
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

export default function ProjectProfit() {
  const { data } = useBootstrap();
  const [period, setPeriod] = useState(data?.period || '2026-11');
  const [rows, setRows] = useState<ProjectProfitRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.period) setPeriod(data.period);
  }, [data?.period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ProjectProfitData>('/reports/project-profit', { period });
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
      revenue: acc.revenue + row.revenue,
      cost: acc.cost + row.cost,
      expense: acc.expense + row.expense,
      profit: acc.profit + row.profit,
    }),
    { revenue: 0, cost: 0, expense: 0, profit: 0 }
  );

  const handleExport = () => {
    exportCsv(`阿米巴损益表_${period}.csv`, [
      ['项目', '营业收入', '营业成本', '营业费用', '利润'],
      ...rows.map((row) => [row.name, fmt(row.revenue), fmt(row.cost), fmt(row.expense), fmt(row.profit)]),
      ['合计', fmt(totals.revenue), fmt(totals.cost), fmt(totals.expense), fmt(totals.profit)],
    ]);
  };

  return (
    <div className="page">
      <PageHeader
        title="阿米巴损益表"
        subtitle="按项目（门店）维度核算，未关联项目的流水归入「未分配项目」"
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

      <Spin spinning={loading}>
        {rows.length ? (
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>项目</th>
                <th>营业收入</th>
                <th>营业成本</th>
                <th>营业费用</th>
                <th>利润</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td className="num">
                    <span className="money">{fmt(row.revenue)}</span>
                  </td>
                  <td className="num">
                    <span className="money">{fmt(row.cost)}</span>
                  </td>
                  <td className="num">
                    <span className="money">{fmt(row.expense)}</span>
                  </td>
                  <td className="num">
                    <span className="money" style={{ color: row.profit < 0 ? '#c9372c' : undefined }}>
                      {fmt(row.profit)}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="total">
                <td>合计</td>
                <td className="num">
                  <span className="money">{fmt(totals.revenue)}</span>
                </td>
                <td className="num">
                  <span className="money">{fmt(totals.cost)}</span>
                </td>
                <td className="num">
                  <span className="money">{fmt(totals.expense)}</span>
                </td>
                <td className="num">
                  <span className="money" style={{ color: totals.profit < 0 ? '#c9372c' : undefined }}>
                    {fmt(totals.profit)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无项目损益数据" style={{ padding: '56px 0' }} />
        )}
      </Spin>
    </div>
  );
}
