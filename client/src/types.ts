export interface Book {
  id: number;
  name: string;
  version: string;
  company: string;
  tax_no: string;
  start_month: string;
}

export interface User {
  id: number;
  name: string;
  phone: string;
  role: string;
}

export interface Subject {
  id: number;
  code: string;
  name: string;
  category: string;
  direction: string;
  parent_id: number | null;
  report_line: string | null;
  enabled: number;
  children?: Subject[];
}

export interface Account {
  id: number;
  name: string;
  nature: string;
  tag: string | null;
  subject_id: number | null;
  enabled: number;
}

export interface Counterparty {
  id: number;
  name: string;
  type: string;
  contact?: string | null;
  phone?: string | null;
  note?: string | null;
}

export interface Project {
  id: number;
  name: string;
  note?: string | null;
}

export interface Warehouse {
  id: number;
  name: string;
}

export interface Inventory {
  id: number;
  name: string;
  spec?: string | null;
  unit?: string | null;
  warehouse_id?: number | null;
}

export interface Category {
  id: number;
  name: string;
  group_name: string | null;
  direction: string;
  parent_id: number | null;
  subject_id: number | null;
  offset_subject_id: number | null;
  report_line: string | null;
  internal: number;
  sort: number;
  children?: Category[];
}

export interface Flow {
  id: number;
  date: string;
  no: number;
  category_id: number;
  category_name?: string;
  group_name?: string | null;
  report_line?: string | null;
  summary: string;
  type: string;
  amount: number;
  account_id: number | null;
  account_name?: string | null;
  counterparty_id: number | null;
  counterparty_name?: string | null;
  project_id: number | null;
  project_name?: string | null;
  inventory_id: number | null;
  inventory_name?: string | null;
  quantity: number | null;
  settle_type: string | null;
  settled: number;
  status: string;
  creator: string;
  auditor: string | null;
  audited_at: string | null;
  created_at: string;
}

export interface VoucherItem {
  id: number;
  voucher_id: number;
  summary: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  debit: number;
  credit: number;
}

export interface Voucher {
  id: number;
  date: string;
  no: number;
  summary: string;
  source_flow_no: number;
  status: string;
  items: VoucherItem[];
  debit: number;
  credit: number;
}

export interface Bootstrap {
  book: Book;
  users: User[];
  accounts: Account[];
  counterparties: Counterparty[];
  projects: Project[];
  inventories: Inventory[];
  warehouses: Warehouse[];
  subjects: Subject[];
  categories: Category[];
  period: string;
}

export interface ProfitRow {
  name: string;
  value: number;
  ratio: number;
  ytdValue: number;
  ytdRatio: number;
  diff: number;
  bold?: boolean;
}
