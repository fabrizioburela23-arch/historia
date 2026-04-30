import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Clock, CheckCircle, Package, Cpu } from 'lucide-react'
import api from '../../lib/api'
import { Batch } from '../../types'
import StatusBadge from '../../components/StatusBadge'

export default function OperatorHomePage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)
  const navigate = useNavigate()

  async function load() {
    const { data } = await api.get<Batch[]>('/batches')
    // Show only active batches for the operator
    setBatches(data.filter(b => ['PENDING', 'IN_PROGRESS', 'PAUSED'].includes(b.status)))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleStart(batch: Batch) {
    setStarting(batch.id)
    try {
      // If batch has an active execution, resume it
      if (batch.status === 'IN_PROGRESS' && batch.executions && batch.executions.length > 0) {
        const activeExec = batch.executions.find(e => e.status === 'IN_PROGRESS' || e.status === 'PAUSED')
        if (activeExec) {
          navigate(`/operator/execution/${activeExec.id}`)
          return
        }
      }
      const { data } = await api.post(`/batches/${batch.id}/start`)
      navigate(`/operator/execution/${data.id}`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg || 'Error al iniciar el lote')
    } finally {
      setStarting(null)
    }
  }

  const statusIcon = (status: string) => {
    if (status === 'COMPLETED') return <CheckCircle size={20} className="text-green-500" />
    if (status === 'IN_PROGRESS') return <Clock size={20} className="text-blue-500" />
    return <Package size={20} className="text-gray-400" />
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-indigo-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Lotes de Trabajo</h1>
        <p className="text-gray-500 text-sm mt-1">Selecciona un lote para comenzar o continuar</p>
      </div>

      {batches.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-gray-400">
          <Package size={56} className="mb-4 opacity-20" />
          <p className="text-lg font-medium text-gray-500">Sin lotes pendientes</p>
          <p className="text-sm mt-1">El administrador debe asignarte un lote</p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map(batch => (
            <div key={batch.id} className={`card p-5 flex items-center gap-4 transition-shadow hover:shadow-md ${batch.status === 'IN_PROGRESS' ? 'ring-2 ring-blue-200' : ''}`}>
              <div className={`p-3 rounded-xl shrink-0 ${batch.status === 'IN_PROGRESS' ? 'bg-blue-50' : batch.status === 'PAUSED' ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                {statusIcon(batch.status)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-bold text-gray-900 text-lg">{batch.name}</h2>
                  <StatusBadge status={batch.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    {batch.recipe.name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Cpu size={13} />
                    {batch.machine.name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} />
                    {batch.recipe.targetTimeMinutes || '?'} min estimados
                  </span>
                </div>
                {batch.notes && <p className="text-xs text-gray-400 mt-1 truncate">{batch.notes}</p>}
              </div>

              <button
                onClick={() => handleStart(batch)}
                disabled={starting === batch.id}
                className={`btn-primary shrink-0 px-5 py-2.5 ${batch.status === 'IN_PROGRESS' || batch.status === 'PAUSED' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              >
                {starting === batch.id ? (
                  <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" /> Cargando...</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Play size={16} />
                    {batch.status === 'IN_PROGRESS' ? 'Continuar' : batch.status === 'PAUSED' ? 'Reanudar' : 'Iniciar'}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
