import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutDashboard, Cpu, GitBranch, Package, Map, Factory,
  LogOut, ChevronRight, User, FlaskConical, Boxes, Users
} from 'lucide-react'

const adminNav = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/products', icon: Boxes, label: 'Productos' },
  { to: '/admin/flows', icon: GitBranch, label: 'Flujos de Proceso' },
  { to: '/admin/recipes', icon: FlaskConical, label: 'Recetas' },
  { to: '/admin/batches', icon: Package, label: 'Lotes' },
  { to: '/admin/machines', icon: Cpu, label: 'Máquinas' },
  { to: '/admin/layout', icon: Map, label: 'Layout Planta' },
  { to: '/admin/users', icon: Users, label: 'Usuarios' }
]

const operatorNav = [
  { to: '/operator', icon: Package, label: 'Mis Lotes' }
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const nav = user?.role === 'ADMIN' ? adminNav : operatorNav

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="w-64 flex flex-col bg-gray-900 text-white shrink-0">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-700">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Factory size={20} />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">MES Pro</p>
            <p className="text-xs text-gray-400">Sistema de Manufactura</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={14} className="ml-auto opacity-50" />
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="p-1.5 bg-gray-700 rounded-full">
              <User size={16} className="text-gray-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-gray-400">{user?.role === 'ADMIN' ? 'Administrador' : 'Operario'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
