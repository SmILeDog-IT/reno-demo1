import { useEffect, useMemo, useState } from 'react';
import { Dropdown, Select, message } from 'antd';
import { CloseOutlined, DownOutlined, QuestionCircleOutlined, MoreOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MENUS, PATH_LABELS, groupOf } from '../menu';
import { BizIcon } from './BizIcon';
import { useBootstrap } from '../context';

interface Tab {
  path: string;
  label: string;
}

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useBootstrap();
  const [tabs, setTabs] = useState<Tab[]>([{ path: '/', label: '首页' }]);
  const [flyout, setFlyout] = useState<string | null>(null);

  const activeGroup = useMemo(() => groupOf(location.pathname)?.key, [location.pathname]);

  useEffect(() => {
    const label = PATH_LABELS[location.pathname];
    if (!label) return;
    setTabs((prev) => (prev.some((t) => t.path === location.pathname) ? prev : [...prev, { path: location.pathname, label }]));
  }, [location.pathname]);

  const go = (path: string) => {
    setFlyout(null);
    navigate(path);
  };

  const closeTab = (path: string) => {
    if (path === '/') return;
    setTabs((prev) => {
      const next = prev.filter((t) => t.path !== path);
      if (location.pathname === path) {
        const last = next[next.length - 1];
        navigate(last ? last.path : '/');
      }
      return next;
    });
  };

  const logout = () => {
    localStorage.removeItem('xf_token');
    message.success('已退出登录');
    navigate('/login');
  };

  const moreItems = [
    { key: 'notice', label: '公告中心' },
    { key: 'help', label: '帮助中心' },
    { key: 'plan', label: '套餐购买' },
    { key: 'security', label: '安全中心' },
    { type: 'divider' as const, key: 'd1' },
    { key: 'logout', label: '退出登录' },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo" title="小番财务">
          <span className="logo-mark">番</span>
        </div>
        <div className="top-tabs">
          {tabs.map((tab) => (
            <div
              key={tab.path}
              className={`top-tab ${location.pathname === tab.path ? 'active' : ''}`}
              onClick={() => navigate(tab.path)}
            >
              <BizIcon name={tab.path === '/' ? 'home' : 'file'} className="tab-icon" />
              <span>{tab.label}</span>
              {tab.path !== '/' ? (
                <CloseOutlined
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.path);
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
        <div className="top-actions">
          <span className="version-badge">体验版</span>
          <Select
            size="small"
            className="book-select"
            value={data?.book?.name || '智能版演示账套(含演示数据)'}
            options={[{ value: data?.book?.name || '智能版演示账套(含演示数据)', label: data?.book?.name || '智能版演示账套(含演示数据)' }]}
            popupMatchSelectWidth={false}
          />
          <a className="top-link" onClick={() => go('/settings/accounts')}>账套设置</a>
          <a className="top-link">
            <QuestionCircleOutlined /> 帮助与客服
          </a>
          <Dropdown
            menu={{
              items: moreItems,
              onClick: ({ key }) => {
                if (key === 'logout') logout();
                else if (key === 'notice') message.info('暂无新公告');
                else if (key === 'help') message.info('帮助中心建设中');
                else if (key === 'plan') message.info('当前为体验版，已解锁全部演示功能');
                else if (key === 'security') message.info('演示环境，无需安全设置');
              },
            }}
          >
            <a className="top-link">
              更多 <DownOutlined style={{ fontSize: 10 }} />
            </a>
          </Dropdown>
        </div>
      </header>

      <div className="app-body">
        <aside className="sider">
          {MENUS.map((group, index) => (
            <div
              key={group.key}
              className={`sider-item ${activeGroup === group.key ? 'active' : ''}`}
              onMouseEnter={() => setFlyout(group.key)}
              onMouseLeave={() => setFlyout(null)}
              onClick={() => (group.items.length === 1 ? go(group.items[0].path) : setFlyout(group.key))}
              style={{ animationDelay: `${index * 20}ms` }}
            >
              <BizIcon name={group.icon} className="sider-icon" />
              <span className="sider-label">{group.label}</span>
            </div>
          ))}
        </aside>

        {flyout ? (
          <div
            className="flyout"
            style={{ top: 56 + MENUS.findIndex((g) => g.key === flyout) * 62 }}
            onMouseEnter={() => setFlyout(flyout)}
            onMouseLeave={() => setFlyout(null)}
          >
            <div className="flyout-title">{MENUS.find((g) => g.key === flyout)?.label}</div>
            {MENUS.find((g) => g.key === flyout)?.items.map((item) => (
              <div
                key={item.path}
                className={`flyout-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => go(item.path)}
              >
                {item.label}
              </div>
            ))}
          </div>
        ) : null}

        <main className="content">
          <Outlet />
        </main>
      </div>

      <div className="app-footer">
        <MoreOutlined style={{ opacity: 0 }} />
        xfannix 5.2.15（仿）
      </div>
    </div>
  );
}
