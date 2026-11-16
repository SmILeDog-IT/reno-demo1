import { useCallback, useEffect, useMemo, useState, type Key } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, TreeSelect, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';
import type { Category, Subject } from '../../types';

type CategoryNode = Omit<Category, 'children'> & { children?: CategoryNode[] };

interface ParentNode {
  value: number;
  title: string;
  children?: ParentNode[];
}

interface CategoryFormValues {
  name: string;
  direction: string;
  parent_id?: number | null;
  subject_id?: number | null;
  internal?: boolean;
  sort?: number | null;
}

const DIRECTION_OPTIONS = [
  { value: '收', label: '收' },
  { value: '付', label: '付' },
  { value: '转账', label: '转账' },
];

const DIRECTION_COLOR: Record<string, string> = {
  收: 'green',
  付: 'red',
  转账: 'blue',
};

const REPORT_LINE_LABEL: Record<string, string> = {
  revenue: '营业收入',
  cost: '营业成本',
  expense: '营业费用',
  tax: '税费',
  other_income: '其他收益',
  other_loss: '其他损失',
};

function flattenSubjects(list: Subject[]): Subject[] {
  const out: Subject[] = [];
  const walk = (items: Subject[]) => {
    items.forEach((item) => {
      out.push(item);
      if (item.children?.length) walk(item.children);
    });
  };
  walk(list);
  return out;
}

function buildTree(rows: Category[]): CategoryNode[] {
  const map = new Map<number, CategoryNode>();
  rows.forEach((row) => {
    const { children: _children, ...rest } = row;
    map.set(row.id, { ...rest, children: [] });
  });
  const roots: CategoryNode[] = [];
  rows.forEach((row) => {
    const node = map.get(row.id);
    if (!node) return;
    const parent = row.parent_id != null ? map.get(row.parent_id) : undefined;
    if (parent) {
      parent.children?.push(node);
      if (!node.group_name) node.group_name = parent.group_name ?? parent.name;
    } else roots.push(node);
  });
  const prune = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.map((node) => ({
      ...node,
      children: node.children && node.children.length ? prune(node.children) : undefined,
    }));
  return prune(roots);
}

function collectParentKeys(nodes: CategoryNode[]): Key[] {
  const keys: Key[] = [];
  const walk = (list: CategoryNode[]) => {
    list.forEach((node) => {
      if (node.children?.length) {
        keys.push(node.id);
        walk(node.children);
      }
    });
  };
  walk(nodes);
  return keys;
}

function toParentTree(nodes: CategoryNode[], excludeId?: number): ParentNode[] {
  return nodes
    .filter((node) => node.id !== excludeId)
    .map((node) => ({
      value: node.id,
      title: node.name,
      children: node.children?.length ? toParentTree(node.children, excludeId) : undefined,
    }));
}

