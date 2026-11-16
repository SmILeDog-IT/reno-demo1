import type { ReactNode } from 'react';
import {
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  BookOutlined,
  CalculatorOutlined,
  CreditCardOutlined,
  DatabaseOutlined,
  EditOutlined,
  FileTextOutlined,
  FundOutlined,
  HomeOutlined,
  LineChartOutlined,
  PieChartOutlined,
  ProfileOutlined,
  SettingOutlined,
  ShopOutlined,
  SwapOutlined,
  TagsOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';

const MAP: Record<string, ReactNode> = {
  home: <HomeOutlined />,
  edit: <EditOutlined />,
  manage: <AppstoreOutlined />,
  report: <BarChartOutlined />,
  balance: <FundOutlined />,
  ledger: <ProfileOutlined />,
  settings: <SettingOutlined />,
  flow: <SwapOutlined />,
  voucher: <BookOutlined />,
  profit: <LineChartOutlined />,
  asset: <BankOutlined />,
  cash: <WalletOutlined />,
  tax: <CalculatorOutlined />,
  project: <PieChartOutlined />,
  account: <CreditCardOutlined />,
  counterparty: <TeamOutlined />,
  inventory: <ShopOutlined />,
  category: <TagsOutlined />,
  subject: <DatabaseOutlined />,
  warehouse: <AuditOutlined />,
  file: <FileTextOutlined />,
};

export function BizIcon({ name, className }: { name: string; className?: string }) {
  return <span className={className}>{MAP[name] || <FileTextOutlined />}</span>;
}
