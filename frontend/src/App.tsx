import { Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Layout from './components/layout/Layout'
import Dashboard from './components/layout/Dashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="accounts" element={<div className="p-6"><h1 className="text-xl font-semibold">Accounts</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
        <Route path="transactions" element={<div className="p-6"><h1 className="text-xl font-semibold">Transactions</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
        <Route path="budget" element={<div className="p-6"><h1 className="text-xl font-semibold">Budget</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
        <Route path="forecast" element={<div className="p-6"><h1 className="text-xl font-semibold">Forecast</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
        <Route path="scenarios" element={<div className="p-6"><h1 className="text-xl font-semibold">Scenarios</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
        <Route path="goals" element={<div className="p-6"><h1 className="text-xl font-semibold">Goals</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
        <Route path="assumptions" element={<div className="p-6"><h1 className="text-xl font-semibold">Assumptions</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
        <Route path="settings" element={<div className="p-6"><h1 className="text-xl font-semibold">Settings</h1><p className="text-surface-400 mt-2">Coming soon</p></div>} />
      </Route>
    </Routes>
  )
}
