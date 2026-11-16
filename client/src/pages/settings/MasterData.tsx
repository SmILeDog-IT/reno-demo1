import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Form, Input, Modal, Select, Space, Switch, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';
import type { Subject } from '../../types';

interface Option {
  value: string | number;
  label: string;
}

type FieldKind = 'text' | 'select' | 'switch';

interface FieldConfig {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  allowClear?: boolean;
  options?: Option[];
  optionsFrom?: 'subjects' | 'warehouses';
  defaultValue?: string | number;
  width?: number;
}

interface ResourceConfig {
  entity: string;
  title: string;
  fields: FieldConfig[];
}

interface Row {
  id: number;
  name: string;
  [key: string]: unknown;
}

const ACCOUNT_NATURE: Option[] = [
  { value: '银行存款', label: '银行存款' },
  { value: '库存现金', label: '库存现金' },
  { value: '其他货币资金', label: '其他货币资金' },
];

const ACCOUNT_TAG: Option[] = [
  { value: '一般户', label: '一般户' },
  { value: '基本户', label: '基本户' },
  { value: '现金', label: '现金' },
  { value: '支付宝', label: '支付宝' },
  { value: '微信', label: '微信' },
  { value: '备用金', label: '备用金' },
  { value: '其他', label: '其他' },
];

const RESOURCE_CONFIG: Record<string, ResourceConfig> = {
  accounts: {
    entity: '账户',
    title: '账户设置',
    fields: [
      { name: 'name', label: '账户名称', kind: 'text', required: true, width: 200 },
      {
        name: 'nature',
        label: '账户性质',
        kind: 'select',
        required: true,
        options: ACCOUNT_NATURE,
        defaultValue: '银行存款',
        width: 150,
      },
      { name: 'tag', label: '账户标签', kind: 'select', allowClear: true, options: ACCOUNT_TAG, width: 120 },
      {
        name: 'subject_id',
        label: '对应科目',
        kind: 'select',
        allowClear: true,
        optionsFrom: 'subjects',
        width: 200,
      },
      { name: 'enabled', label: '启用', kind: 'switch' },
    ],
  },
  counterparties: {
    entity: '往来单位',
    title: '往来设置',
    fields: [
      { name: 'name', label: '名称', kind: 'text', required: true, width: 220 },
      {
        name: 'type',
        label: '类型',
        kind: 'select',
        defaultValue: '客户',
        options: [
          { value: '客户', label: '客户' },
          { value: '供应商', label: '供应商' },
          { value: '其他', label: '其他' },
        ],
        width: 110,
      },
      { name: 'contact', label: '联系人', kind: 'text', width: 120 },
      { name: 'phone', label: '电话', kind: 'text', width: 140 },
      { name: 'note', label: '备注', kind: 'text' },
    ],
  },
  projects: {
    entity: '项目',
    title: '项目设置',
    fields: [
      { name: 'name', label: '项目名称', kind: 'text', required: true, width: 260 },
      { name: 'note', label: '备注', kind: 'text' },
    ],
  },
  inventories: {
    entity: '存货',
    title: '存货设置',
    fields: [
      { name: 'name', label: '存货名称', kind: 'text', required: true, width: 240 },
      { name: 'spec', label: '规格', kind: 'text', width: 160 },
      { name: 'unit', label: '单位', kind: 'text', width: 100 },
      { name: 'warehouse_id', label: '仓库', kind: 'select', allowClear: true, optionsFrom: 'warehouses', width: 160 },
    ],
  },
  warehouses: {
    entity: '仓库',
    title: '仓库设置',
    fields: [{ name: 'name', label: '仓库名称', kind: 'text', required: true, width: 260 }],
  },
};

const FALLBACK_CONFIG: ResourceConfig = { entity: '资料', title: '基础资料', fields: [] };

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

