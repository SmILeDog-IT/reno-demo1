import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Empty, Modal, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, fmt } from '../api';
import type { Voucher, VoucherItem } from '../types';
import { useBootstrap } from '../context';
import { Money, PageHeader } from '../components/ui';

interface VoucherResp {
  rows: Voucher[];
  total: number;
}

const itemColumns: ColumnsType<VoucherItem> = [
  { title: '摘要', dataIndex: 'summary' },
  { title: '科目编码', dataIndex: 'subject_code', width: 120 },
  { title: '科目名称', dataIndex: 'subject_name', width: 200 },
  {
    title: '借方',
    dataIndex: 'debit',
    width: 140,
    align: 'right',
    render: (value: number) => (value ? <span className="money">{fmt(value)}</span> : ''),
  },
  {
    title: '贷方',
    dataIndex: 'credit',
    width: 140,
    align: 'right',
    render: (value: number) => (value ? <span className="money">{fmt(value)}</span> : ''),
  },
];

export default function VoucherList() {
  const { data, reload } = useBootstrap();
  const [period, setPeriod] = useState('');
  const [rows, setRows] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (!period && data?.period) setPeriod(data.period);
  }, [data, period]);

  const load = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    try {
      const res = await api.get<VoucherResp>('/vouchers', { period });
      setRows(res.rows);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setSelected([]);
    load();
  }, [load]);

  const totals = useMemo(
    () => ({
      debit: rows.reduce((sum, row) => sum + row.debit, 0),
      credit: rows.reduce((sum, row) => sum + row.credit, 0),
    }),
    [rows]
  );

  const handleRefresh = async () => {
    await load();
    await reload();
    message.success('已刷新');
  };

  const handleDelete = () => {
    Modal.confirm({
      title: `确认删除选中的 ${selected.length} 张凭证？`,
      content: '删除后对应凭证明细将一并移除，操作不可撤销。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const res = await api.del<{ deleted: number }>('/vouchers', { ids: selected });
        message.success(`已删除 ${res.deleted} 张凭证`);
        setSelected([]);
        await load();
        await reload();
      },
    });
  };

  const columns: ColumnsType<Voucher> = [
    { title: '日期', dataIndex: 'date', width: 110 },
    {
      title: '凭证号',
      dataIndex: 'no',
      width: 100,
      render: (no: number) => `记-${no}`,
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      render: (text: string) => (
        <span title={text} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {text || '—'}
        </span>
      ),
    },
    {
      title: '来源流水号',
      dataIndex: 'source_flow_no',
      width: 116,
      render: (no: number) => (no ? `${no} 号` : '—'),
    },
    {
      title: '借方合计',
      dataIndex: 'debit',
      width: 130,
      align: 'right',
      render: (value: number) => <span className="money">{fmt(value)}</span>,
    },
    {
      title: '贷方合计',
      dataIndex: 'credit',
      width: 130,
      align: 'right',
      render: (value: number) => <span className="money">{fmt(value)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (status: string) => <Tag color="green">{status}</Tag>,
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="凭证管理"
        period={period}
        onPeriodChange={(value) => setPeriod(value)}
        extra={
          <Space size={8}>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => message.info('打印功能在演示版中未开放')}>
              打印
            </Button>
          </Space>
        }
      />

      <div className="toolbar">
        <div className="toolbar-left">
          <span>
            本期凭证 <b>{rows.length}</b> 张
          </span>
          <span className="muted">
            借方合计 <Money value={totals.debit} bold />
          </span>
          <span className="muted">
            贷方合计 <Money value={totals.credit} bold />
          </span>
        </div>
        <div className="toolbar-right">
          <Button danger icon={<DeleteOutlined />} disabled={!selected.length} onClick={handleDelete}>
            删除
          </Button>
        </div>
      </div>

      <Table<Voucher>
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 1050 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="本期暂无凭证，流水审核后自动生成凭证"
              style={{ padding: '40px 0' }}
            />
          ),
        }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys.map((key) => Number(key))),
        }}
        expandable={{
          expandedRowRender: (row) => (
            <Table<VoucherItem>
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={row.items}
              columns={itemColumns}
              style={{ margin: '-6px 0' }}
            />
          ),
        }}
        pagination={false}
      />
    </div>
  );
}
