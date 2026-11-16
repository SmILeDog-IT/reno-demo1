import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, DatePicker, Input, InputNumber, Select, Space, Table, TreeSelect, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api } from '../api';
import type { Category, Flow } from '../types';
import { useBootstrap } from '../context';
import { PageHeader } from '../components/ui';

type LineType = '收款' | '付款' | '转账';

interface LineRow {
  key: number;
  type: LineType;
  amount: number | null;
  accountId?: number;
  counterpartyId?: number;
  projectId?: number;
  inventoryId?: number;
  quantity: number | null;
}

interface CategoryNode {
  value: number;
  title: string;
  children?: CategoryNode[];
}

const TYPE_OPTIONS: { value: LineType; label: string }[] = [
  { value: '收款', label: '收款' },
  { value: '付款', label: '付款' },
  { value: '转账', label: '转账' },
];

const labelStyle: CSSProperties = {
  width: 72,
  flexShrink: 0,
  color: '#666',
  fontSize: 13,
  lineHeight: '32px',
};

function filterTree(list: Category[], keyword: string): Category[] {
  const kw = keyword.trim();
  if (!kw) return list;
  return list.reduce<Category[]>((acc, node) => {
    const children = node.children?.length ? filterTree(node.children, kw) : [];
    if (node.name.includes(kw) || children.length) {
      acc.push({ ...node, children });
    }
    return acc;
  }, []);
}

function toTreeData(list: Category[]): CategoryNode[] {
  return list.map((node) => ({
    value: node.id,
    title: node.name,
    children: node.children?.length ? toTreeData(node.children) : undefined,
  }));
}

