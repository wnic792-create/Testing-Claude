import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './components/layout/Dashboard'
import AccountPage from './components/accounts/AccountPage'
import TransactionPage from './components/transactions/TransactionPage'
import BudgetPage from './components/budget/BudgetPage'
import ForecastPage from './components/forecast/ForecastPage'
import AssumptionsPage from './components/forecast/AssumptionsPage'
import ScenarioPage from './components/scenarios/ScenarioPage'
import GoalPage from './components/goals/GoalPage'
import SettingsPage from './components/layout/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="accounts" element={<AccountPage />} />
        <Route path="transactions" element={<TransactionPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="forecast" element={<ForecastPage />} />
        <Route path="scenarios" element={<ScenarioPage />} />
        <Route path="goals" element={<GoalPage />} />
        <Route path="assumptions" element={<AssumptionsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
