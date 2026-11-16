import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Segmented, Spin, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';

interface ProfitRow {
  name: string;
  value: number;
  ratio: number;
  ytdValue: number;
  ytdRatio: number;
  diff: number;
  bold?: boolean;
}

interface ProfitResponse {
  period: string;
  rows: ProfitRow[];
  updatedAt?: string;
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

export default function ProfitReport() {
  const { data } = useBootstrap();
  const [period, setPeriod] = useState(data?.period || '2026-11');
  const [rows, setRows] = useState<ProfitRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('小番报表');
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (data?.period) setPeriod(data.period);
  }, [data?.period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ProfitResponse>('/reports/profit', { period });
      setRows(res.rows || []);
      setUpdatedAt(res.updatedAt || new Date().toLocaleString('zh-CN'));
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = () => {
    exportCsv(`利润表_${period}.csv`, [
      ['项目', '本年累计金额', '本年累计营收占比', '本期金额', '本期营收占比', '占比差值'],
      ...rows.map((row) => [
        row.name,
        fmt(row.ytdValue),
        `${row.ytdRatio.toFixed(2)}%`,
        fmt(row.value),
        `${row.ratio.toFixed(2)}%`,
        `${row.diff.toFixed(2)}%`,
      ]),
    ]);
  };

  return (
    <div className="page">
      <PageHeader
        title="利润表"
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
        <span className="muted">
          {period ? `${period.slice(0, 4)}年第${Number(period.slice(5, 7))}期` : ''}
        </span>
        <Segmented
          size="small"
          value={mode}
          options={['小番报表', '小企业报表']}
          onChange={(value) => {
            const next = String(value);
            setMode(next);
            message.info(`已切换为${next}口径（仅提示，数据不变）`);
          }}
        />
        <Button size="small" onClick={() => message.info('报表设置功能在演示版中未开放')}>
          设 置
        </Button>
        <Button size="small" onClick={() => setShowHint((v) => !v)}>
          测 算 一 下
        </Button>
        <span className="report-legend">单位：元</span>
      </div>

      {showHint ? (
        <div className="page-note">测算提示：业务利润 = 营业收入 - 营业成本 - 营业税金 - 营业费用；净利润 = 业务利润 + 其他收益 - 其他损失 - 所得税费用。</div>
      ) : null}

      <Spin spinning={loading}>
        {rows.length ? (
          <table className="report-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '30%' }}>
                  项目
                </th>
                <th colSpan={2}>本年累计数据</th>
                <th colSpan={2}>本期数据</th>
                <th rowSpan={2} style={{ width: 110 }}>
                  占比差值
                </th>
              </tr>
              <tr>
                <th>参考金额</th>
                <th>营收占比</th>
                <th>本期金额</th>
                <th>营收占比</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className={row.bold ? 'total' : undefined}>
                  <td>{row.name}</td>
                  <td className="num">
                    <span className="money">{fmt(row.ytdValue)}</span>
                  </td>
                  <td className="num">{row.ytdRatio.toFixed(2)}%</td>
                  <td className="num">
                    <span className="money">{fmt(row.value)}</span>
                  </td>
                  <td className="num">{row.ratio.toFixed(2)}%</td>
                  <td
                    className="num"
                    style={{ color: row.diff > 0 ? '#e5484d' : row.diff < 0 ? '#2f9e44' : '#999' }}
                  >
                    {row.diff > 0 ? '+' : ''}
                    {row.diff.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" style={{ padding: '56px 0' }} />
        )}
      </Spin>

      <div style={{ marginTop: 'auto', paddingTop: 12, color: '#a0a4aa', fontSize: 12 }}>
        更新时间：{updatedAt || '—'}
      </div>
    </div>
  );
}
