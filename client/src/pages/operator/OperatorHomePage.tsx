import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Workflow, Layers, ArrowRight } from 'lucide-react'
import api from '../../lib/api'
import { Batch } from '../../types'
import StatusBadge from '../../components/StatusBadge'

export default function OperatorHomePage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get<Batch[]>('/batches').then(r => setBatches(r.data))
  }, [])

  const active = batches.filter(b => b.status === 'PENDING' || b.status === 'IN_PROGRESS')
  const recent = batches.filter(b => b.status === 'COMPLETED').slice(0, 6)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Lotes</h1>
        <p className="text-gray-500 text-sm mt-1">Lotes activos y pendientes de ejecución</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Activos / Pendientes</h2>
        {active.length === 0 ? (
          <div className="card p-10 text-center text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">No hay lotes activos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map(b => (
              <button key={b.id} onClick={() => navigate(`/operator/batch/${b.id}`)}
                className="card p-4 text-left hover:shadow-md hover:border-indigo-300 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {b.mode === 'RECIPE' ? <Layers size={14} className="text-indigo-500"/> : <Workflow size={14} className="text-indigo-500"/>}
                    <span className="font-semibold">{b.name}</span>
                  </div>
                  <StatusBadge status={b.status}/>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {b.recipe?.name || b.flows[0]?.flow?.name || '—'}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {b.flows.filter(f => f.status === 'COMPLETED').length}/{b.flows.length} flujos
                  </span>
                  <ArrowRight size={14} className="text-indigo-500"/>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Completados recientes</h2>
          <div className="card divide-y">
            {recent.map(b => (
              <button key={b.id} onClick={() => navigate(`/operator/batch/${b.id}`)}
                className="w-full text-left flex items-center justify-between p-3 hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm">{b.name}</p>
                  <p className="text-xs text-gray-500">{b.recipe?.name || b.flows[0]?.flow?.name}</p>
                </div>
                <StatusBadge status={b.status}/>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
