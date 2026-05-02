import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './components/layout/Dashboard'
import AccountPage from './components/accounts/AccountPage'
import TransactionPage from './components/transactions/TransactionPage'
import BudgetPage from './components/budget/BudgetPage'
import ForecastPage from './components/forecast/ForecastPage'
import AssumptionsPage from './components/forecast/AssumptionsPage'
import ScenarioPage from './components/scenarios/ScenarioPage'
import GoalPage from './components/goals/GoalPage'
import CategoriesPage from './components/categories/CategoriesPage'
import ReconciliationPage from './components/reconciliation/ReconciliationPage'
import RecurringPage from './components/recurring/RecurringPage'
import ProfilePage from './components/profiles/ProfilePage'
import InvestmentPage from './components/investments/InvestmentPage'
import SettingsPage from './components/layout/SettingsPage'
import LoginPage from './components/auth/LoginPage'
import { useAuthStore } from './stores/auth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}

export default function App() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="accounts" element={<AccountPage />} />
        <Route path="transactions" element={<TransactionPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="forecast" element={<ForecastPage />} />
        <Route path="scenarios" element={<ScenarioPage />} />
        <Route path="goals" element={<GoalPage />} />
        <Route path="assumptions" element={<AssumptionsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="reconciliation" element={<ReconciliationPage />} />
        <Route path="recurring" element={<RecurringPage />} />
        <Route path="investments" element={<InvestmentPage />} />
        <Route path="profiles" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
