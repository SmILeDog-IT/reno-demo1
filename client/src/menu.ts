export interface MenuItem {
  path: string;
  label: string;
}

export interface MenuGroup {
  key: string;
  label: string;
  icon: string;
  items: MenuItem[];
}

export const MENUS: MenuGroup[] = [
  { key: 'home', label: '首页', icon: 'home', items: [{ path: '/', label: '首页' }] },
  { key: 'entry', label: '录入', icon: 'edit', items: [{ path: '/entry', label: '录入流水' }] },
  {
    key: 'manage',
    label: '管理',
    icon: 'manage',
    items: [
      { path: '/flows', label: '流水管理' },
      { path: '/vouchers', label: '凭证管理' },
    ],
  },
  {
    key: 'report',
    label: '报表',
    icon: 'report',
    items: [
      { path: '/reports/profit', label: '利润表' },
      { path: '/reports/balance-sheet', label: '资产负债表' },
      { path: '/reports/cash-flow', label: '现金流量表' },
      { path: '/reports/tax', label: '应交税费表' },
      { path: '/reports/project-profit', label: '阿米巴损益表' },
    ],
  },
  {
    key: 'balance',
    label: '余额表',
    icon: 'balance',
    items: [
      { path: '/balances/account', label: '账户余额表' },
      { path: '/balances/counterparty', label: '往来余额表' },
      { path: '/balances/project', label: '项目余额表' },
      { path: '/balances/inventory', label: '存货余额表' },
      { path: '/balances/category', label: '收支余额表' },
      { path: '/balances/type', label: '类型余额表' },
      { path: '/balances/subject', label: '科目余额表' },
    ],
  },
  {
    key: 'ledger',
    label: '明细表',
    icon: 'ledger',
    items: [
      { path: '/ledgers/account', label: '账户明细表' },
      { path: '/ledgers/counterparty', label: '往来明细表' },
      { path: '/ledgers/project', label: '项目明细表' },
      { path: '/ledgers/inventory', label: '存货明细表' },
      { path: '/ledgers/category', label: '收支明细表' },
      { path: '/ledgers/type', label: '类型明细表' },
      { path: '/ledgers/subject', label: '科目明细表' },
    ],
  },
  {
    key: 'settings',
    label: '设置',
    icon: 'settings',
    items: [
      { path: '/settings/accounts', label: '账户设置' },
      { path: '/settings/counterparties', label: '往来设置' },
      { path: '/settings/projects', label: '项目设置' },
      { path: '/settings/inventories', label: '存货设置' },
      { path: '/settings/warehouses', label: '仓库设置' },
      { path: '/settings/categories', label: '流水类别' },
      { path: '/settings/subjects', label: '科目设置' },
      { path: '/settings/closing', label: '结账' },
    ],
  },
];

export const PATH_LABELS: Record<string, string> = MENUS.reduce((acc, group) => {
  group.items.forEach((item) => {
    acc[item.path] = item.label;
  });
  return acc;
}, {} as Record<string, string>);

export function groupOf(path: string) {
  return MENUS.find((g) => g.items.some((i) => i.path === path));
}
