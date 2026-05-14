import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import DashboardPage from './pages/admin/DashboardPage'
import ProductsPage from './pages/admin/ProductsPage'
import ProcessFlowsPage from './pages/admin/ProcessFlowsPage'
import RecipesPage from './pages/admin/RecipesPage'
import BatchesPage from './pages/admin/BatchesPage'
import MachinesPage from './pages/admin/MachinesPage'
import LayoutPage from './pages/admin/LayoutPage'
import UsersPage from './pages/admin/UsersPage'
import OperatorHomePage from './pages/operator/OperatorHomePage'
import BatchExecutionPage from './pages/operator/BatchExecutionPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (user?.role !== 'ADMIN') return <Navigate to="/operator" replace />
  return <>{children}</>
}

export default function App() {
  const { user } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <RequireAuth>
            <Navigate to={user?.role === 'ADMIN' ? '/admin/dashboard' : '/operator'} replace />
          </RequireAuth>
        } />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/admin/dashboard" element={<RequireAdmin><DashboardPage /></RequireAdmin>} />
          <Route path="/admin/products" element={<RequireAdmin><ProductsPage /></RequireAdmin>} />
          <Route path="/admin/flows" element={<RequireAdmin><ProcessFlowsPage /></RequireAdmin>} />
          <Route path="/admin/recipes" element={<RequireAdmin><RecipesPage /></RequireAdmin>} />
          <Route path="/admin/batches" element={<RequireAdmin><BatchesPage /></RequireAdmin>} />
          <Route path="/admin/machines" element={<RequireAdmin><MachinesPage /></RequireAdmin>} />
          <Route path="/admin/layout" element={<RequireAdmin><LayoutPage /></RequireAdmin>} />
          <Route path="/admin/users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
          <Route path="/operator" element={<OperatorHomePage />} />
          <Route path="/operator/batch/:id" element={<BatchExecutionPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
