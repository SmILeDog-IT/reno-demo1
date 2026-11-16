import { useState } from 'react';
import { Button, Form, Input, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const submit = async (values: { phone: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string }>('/login', values);
      localStorage.setItem('xf_token', res.token);
      message.success('登录成功');
      navigate('/');
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <span className="logo-mark big">番</span>
          <div>
            <div className="login-title">小番财务</div>
            <div className="login-sub">小微企业流水账财务系统 · 仿制演示版</div>
          </div>
        </div>
        <Form layout="vertical" initialValues={{ phone: '13800000000', password: '123456' }} onFinish={submit}>
          <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input size="large" placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password size="large" placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit" block loading={loading}>
            登 录
          </Button>
          <Button
            size="large"
            block
            style={{ marginTop: 10 }}
            onClick={() => submit({ phone: '13800000000', password: '123456' })}
          >
            体验模式一键进入
          </Button>
        </Form>
        <div className="login-tip">演示账号：13800000000 / 123456（任意账号密码均可登录）</div>
      </div>
    </div>
  );
}
