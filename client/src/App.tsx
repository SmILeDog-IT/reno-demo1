import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import { BootstrapProvider } from './context';
import { api } from './api';
import Home from './pages/Home';
import Login from './pages/Login';
import FlowEntry from './pages/FlowEntry';
import FlowList from './pages/FlowList';
import VoucherList from './pages/VoucherList';
import ProfitReport from './pages/reports/ProfitReport';
import BalanceSheet from './pages/reports/BalanceSheet';
import CashFlow from './pages/reports/CashFlow';
import TaxReport from './pages/reports/TaxReport';
import ProjectProfit from './pages/reports/ProjectProfit';
import AccountBalance from './pages/balances/AccountBalance';
import SubjectBalance from './pages/balances/SubjectBalance';
import DimensionBalance from './pages/balances/DimensionBalance';
import TypeBalance from './pages/balances/TypeBalance';
import Ledger from './pages/ledgers/Ledger';
import MasterData from './pages/settings/MasterData';
import Categories from './pages/settings/Categories';
import Subjects from './pages/settings/Subjects';
import Closing from './pages/settings/Closing';

function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const token = localStorage.getItem('xf_token');
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default function App() {
  const [booted, setBooted] = useState(!!localStorage.getItem('xf_token'));

  useEffect(() => {
    if (booted) return;
    if (window.location.hash.includes('/login')) {
      setBooted(true);
      return;
    }
    api
      .post<{ token: string }>('/login', { phone: '13800000000', password: '123456' })
      .then((res) => {
        localStorage.setItem('xf_token', res.token);
      })
      .catch(() => {})
      .finally(() => setBooted(true));
  }, [booted]);

  if (!booted) return <div className="boot-screen">正在进入演示账套…</div>;

  return (
    <BootstrapProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/entry" element={<FlowEntry />} />
          <Route path="/flows" element={<FlowList />} />
          <Route path="/vouchers" element={<VoucherList />} />
          <Route path="/reports/profit" element={<ProfitReport />} />
          <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
          <Route path="/reports/cash-flow" element={<CashFlow />} />
          <Route path="/reports/tax" element={<TaxReport />} />
          <Route path="/reports/project-profit" element={<ProjectProfit />} />
          <Route path="/balances/account" element={<AccountBalance />} />
          <Route path="/balances/subject" element={<SubjectBalance />} />
          <Route path="/balances/type" element={<TypeBalance />} />
          <Route path="/balances/:dim" element={<DimensionBalance />} />
          <Route path="/ledgers/:dim" element={<Ledger />} />
          <Route path="/settings/categories" element={<Categories />} />
          <Route path="/settings/subjects" element={<Subjects />} />
          <Route path="/settings/closing" element={<Closing />} />
          <Route path="/settings/:resource" element={<MasterData />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BootstrapProvider>
  );
}
