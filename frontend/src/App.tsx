import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './components/layout/Dashboard'
import AccountPage from './components/accounts/AccountPage'
import TransactionPage from './components/transactions/TransactionPage'
import BudgetPage from './components/budget/BudgetPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="accounts" element={<AccountPage />} />
        <Route path="transactions" element={<TransactionPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="forecast" element={<div className="p-6"><h1 className="text-xl font-semibold">Forecast</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
        <Route path="scenarios" element={<div className="p-6"><h1 className="text-xl font-semibold">Scenarios</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
        <Route path="goals" element={<div className="p-6"><h1 className="text-xl font-semibold">Goals</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
        <Route path="assumptions" element={<div className="p-6"><h1 className="text-xl font-semibold">Assumptions</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
        <Route path="settings" element={<div className="p-6"><h1 className="text-xl font-semibold">Settings</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
      </Route>
    </Routes>
  )
}
