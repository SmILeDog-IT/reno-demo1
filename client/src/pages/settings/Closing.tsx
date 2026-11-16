import { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';

interface ClosingRow {
  id: number;
  period: string;
  closed_at: string;
  operator: string | null;
}

interface ClosingsResp {
  rows: ClosingRow[];
  current: string;
}

export default function Closing() {
  const { data } = useBootstrap();
  const [period, setPeriod] = useState('');
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);
  const [closings, setClosings] = useState<ClosingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!period && data?.period) setPeriod(data.period);
  }, [data, period]);

  const loadClosings = useCallback(async () => {
    try {
      const res = await api.get<ClosingsResp>('/closings');
      setClosings(res.rows);
    } catch (err) {
      message.error((err as Error).message);
    }
  }, []);

  useEffect(() => {
    loadClosings();
  }, [loadClosings]);

  const loadStats = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    try {
      const [all, pendingRes] = await Promise.all([
        api.get<{ total: number }>('/flows', { period, pageSize: 1 }),
        api.get<{ total: number }>('/flows', { tab: 'pending', period, pageSize: 1 }),
      ]);
      setTotal(all.total);
      setPending(pendingRes.total);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setTotal(0);
    setPending(0);
    loadStats();
  }, [loadStats]);

  const closed = closings.some((row) => row.period === period);

  const handleClose = () => {
    if (!period) return;
    if (pending > 0) {
      message.warning(`本期还有 ${pending} 条流水未审核，请先审核后再结账`);
      return;
    }
    Modal.confirm({
      title: `确认对 ${period} 账期结账？`,
      content: '结账后本期流水将被锁定，不能新增或修改（演示版仅做状态记录）。',
      okText: '结账',
      cancelText: '取消',
      onOk: async () => {
        setClosing(true);
        try {
          await api.post<{ ok: boolean }>('/closings', { period });
          message.success(`${period} 结账成功`);
          await loadClosings();
          await loadStats();
        } catch (err) {
          message.error((err as Error).message);
        } finally {
          setClosing(false);
        }
      },
    });
  };

  const columns: ColumnsType<ClosingRow> = [
    { title: '账期', dataIndex: 'period', width: 160 },
    { title: '结账时间', dataIndex: 'closed_at', width: 200 },
    { title: '操作人', dataIndex: 'operator', render: (value: string | null) => value || '—' },
  ];

  const statStyle = { fontSize: 22, fontWeight: 600, marginTop: 6 } as const;

  return (
    <div className="page">
      <PageHeader
        title="结账"
        period={period}
        onPeriodChange={setPeriod}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={async () => {
                await Promise.all([loadStats(), loadClosings()]);
                message.success('已刷新');
              }}
            >
              刷新
            </Button>
            <Button
              type="primary"
              danger
              icon={<CheckCircleOutlined />}
              disabled={!period || closed}
              loading={closing}
              onClick={handleClose}
            >
              结 账
            </Button>
          </Space>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 10 }}>
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            本期流水数
          </div>
          <div style={statStyle}>{loading ? '—' : fmt(total, 0)}</div>
        </div>
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            未审核数
          </div>
          <div style={{ ...statStyle, color: pending > 0 ? '#c9372c' : undefined }}>
            {loading ? '—' : fmt(pending, 0)}
          </div>
        </div>
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            本期状态
          </div>
          <div style={{ marginTop: 8 }}>
            <Tag color={closed ? 'green' : 'orange'} style={{ marginInlineEnd: 0 }}>
              {closed ? '已结账' : '未结账'}
            </Tag>
          </div>
        </div>
      </div>

      <div className="page-note">结账后本期流水将被锁定，不能新增或修改（演示版仅做状态记录）。</div>

      <div className="section">
        <div className="section-title">已结账账期</div>
        <Table<ClosingRow>
          size="small"
          rowKey="id"
          dataSource={closings}
          columns={columns}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (count) => `共 ${count} 条` }}
          locale={{ emptyText: '暂无已结账账期' }}
        />
      </div>
    </div>
  );
}
