import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  DatePicker,
  Dropdown,
  Empty,
  Input,
  Modal,
  Radio,
  Space,
  Table,
  Tabs,
  Tag,
  TreeSelect,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  AuditOutlined,
  DeleteOutlined,
  DownOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { api, fmt } from '../api';
import type { Category, Flow } from '../types';
import { useBootstrap } from '../context';
import { PageHeader } from '../components/ui';

type TopTab = 'all' | 'settle' | 'vat' | 'attach';
type StatusTab = 'all' | 'pending';

interface FlowPage {
  rows: Flow[];
  total: number;
  page: number;
  pageSize: number;
  summary: { debit: number; credit: number };
}

interface CategoryNode {
  value: number;
  title: string;
  children?: CategoryNode[];
}

function toTreeData(list: Category[]): CategoryNode[] {
  return list.map((node) => ({
    value: node.id,
    title: node.name,
    children: node.children?.length ? toTreeData(node.children) : undefined,
  }));
}

const TOP_TABS = [
  { key: 'all', label: '全部流水' },
  { key: 'settle', label: '收付管理' },
  { key: 'vat', label: '增值税管理' },
  { key: 'attach', label: '附件管理' },
];

export default function FlowList() {
  const navigate = useNavigate();
  const { data, reload } = useBootstrap();
  const [topTab, setTopTab] = useState<TopTab>('all');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [period, setPeriod] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [rows, setRows] = useState<Flow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ debit: 0, credit: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!period && data?.period) setPeriod(data.period);
  }, [data, period]);

  const treeData = useMemo(() => toTreeData(data?.categories || []), [data]);

  const load = useCallback(async () => {
    if (!period || topTab === 'vat' || topTab === 'attach') return;
    setLoading(true);
    try {
      const res = await api.get<FlowPage>('/flows', {
        tab: statusTab,
        period,
        keyword: keyword || undefined,
        categoryId: categoryId ?? undefined,
        page,
        pageSize,
        settle: topTab === 'settle' ? 0 : undefined,
      });
      setRows(res.rows);
      setTotal(res.total);
      setSummary(res.summary);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period, topTab, statusTab, keyword, categoryId, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!period) return;
    api
      .get<{ total: number }>('/flows', { tab: 'pending', period, pageSize: 1 })
      .then((res) => setPendingCount(res.total))
      .catch(() => {});
  }, [period, tick]);

  const refreshAll = async () => {
    await load();
    setTick((t) => t + 1);
    await reload();
  };

  const changeTopTab = (key: string) => {
    setTopTab(key as TopTab);
    setSelected([]);
    setPage(1);
  };

  const changeStatusTab = (value: StatusTab) => {
    setStatusTab(value);
    setSelected([]);
    setPage(1);
  };

  const handleAudit = async (ids: number[]) => {
    try {
      const res = await api.post<{ audited: number }>('/flows/audit', { ids });
      message.success(`已审核 ${res.audited} 条流水，凭证已同步生成`);
      setSelected([]);
      await refreshAll();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const handleSettle = async (ids: number[], settleType: string) => {
    try {
      const res = await api.post<{ settled: number }>('/flows/settle', { ids, settleType });
      message.success(`已核销 ${res.settled} 条流水`);
      setSelected([]);
      await refreshAll();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const handleDelete = (ids: number[]) => {
    Modal.confirm({
      title: `确认删除选中的 ${ids.length} 条流水？`,
      content: '已审核的流水不可删除，将被自动跳过。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const res = await api.del<{ deleted: number }>('/flows', { ids });
        message.success(`已删除 ${res.deleted} 条流水`);
        setSelected([]);
        await refreshAll();
      },
    });
  };

  const columns: ColumnsType<Flow> = [
    { title: '日期', dataIndex: 'date', width: 104 },
    {
      title: '流水号',
      dataIndex: 'no',
      width: 84,
      render: (no: number) => `${no} 号`,
    },
    {
      title: '流水类别',
      dataIndex: 'category_name',
      width: 110,
      render: (name: string) => <span style={{ color: '#3b6fd8' }}>{name || '—'}</span>,
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      render: (_: unknown, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span
            title={row.summary}
            style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {row.summary || '—'}
          </span>
          {row.counterparty_name ? (
            <Tag color="blue" style={{ marginInlineEnd: 0, flexShrink: 0 }}>
              {row.counterparty_name}
            </Tag>
          ) : null}
        </div>
      ),
    },
    { title: '类型', dataIndex: 'type', width: 72 },
    {
      title: '借方金额',
      key: 'debit',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      render: (amount: number, row) => (row.type === '收款' ? <span className="money">{fmt(amount)}</span> : ''),
    },
    {
      title: '贷方金额',
      key: 'credit',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      render: (amount: number, row) => (row.type === '付款' ? <span className="money">{fmt(amount)}</span> : ''),
    },
    {
      title: '状态',
      key: 'settle',
      width: 180,
      render: (_: unknown, row) =>
        row.settled === 0 && row.counterparty_id ? (
          <Space size={4}>
            <span style={{ color: '#f08c3a' }}>未核销</span>
            {row.settle_type ? (
              <Tag color="orange" style={{ marginInlineEnd: 0 }}>
                {row.settle_type}
              </Tag>
            ) : null}
            <a className="link-btn" onClick={() => handleSettle([row.id], '收款')}>
              核销
            </a>
          </Space>
        ) : (
          <span>{row.settle_type || '—'}</span>
        ),
    },
    { title: '制单人', dataIndex: 'creator', width: 116 },
    {
      title: '操作',
      key: 'action',
      width: 84,
      render: (_: unknown, row) =>
        row.status === '未审核' ? (
          <a className="link-btn" onClick={() => handleAudit([row.id])}>
            审核
          </a>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  const displayRows = topTab === 'settle' ? rows.filter((row) => row.counterparty_id !== null) : rows;

  const moreItems = [
    { key: 'export', label: '导出 EXCEL' },
    { key: 'import', label: '导入流水' },
    { key: 'setting', label: '流水设置' },
  ];

  const renderList = () => {
    if (topTab === 'vat' || topTab === 'attach') {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="该功能在演示版中未开放"
          style={{ padding: '70px 0' }}
        />
      );
    }
    return (
      <>
        <div className="toolbar">
          <div className="toolbar-left">
            <Radio.Group
              value={statusTab}
              optionType="button"
              buttonStyle="solid"
              onChange={(e) => changeStatusTab(e.target.value as StatusTab)}
              options={[
                { value: 'all', label: '全部' },
                { value: 'pending', label: `待审核(${pendingCount})` },
              ]}
            />
            <DatePicker
              picker="month"
              allowClear={false}
              value={period ? dayjs(period) : null}
              format="YYYY年MM月"
              style={{ width: 130 }}
              onChange={(value) => {
                if (!value) return;
                setPeriod(value.format('YYYY-MM'));
                setPage(1);
                setSelected([]);
              }}
            />
            <TreeSelect
              allowClear
              treeData={treeData}
              treeDefaultExpandAll
              showSearch
              treeNodeFilterProp="title"
              placeholder="流水类别"
              value={categoryId}
              style={{ width: 160 }}
              onChange={(value) => {
                setCategoryId(value ? Number(value) : undefined);
                setPage(1);
              }}
            />
            <Input
              allowClear
              placeholder="搜索流水"
              style={{ width: 190 }}
              value={keywordInput}
              onChange={(e) => {
                setKeywordInput(e.target.value);
                if (!e.target.value) {
                  setKeyword('');
                  setPage(1);
                }
              }}
              onPressEnter={() => {
                setKeyword(keywordInput);
                setPage(1);
              }}
            />
          </div>
          <div className="toolbar-right">
            <Button type="primary" danger icon={<PlusOutlined />} onClick={() => navigate('/entry')}>
              新增
            </Button>
            <Button icon={<AuditOutlined />} disabled={!selected.length} onClick={() => handleAudit(selected)}>
              审核
            </Button>
            {topTab === 'settle' ? (
              <Dropdown
                disabled={!selected.length}
                menu={{
                  items: [
                    { key: '收款', label: '收款' },
                    { key: '付款', label: '付款' },
                    { key: '退款', label: '退款' },
                  ],
                  onClick: ({ key }) => handleSettle(selected, key),
                }}
              >
                <Button disabled={!selected.length}>
                  批量核销 <DownOutlined />
                </Button>
              </Dropdown>
            ) : null}
            <Button icon={<PrinterOutlined />} onClick={() => message.info('打印功能在演示版中未开放')}>
              打印
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={!selected.length}
              onClick={() => handleDelete(selected)}
            >
              删除
            </Button>
            <Button onClick={() => message.info('整理功能在演示版中未开放')}>整理</Button>
            <Dropdown
              menu={{
                items: moreItems,
                onClick: () => message.info('该功能在演示版中未开放'),
              }}
            >
              <Button>
                更多 <DownOutlined />
              </Button>
            </Dropdown>
            <Button icon={<ReloadOutlined />} onClick={refreshAll}>
              刷新
            </Button>
          </div>
        </div>

        <Table<Flow>
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={displayRows}
          columns={columns}
          tableLayout="fixed"
          scroll={{ x: 1400 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无流水" /> }}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys.map((key) => Number(key))),
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['100', '200', '500'],
            showTotal: (count) => `共 ${count} 条`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
              setSelected([]);
            },
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 28,
            padding: '8px 12px',
            borderTop: '1px solid #f0f0f0',
            fontSize: 13,
            color: '#666',
          }}
        >
          <span>
            借方合计 <b className="money" style={{ color: '#333' }}>{fmt(summary.debit)}</b>
          </span>
          <span>
            贷方合计 <b className="money" style={{ color: '#333' }}>{fmt(summary.credit)}</b>
          </span>
        </div>
      </>
    );
  };

  return (
    <div className="page">
      <PageHeader title="流水管理" />
      <Tabs activeKey={topTab} onChange={changeTopTab} items={TOP_TABS} />
      {renderList()}
    </div>
  );
}
