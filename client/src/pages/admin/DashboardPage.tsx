import { useEffect, useState } from 'react'
import { Package, Clock, CheckCircle2, AlertCircle, Gauge, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '../../lib/api'
import { DashboardMetrics } from '../../types'
import StatusBadge from '../../components/StatusBadge'

function KPI({ icon: Icon, label, value, color, suffix }: any) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
          <p className="text-3xl font-bold mt-2">{value}{suffix}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  )
}

function OEEBar({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0
  const color = v >= 85 ? 'bg-green-500' : v >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{value !== null ? `${value.toFixed(1)}%` : '—'}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, v)}%` }} />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [m, setM] = useState<DashboardMetrics | null>(null)

  useEffect(() => {
    api.get<DashboardMetrics>('/dashboard/metrics').then(r => setM(r.data))
  }, [])

  if (!m) return <div className="p-6 text-gray-400">Cargando métricas...</div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visión general de producción y rendimiento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={Package} label="Total Lotes" value={m.counts.totalBatches} color="bg-gray-700" />
        <KPI icon={Clock} label="Pendientes" value={m.counts.pendingBatches} color="bg-gray-500" />
        <KPI icon={AlertCircle} label="En Proceso" value={m.counts.inProgressBatches} color="bg-blue-500" />
        <KPI icon={CheckCircle2} label="Completados" value={m.counts.completedBatches} color="bg-green-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gauge size={18} className="text-indigo-600" />
            <h2 className="font-semibold">OEE</h2>
          </div>
          <p className="text-5xl font-bold text-indigo-600">{m.oee !== null ? `${m.oee.toFixed(1)}%` : '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Disponibilidad × Performance × Calidad</p>
          <div className="mt-4 space-y-3">
            <OEEBar label="Disponibilidad" value={m.availability} />
            <OEEBar label="Performance" value={m.performance} />
            <OEEBar label="Calidad" value={m.quality} />
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-green-600" />
            <h2 className="font-semibold">Rendimiento por lote (últimos completados)</h2>
          </div>
          {m.yieldChart.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Sin lotes completados aún</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={m.yieldChart}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 110]} />
                <Tooltip />
                <Bar dataKey="yield" radius={[4, 4, 0, 0]}>
                  {m.yieldChart.map((d, i) => (
                    <Cell key={i} fill={d.yield >= 80 ? '#22c55e' : d.yield >= 60 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Rendimiento histórico por flujo</h2>
          {m.flowYields.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Sin datos históricos</p>
          ) : (
            <ul className="space-y-2">
              {m.flowYields.map(fy => (
                <li key={fy.flowId} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                  <div>
                    <p className="font-medium">{fy.flowName}</p>
                    <p className="text-xs text-gray-400">{fy.runs} corridas</p>
                  </div>
                  <span className={`font-mono text-sm ${fy.avgYield && parseFloat(fy.avgYield) >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
                    {fy.avgYield ? `${fy.avgYield}%` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-3">Lotes recientes</h2>
          {m.recentBatches.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Sin lotes</p>
          ) : (
            <ul className="divide-y">
              {m.recentBatches.map(b => (
                <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{b.name}</p>
                    <p className="text-xs text-gray-400">{b.mode === 'RECIPE' ? `Receta: ${b.recipeName || ''}` : 'Monoelemento'}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