export default function MasterData() {
  const { resource = 'accounts' } = useParams<{ resource: string }>();
  const config = RESOURCE_CONFIG[resource] ?? FALLBACK_CONFIG;
  const { data, reload } = useBootstrap();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<Record<string, unknown>>();

  const subjectOptions = useMemo<Option[]>(
    () => flattenSubjects(data?.subjects ?? []).map((s) => ({ value: s.id, label: `${s.code} ${s.name}` })),
    [data]
  );

  const subjectMap = useMemo(() => {
    const map = new Map<number, Subject>();
    flattenSubjects(data?.subjects ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [data]);

  const warehouseMap = useMemo(() => {
    const map = new Map<number, string>();
    (data?.warehouses ?? []).forEach((w) => map.set(w.id, w.name));
    return map;
  }, [data]);

  const load = useCallback(async () => {
    if (!RESOURCE_CONFIG[resource]) return;
    setLoading(true);
    try {
      const res = await api.get<{ rows: Row[] }>(`/settings/${resource}`);
      setRows(res.rows);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => {
    setKeyword('');
    setEditing(null);
    setModalOpen(false);
    load();
  }, [load]);

  const refresh = async () => {
    await load();
    await reload();
  };

  const fieldOptions = (field: FieldConfig): Option[] => {
    if (field.options) return field.options;
    if (field.optionsFrom === 'subjects') return subjectOptions;
    if (field.optionsFrom === 'warehouses') {
      return (data?.warehouses ?? []).map((w) => ({ value: w.id, label: w.name }));
    }
    return [];
  };

  const renderValue = (field: FieldConfig, value: unknown) => {
    if (field.name === 'subject_id') {
      const subject = subjectMap.get(Number(value));
      return subject ? `${subject.code} ${subject.name}` : '—';
    }
    if (field.name === 'warehouse_id') {
      const name = warehouseMap.get(Number(value));
      return name || '—';
    }
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    config.fields.forEach((field) => {
      if (field.kind === 'switch') form.setFieldValue(field.name, true);
      else if (field.defaultValue !== undefined) form.setFieldValue(field.name, field.defaultValue);
    });
    setModalOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    form.resetFields();
    config.fields.forEach((field) => {
      const value = field.kind === 'switch' ? Number(row[field.name]) === 1 : row[field.name];
      form.setFieldValue(field.name, value);
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const submit = async () => {
    let values: Record<string, unknown>;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const payload: Record<string, unknown> = {};
    config.fields.forEach((field) => {
      const value = values[field.name];
      if (field.kind === 'switch') payload[field.name] = value ? 1 : 0;
      else if (typeof value === 'string') payload[field.name] = value.trim() || null;
      else payload[field.name] = value ?? null;
    });
    setSaving(true);
    try {
      if (editing) await api.put<unknown>(`/settings/${resource}/${editing.id}`, payload);
      else await api.post<unknown>(`/settings/${resource}`, payload);
      message.success(editing ? '已保存' : '已新增');
      closeModal();
      await refresh();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (row: Row, checked: boolean) => {
    try {
      await api.put<unknown>(`/settings/accounts/${row.id}`, { enabled: checked ? 1 : 0 });
      message.success(checked ? '已启用' : '已停用');
      await refresh();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const remove = (row: Row) => {
    Modal.confirm({
      title: `确认删除「${row.name}」？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.del<unknown>(`/settings/${resource}/${row.id}`);
          message.success('已删除');
          await refresh();
        } catch (err) {
          message.error((err as Error).message);
        }
      },
    });
  };

  const filteredRows = rows.filter((row) =>
    String(row.name ?? '')
      .toLowerCase()
      .includes(keyword.trim().toLowerCase())
  );

  const columns: ColumnsType<Row> = config.fields
    .filter((field) => field.kind !== 'switch')
    .map((field) => ({
      title: field.label,
      dataIndex: field.name,
      width: field.width,
      render: (value: unknown) => renderValue(field, value),
    }));

  if (resource === 'accounts') {
    columns.push({
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (value: unknown, row) => (
        <Switch size="small" checked={Number(value) === 1} onChange={(checked) => toggleEnabled(row, checked)} />
      ),
    });
  }

  columns.push({
    title: '操作',
    key: 'action',
    width: 110,
    render: (_: unknown, row) => (
      <Space size={12}>
        <a className="link-btn" onClick={() => openEdit(row)}>
          编辑
        </a>
        <a className="link-btn" onClick={() => remove(row)}>
          删除
        </a>
      </Space>
    ),
  });

  return (
    <div className="page">
      <PageHeader
        title={config.title}
        extra={
          <Button type="primary" danger icon={<PlusOutlined />} onClick={openCreate}>
            新 增
          </Button>
        }
      />

      <div className="toolbar">
        <div className="toolbar-left">
          <Input
            allowClear
            placeholder="搜索名称"
            style={{ width: 220 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <span className="muted">共 {filteredRows.length} 条</span>
        </div>
        <div className="toolbar-right">
          <Button
            icon={<ReloadOutlined />}
            onClick={async () => {
              await refresh();
              message.success('已刷新');
            }}
          >
            刷新
          </Button>
        </div>
      </div>

      <Table<Row>
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={filteredRows}
        columns={columns}
        pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
        locale={{ emptyText: '暂无数据' }}
      />

      <Modal
        open={modalOpen}
        title={`${editing ? '编辑' : '新增'}${config.entity}`}
        okText="保 存"
        cancelText="取 消"
        width={480}
        confirmLoading={saving}
        forceRender
        onOk={submit}
        onCancel={closeModal}
      >
        <Form form={form} layout="vertical">
          {config.fields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              valuePropName={field.kind === 'switch' ? 'checked' : undefined}
              rules={field.required ? [{ required: true, message: `请填写${field.label}` }] : undefined}
            >
              {field.kind === 'text' ? (
                <Input placeholder={`请输入${field.label}`} />
              ) : field.kind === 'select' ? (
                <Select
                  allowClear={field.allowClear}
                  placeholder={`请选择${field.label}`}
                  options={fieldOptions(field)}
                />
              ) : (
                <Switch />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
}