export default function Categories() {
  const { data, reload } = useBootstrap();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CategoryFormValues>();

  const tree = useMemo(() => buildTree(rows), [rows]);

  const subjectList = useMemo(() => flattenSubjects(data?.subjects ?? []), [data]);

  const subjectOptions = useMemo(
    () => subjectList.map((subject) => ({ value: subject.id, label: `${subject.code} ${subject.name}` })),
    [subjectList]
  );

  const subjectMap = useMemo(() => {
    const map = new Map<number, Subject>();
    subjectList.forEach((subject) => map.set(subject.id, subject));
    return map;
  }, [subjectList]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ rows: Category[] }>('/settings/categories');
      setRows(res.rows);
      setExpandedKeys(collectParentKeys(buildTree(res.rows)));
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const subjectLabel = (id: number | null) => {
    if (id == null) return '—';
    const subject = subjectMap.get(id);
    return subject ? `${subject.code} ${subject.name}` : '—';
  };

  const parentTree = useMemo(() => toParentTree(tree, editing?.id), [tree, editing]);

  const openCreate = (parent?: CategoryNode) => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      direction: parent?.direction ?? '付',
      parent_id: parent?.id ?? null,
      internal: Boolean(parent?.internal),
      sort: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (row: CategoryNode) => {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue({
      name: row.name,
      direction: row.direction,
      parent_id: row.parent_id,
      subject_id: row.subject_id,
      internal: Boolean(row.internal),
      sort: row.sort,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const submit = async () => {
    let values: CategoryFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const parentId = values.parent_id ?? null;
    const parent = parentId != null ? rows.find((row) => row.id === parentId) : undefined;
    const payload = {
      name: values.name.trim(),
      direction: values.direction,
      parent_id: parentId,
      subject_id: values.subject_id ?? null,
      internal: values.internal ? 1 : 0,
      sort: values.sort ?? 0,
      group_name: parent ? parent.name : values.name.trim(),
    };
    setSaving(true);
    try {
      if (editing) await api.put<unknown>(`/settings/categories/${editing.id}`, payload);
      else await api.post<unknown>('/settings/categories', payload);
      message.success(editing ? '已保存' : '已新增');
      closeModal();
      await load();
      await reload();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (row: CategoryNode) => {
    Modal.confirm({
      title: `确认删除「${row.name}」？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.del<unknown>(`/settings/categories/${row.id}`);
          message.success('已删除');
          await load();
          await reload();
        } catch (err) {
          message.error((err as Error).message);
        }
      },
    });
  };

  const columns: ColumnsType<CategoryNode> = [
    { title: '类别名称', dataIndex: 'name', width: 200 },
    {
      title: '分组',
      dataIndex: 'group_name',
      width: 110,
      render: (value: string | null) => value || '—',
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 80,
      render: (value: string) => (
        <Tag color={DIRECTION_COLOR[value] ?? 'default'} style={{ marginInlineEnd: 0 }}>
          {value}
        </Tag>
      ),
    },
    {
      title: '对应科目',
      dataIndex: 'subject_id',
      width: 190,
      render: (value: number | null) => subjectLabel(value),
    },
    {
      title: '报表行',
      dataIndex: 'report_line',
      width: 110,
      render: (value: string | null) => (value ? REPORT_LINE_LABEL[value] ?? value : '—'),
    },
    {
      title: '内部核算',
      dataIndex: 'internal',
      width: 90,
      render: (value: number) => (Number(value) === 1 ? '是' : '否'),
    },
    {
      title: '操作',
      key: 'action',
      width: 190,
      render: (_: unknown, row) => (
        <Space size={12}>
          <a className="link-btn" onClick={() => openCreate(row)}>
            新增子级
          </a>
          <a className="link-btn" onClick={() => openEdit(row)}>
            编辑
          </a>
          <a className="link-btn" onClick={() => remove(row)}>
            删除
          </a>
        </Space>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="流水类别"
        subtitle="流水类别用于智能记账，决定流水对应的会计科目"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>
              刷新
            </Button>
            <Button type="primary" danger icon={<PlusOutlined />} onClick={() => openCreate()}>
              新 增
            </Button>
          </Space>
        }
      />

      <Table<CategoryNode>
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={tree}
        columns={columns}
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpandedRowsChange: (keys) => setExpandedKeys([...keys]),
        }}
        pagination={false}
        locale={{ emptyText: '暂无数据' }}
      />

      <Modal
        open={modalOpen}
        title={`${editing ? '编辑' : '新增'}流水类别`}
        okText="保 存"
        cancelText="取 消"
        width={480}
        confirmLoading={saving}
        forceRender
        onOk={submit}
        onCancel={closeModal}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入类别名称' }]}>
            <Input placeholder="请输入类别名称" />
          </Form.Item>
          <Form.Item label="方向" name="direction" rules={[{ required: true, message: '请选择方向' }]}>
            <Select placeholder="请选择方向" options={DIRECTION_OPTIONS} />
          </Form.Item>
          <Form.Item label="上级类别" name="parent_id">
            <TreeSelect
              allowClear
              showSearch
              treeDefaultExpandAll
              treeNodeFilterProp="title"
              placeholder="不选则为一级类别"
              treeData={parentTree}
            />
          </Form.Item>
          <Form.Item label="对应科目" name="subject_id">
            <Select allowClear showSearch optionFilterProp="label" placeholder="请选择对应科目" options={subjectOptions} />
          </Form.Item>
          <Form.Item label="内部核算" name="internal" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="排序" name="sort">
            <InputNumber style={{ width: 160 }} precision={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
