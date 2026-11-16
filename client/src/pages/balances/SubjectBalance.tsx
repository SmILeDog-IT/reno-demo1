import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Select, Spin, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';

interface SubjectBalanceRow {
  code: string;
  name: string;
  category: string;
  direction: string;
  debit: number;
  credit: number;
  balance: number;
  balanceDirection: string;
}

interface SubjectBalanceData {
  period: string;
  rows: SubjectBalanceRow[];
}

const CATEGORIES = ['全部', '资产', '负债', '权益', '收入', '成本', '费用'];

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

export default function SubjectBalance() {
  const { data } = useBootstrap();
  const [period, setPeriod] = useState(data?.period || '2026-11');
  const [category, setCategory] = useState('全部');
  const [rows, setRows] = useState<SubjectBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.period) setPeriod(data.period);
  }, [data?.period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<SubjectBalanceData>('/balances/subjects', { period });
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

  const displayRows = category === '全部' ? rows : rows.filter((row) => row.category === category);
  const totals = displayRows.reduce(
    (acc, row) => ({ debit: acc.debit + row.debit, credit: acc.credit + row.credit, balance: acc.balance + row.balance }),
    { debit: 0, credit: 0, balance: 0 }
  );

  const handleExport = () => {
    exportCsv(`科目余额表_${period}.csv`, [
      ['科目编码', '科目名称', '类别', '余额方向', '本期借方', '本期贷方', '期末余额', '余额方向'],
      ...displayRows.map((row) => [
        row.code,
        row.name,
        row.category,
        row.direction,
        fmt(row.debit),
        fmt(row.credit),
        fmt(row.balance),
        row.balanceDirection,
      ]),
      ['合计', '', '', '', fmt(totals.debit), fmt(totals.credit), fmt(totals.balance), ''],
    ]);
  };

  return (
    <div className="page">
      <PageHeader
        title="科目余额表"
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
        <span className="muted">类别</span>
        <Select
          size="small"
          style={{ width: 120 }}
          value={category}
          options={CATEGORIES.map((item) => ({ value: item, label: item }))}
          onChange={setCategory}
        />
        <span className="report-legend">单位：元</span>
      </div>

      <Spin spinning={loading}>
        {displayRows.length ? (
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>科目编码</th>
                <th style={{ width: '24%' }}>科目名称</th>
                <th style={{ width: 90 }}>类别</th>
                <th style={{ width: 90 }}>余额方向</th>
                <th>本期借方</th>
                <th>本期贷方</th>
                <th>期末余额</th>
                <th style={{ width: 100 }}>余额方向</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr key={row.code}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td style={{ textAlign: 'center' }}>{row.category}</td>
                  <td style={{ textAlign: 'center' }}>{row.direction}</td>
                  <td className="num">
                    <span className="money">{fmt(row.debit)}</span>
                  </td>
                  <td className="num">
                    <span className="money">{fmt(row.credit)}</span>
                  </td>
                  <td className="num">
                    <span className="money">{fmt(row.balance)}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>{row.balanceDirection}</td>
                </tr>
              ))}
              <tr className="total">
                <td>合计</td>
                <td />
                <td />
                <td />
                <td className="num">
                  <span className="money">{fmt(totals.debit)}</span>
                </td>
                <td className="num">
                  <span className="money">{fmt(totals.credit)}</span>
                </td>
                <td className="num">
                  <span className="money">{fmt(totals.balance)}</span>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无科目余额数据" style={{ padding: '56px 0' }} />
        )}
      </Spin>
    </div>
  );
}
