import { useEffect, useState } from 'react'
import { Package, Clock, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../../lib/api'
import { DashboardMetrics } from '../../types'
import StatusBadge from '../../components/StatusBadge'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<DashboardMetrics>('/dashboard/metrics')
      .then(r => setMetrics(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )

  if (!metrics) return null

  const effValue = parseFloat(metrics.avgEfficiency)
  const oeeColor = effValue >= 85 ? 'text-green-600' : effValue >= 65 ? 'text-yellow-500' : 'text-red-600'

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visión general del piso de producción</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de Lotes" value={metrics.totalBatches} icon={Package} color="bg-indigo-500" />
        <StatCard label="En Progreso" value={metrics.inProgressBatches} icon={Clock} color="bg-blue-500" />
        <StatCard label="Completados" value={metrics.completedBatches} icon={CheckCircle} color="bg-green-500" />
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500">
            <TrendingUp size={22} className="text-white" />
          </div>
          <div>
            <p className={`text-2xl font-bold ${oeeColor}`}>{metrics.avgEfficiency}%</p>
            <p className="text-sm text-gray-500">Eficiencia Promedio (OEE)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Efficiency Chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Tiempo Real vs Estimado (últimas ejecuciones)</h2>
          {metrics.efficiencyChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <AlertTriangle size={32} className="mb-2 opacity-50" />
              <p className="text-sm">Sin datos de ejecuciones completadas</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metrics.efficiencyChart.map((e, i) => ({
                name: `Ejec. ${i + 1}`,
                real: parseFloat(e.actualMinutes),
                objetivo: e.targetMinutes
              }))}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit=" min" />
                <Tooltip formatter={(v: number) => [`${v} min`]} />
                <Legend />
                <Bar dataKey="real" name="Tiempo Real" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="objetivo" name="Tiempo Objetivo" fill="#d1d5db" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bottleneck steps */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Pasos con Mayor Tiempo Promedio</h2>
          {metrics.opStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <AlertTriangle size={32} className="mb-2 opacity-50" />
              <p className="text-sm">Sin datos disponibles</p>
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.opStats.map(s => {
                const ratio = s.targetMin > 0 ? parseFloat(s.avgManHours) * 60 / s.targetMin : 0
                const barColor = ratio <= 1 ? 'bg-green-400' : ratio <= 1.3 ? 'bg-yellow-400' : 'bg-red-400'
                return (
                  <div key={s.stepId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 truncate">{s.stepName}</span>
                      <span className="text-gray-500 text-xs ml-2 shrink-0">{(parseFloat(s.avgManHours) * 60).toFixed(0)}' / {s.targetMin}'</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Executions */}
      <div className="card">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Ejecuciones Recientes</h2>
        </div>
        {metrics.recentExecutions.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">No hay ejecuciones registradas</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {metrics.recentExecutions.map(exec => (
              <div key={exec.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{exec.batch.name}</p>
                  <p className="text-xs text-gray-500">{exec.batch.recipe.name} · {exec.user.name}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={exec.status} />
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(exec.startedAt), { addSuffix: true, locale: es })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