export default function FlowEntry() {
  const navigate = useNavigate();
  const { data, reload } = useBootstrap();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [summary, setSummary] = useState('');
  const [panelTab, setPanelTab] = useState<'outside' | 'internal'>('outside');
  const [categoryKeyword, setCategoryKeyword] = useState('');
  const [treeExpandedKeys, setTreeExpandedKeys] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const keySeq = useRef(1);

  const blankLine = (type: LineType = '付款'): LineRow => ({
    key: keySeq.current++,
    type,
    amount: null,
    quantity: null,
  });

  const [lines, setLines] = useState<LineRow[]>([blankLine()]);

  const categories = useMemo(() => data?.categories || [], [data]);

  const flatCategories = useMemo(() => {
    const out: Category[] = [];
    const walk = (items: Category[]) => {
      items.forEach((item) => {
        out.push(item);
        if (item.children?.length) walk(item.children);
      });
    };
    walk(categories);
    return out;
  }, [categories]);

  const selectedCategory = useMemo(
    () => flatCategories.find((c) => c.id === categoryId),
    [flatCategories, categoryId]
  );

  const treeData = useMemo(() => toTreeData(categories), [categories]);

  useEffect(() => {
    setTreeExpandedKeys(categories.map((c) => c.id));
  }, [categories]);

  const panelCategories = useMemo(() => {
    const list = categories.filter((c) => (panelTab === 'internal' ? c.internal === 1 : c.internal === 0));
    return filterTree(list, categoryKeyword);
  }, [categories, panelTab, categoryKeyword]);

  const typeOfCategory = (cat?: Category): LineType => {
    if (!cat) return '付款';
    if (cat.direction === '收') return '收款';
    if (cat.direction === '转账') return '转账';
    return '付款';
  };

  const pickCategory = (id: number) => {
    setCategoryId(id);
    const cat = flatCategories.find((c) => c.id === id);
    const type = typeOfCategory(cat);
    setLines((prev) =>
      prev.length === 1 && !Number(prev[0].amount) ? [{ ...prev[0], type }] : prev
    );
  };

  const updateLine = (key: number, patch: Partial<LineRow>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  };

  const accountOptions = (data?.accounts || []).map((a) => ({ value: a.id, label: a.name }));
  const counterpartyOptions = (data?.counterparties || []).map((c) => ({ value: c.id, label: c.name }));
  const projectOptions = (data?.projects || []).map((p) => ({ value: p.id, label: p.name }));
  const inventoryOptions = (data?.inventories || []).map((i) => ({ value: i.id, label: i.name }));

  const columns: ColumnsType<LineRow> = [
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (_: unknown, row) => (
        <Select
          size="small"
          value={row.type}
          options={TYPE_OPTIONS}
          style={{ width: '100%' }}
          onChange={(value) => updateLine(row.key, { type: value as LineType })}
        />
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 150,
      render: (_: unknown, row) => (
        <InputNumber
          size="small"
          min={0}
          precision={2}
          controls={false}
          placeholder="0.00"
          value={row.amount}
          style={{ width: '100%' }}
          onChange={(value) => updateLine(row.key, { amount: value })}
        />
      ),
    },
    {
      title: '账户',
      dataIndex: 'accountId',
      width: 180,
      render: (_: unknown, row) => (
        <Select
          size="small"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="请选择"
          value={row.accountId}
          options={accountOptions}
          style={{ width: '100%' }}
          onChange={(value) => updateLine(row.key, { accountId: value ?? undefined })}
        />
      ),
    },
    {
      title: '往来单位',
      dataIndex: 'counterpartyId',
      width: 180,
      render: (_: unknown, row) => (
        <Select
          size="small"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="请选择"
          value={row.counterpartyId}
          options={counterpartyOptions}
          style={{ width: '100%' }}
          onChange={(value) => updateLine(row.key, { counterpartyId: value ?? undefined })}
        />
      ),
    },
    {
      title: '项目',
      dataIndex: 'projectId',
      width: 160,
      render: (_: unknown, row) => (
        <Select
          size="small"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="请选择"
          value={row.projectId}
          options={projectOptions}
          style={{ width: '100%' }}
          onChange={(value) => updateLine(row.key, { projectId: value ?? undefined })}
        />
      ),
    },
    {
      title: '存货',
      dataIndex: 'inventoryId',
      width: 160,
      render: (_: unknown, row) => (
        <Select
          size="small"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="请选择"
          value={row.inventoryId}
          options={inventoryOptions}
          style={{ width: '100%' }}
          onChange={(value) => updateLine(row.key, { inventoryId: value ?? undefined })}
        />
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 100,
      render: (_: unknown, row) => (
        <InputNumber
          size="small"
          min={0}
          controls={false}
          placeholder="—"
          value={row.quantity}
          style={{ width: '100%' }}
          onChange={(value) => updateLine(row.key, { quantity: value })}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      align: 'center',
      render: (_: unknown, row) => (
        <a
          className="link-btn"
          onClick={() => removeLine(row.key)}
          style={lines.length <= 1 ? { color: '#c9c9c9', cursor: 'not-allowed' } : undefined}
        >
          删除
        </a>
      ),
    },
  ];

  const renderPanelNodes = (nodes: Category[], depth: number): ReactNode[] =>
    nodes.flatMap((node) => {
      const hasChildren = !!node.children?.length;
      const selected = !hasChildren && node.id === categoryId;
      const row = (
        <div
          key={node.id}
          onClick={() => (hasChildren ? undefined : pickCategory(node.id))}
          style={{
            padding: '6px 10px',
            paddingLeft: 10 + depth * 14,
            cursor: hasChildren ? 'default' : 'pointer',
            fontSize: 13,
            fontWeight: hasChildren ? 600 : 400,
            color: hasChildren ? '#8b8f95' : selected ? '#c9372c' : '#444',
            background: selected ? '#fff5f5' : undefined,
            borderLeft: selected ? '3px solid #c9372c' : '3px solid transparent',
          }}
        >
          {node.name}
        </div>
      );
      return hasChildren ? [row, ...renderPanelNodes(node.children || [], depth + 1)] : [row];
    });

  const handleRefresh = async () => {
    await reload();
    message.success('已刷新基础数据');
  };

  const handleSave = async (again: boolean) => {
    if (!date) {
      message.warning('请选择日期');
      return;
    }
    if (!categoryId) {
      message.warning('请选择流水类别');
      return;
    }
    const validLines = lines.filter((line) => Number(line.amount) > 0);
    if (!validLines.length) {
      message.warning('请至少填写一条金额大于 0 的明细');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ no: number; rows: Flow[] }>('/flows', {
        date: date.format('YYYY-MM-DD'),
        categoryId,
        summary: summary.trim(),
        lines: validLines.map((line) => ({
          type: line.type,
          amount: Number(line.amount),
          accountId: line.accountId,
          counterpartyId: line.counterpartyId,
          projectId: line.projectId,
          inventoryId: line.inventoryId,
          quantity: line.quantity ?? undefined,
        })),
      });
      message.success(`已保存为 ${res.no} 号流水`);
      await reload();
      if (again) {
        setSummary('');
        setLines([blankLine(typeOfCategory(flatCategories.find((c) => c.id === categoryId)))]);
      } else {
        navigate('/flows');
      }
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="录入流水"
        extra={
          <Space size={8}>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
            <Button loading={saving} onClick={() => handleSave(true)}>
              保存并新增
            </Button>
            <Button type="primary" danger loading={saving} onClick={() => handleSave(false)}>
              保存
            </Button>
          </Space>
        }
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="section">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <span style={labelStyle}>日期</span>
              <DatePicker
                value={date}
                allowClear={false}
                format="YYYY-MM-DD"
                style={{ width: 170 }}
                onChange={(value) => value && setDate(value)}
              />
              <span style={{ ...labelStyle, width: 80, marginLeft: 16 }}>流水类别</span>
              <TreeSelect
                value={categoryId}
                treeData={treeData}
                treeDefaultExpandAll
                treeExpandedKeys={treeExpandedKeys}
                onTreeExpand={(keys) => setTreeExpandedKeys(keys as number[])}
                showSearch
                treeNodeFilterProp="title"
                placeholder="请选择流水类别"
                style={{ width: 240 }}
                onChange={(value) => {
                  const id = Number(value);
                  if (id) pickCategory(id);
                  else setCategoryId(undefined);
                }}
              />
              {selectedCategory ? (
                <span className="muted" style={{ fontSize: 12 }}>
                  {selectedCategory.direction === '收' ? '收款类' : selectedCategory.direction === '转账' ? '转账类' : '付款类'}
                </span>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <span style={labelStyle}>摘要</span>
              <Input
                value={summary}
                placeholder="请输入摘要，如：9月门店销售收入"
                maxLength={100}
                style={{ flex: 1 }}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={labelStyle}>附件</span>
              <div
                style={{
                  flex: 1,
                  height: 92,
                  border: '1px dashed #d9d9d9',
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#b0b4ba',
                  fontSize: 12,
                  background: '#fcfcfd',
                }}
              >
                在此区域内点击右键粘贴剪贴板中的图片
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-title">
              <span>明细</span>
              <span className="form-tip">金额为必填项，可添加多行</span>
            </div>
            <Table<LineRow>
              size="small"
              bordered
              rowKey="key"
              columns={columns}
              dataSource={lines}
              pagination={false}
              scroll={{ x: 1180 }}
            />
            <div style={{ marginTop: 8 }}>
              <a
                className="link-btn"
                onClick={() => setLines((prev) => [...prev, blankLine(typeOfCategory(selectedCategory))])}
              >
                + 添加一行
              </a>
            </div>
          </div>
        </div>

        <aside
          style={{
            width: 260,
            flexShrink: 0,
            border: '1px solid #f0f0f0',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 190px)',
            background: '#fff',
          }}
        >
          <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
            {(
              [
                { key: 'outside', label: '外部收支' },
                { key: 'internal', label: '内部核算' },
              ] as const
            ).map((tab) => (
              <div
                key={tab.key}
                onClick={() => setPanelTab(tab.key)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '9px 0',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: panelTab === tab.key ? '#c9372c' : '#666',
                  borderBottom: panelTab === tab.key ? '2px solid #c9372c' : '2px solid transparent',
                  fontWeight: panelTab === tab.key ? 600 : 400,
                }}
              >
                {tab.label}
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 8px 6px' }}>
            <Input
              size="small"
              allowClear
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="搜索类别"
              value={categoryKeyword}
              onChange={(e) => setCategoryKeyword(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, overflow: 'auto', paddingBottom: 6 }}>
            {panelCategories.length ? (
              renderPanelNodes(panelCategories, 0)
            ) : (
              <div className="empty-tip">没有匹配的类别</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
