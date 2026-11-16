import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Switch, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../api';
import { useBootstrap } from '../../context';
import { PageHeader } from '../../components/ui';
import type { Subject } from '../../types';

interface SubjectFormValues {
  code: string;
  name: string;
  category: string;
  direction: string;
  report_line?: string | null;
  enabled?: boolean;
}

const CATEGORY_OPTIONS = [
  { value: '资产', label: '资产' },
  { value: '负债', label: '负债' },
  { value: '权益', label: '权益' },
  { value: '收入', label: '收入' },
  { value: '成本', label: '成本' },
  { value: '费用', label: '费用' },
];

const CATEGORY_COLOR: Record<string, string> = {
  资产: 'blue',
  负债: 'orange',
  权益: 'purple',
  收入: 'green',
  成本: 'volcano',
  费用: 'gold',
};

const DIRECTION_OPTIONS = [
  { value: '借', label: '借' },
  { value: '贷', label: '贷' },
];

const REPORT_LINE_OPTIONS = [
  { value: 'revenue', label: '营业收入' },
  { value: 'cost', label: '营业成本' },
  { value: 'expense', label: '营业费用' },
  { value: 'tax', label: '税费' },
  { value: 'other_income', label: '其他收益' },
  { value: 'other_loss', label: '其他损失' },
];

const REPORT_LINE_LABEL: Record<string, string> = REPORT_LINE_OPTIONS.reduce(
  (acc, item) => ({ ...acc, [item.value]: item.label }),
  {} as Record<string, string>
);

export default function Subjects() {
  const { reload } = useBootstrap();
  const [rows, setRows] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<SubjectFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ rows: Subject[] }>('/settings/subjects');
      setRows(res.rows);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    await load();
    await reload();
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ category: '资产', direction: '借', enabled: true });
    setModalOpen(true);
  };

  const openEdit = (row: Subject) => {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue({
      code: row.code,
      name: row.name,
      category: row.category,
      direction: row.direction,
      report_line: row.report_line,
      enabled: Number(row.enabled) === 1,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const submit = async () => {
    let values: SubjectFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const payload = {
      code: values.code.trim(),
      name: values.name.trim(),
      category: values.category,
      direction: values.direction,
      report_line: values.report_line ?? null,
      enabled: values.enabled ? 1 : 0,
    };
    setSaving(true);
    try {
      if (editing) await api.put<unknown>(`/settings/subjects/${editing.id}`, payload);
      else await api.post<unknown>('/settings/subjects', payload);
      message.success(editing ? '已保存' : '已新增');
      closeModal();
      await refresh();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (row: Subject, checked: boolean) => {
    try {
      await api.put<unknown>(`/settings/subjects/${row.id}`, { enabled: checked ? 1 : 0 });
      message.success(checked ? '已启用' : '已停用');
      await refresh();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const remove = (row: Subject) => {
    Modal.confirm({
      title: `确认删除「${row.code} ${row.name}」？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.del<unknown>(`/settings/subjects/${row.id}`);
          message.success('已删除');
          await refresh();
        } catch (err) {
          message.error((err as Error).message);
        }
      },
    });
  };

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const matchKeyword = !kw || row.code.toLowerCase().includes(kw) || row.name.toLowerCase().includes(kw);
      const matchCategory = !category || row.category === category;
      return matchKeyword && matchCategory;
    });
  }, [rows, keyword, category]);

  const columns: ColumnsType<Subject> = [
    { title: '科目编码', dataIndex: 'code', width: 120 },
    { title: '科目名称', dataIndex: 'name', width: 220 },
    {
      title: '类别',
      dataIndex: 'category',
      width: 100,
      render: (value: string) => (
        <Tag color={CATEGORY_COLOR[value] ?? 'default'} style={{ marginInlineEnd: 0 }}>
          {value}
        </Tag>
      ),
    },
    { title: '余额方向', dataIndex: 'direction', width: 100 },
    {
      title: '报表归属',
      dataIndex: 'report_line',
      width: 130,
      render: (value: string | null) => (value ? REPORT_LINE_LABEL[value] ?? value : '—'),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (value: number, row) => (
        <Switch size="small" checked={Number(value) === 1} onChange={(checked) => toggleEnabled(row, checked)} />
      ),
    },
    {
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
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="科目设置"
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
            placeholder="搜索编码 / 名称"
            style={{ width: 220 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            allowClear
            placeholder="科目类别"
            style={{ width: 140 }}
            value={category}
            options={CATEGORY_OPTIONS}
            onChange={(value: string | undefined) => setCategory(value)}
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

      <Table<Subject>
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
        title={`${editing ? '编辑' : '新增'}科目`}
        okText="保 存"
        cancelText="取 消"
        width={480}
        confirmLoading={saving}
        forceRender
        onOk={submit}
        onCancel={closeModal}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="科目编码" name="code" rules={[{ required: true, message: '请输入科目编码' }]}>
            <Input placeholder="如 1001" />
          </Form.Item>
          <Form.Item label="科目名称" name="name" rules={[{ required: true, message: '请输入科目名称' }]}>
            <Input placeholder="请输入科目名称" />
          </Form.Item>
          <Form.Item label="类别" name="category" rules={[{ required: true, message: '请选择科目类别' }]}>
            <Select placeholder="请选择科目类别" options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item label="余额方向" name="direction" rules={[{ required: true, message: '请选择余额方向' }]}>
            <Select placeholder="请选择余额方向" options={DIRECTION_OPTIONS} />
          </Form.Item>
          <Form.Item label="报表归属" name="report_line">
            <Select allowClear placeholder="可空" options={REPORT_LINE_OPTIONS} />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
