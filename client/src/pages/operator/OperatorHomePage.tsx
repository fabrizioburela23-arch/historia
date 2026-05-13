import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Clock, CheckCircle, Package, Plus, AlertTriangle, Calendar, User, X } from 'lucide-react'
import api from '../../lib/api'
import { Batch, Recipe, Priority } from '../../types'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'Baja' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' }
]

interface BatchForm {
  name: string
  recipeId: string
  notes: string
  priority: Priority
  plannedQty: string
  unit: string
  supervisorName: string
  plannedStartAt: string
}

const emptyForm: BatchForm = {
  name: '', recipeId: '', notes: '', priority: 'NORMAL',
  plannedQty: '', unit: '', supervisorName: '', plannedStartAt: ''
}

export default function OperatorHomePage() {
  const navigate = useNavigate()
  const [batches, setBatches] = useState<Batch[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<BatchForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    const [b, r] = await Promise.all([
      api.get<Batch[]>('/batches'),
      api.get<Recipe[]>('/recipes')
    ])
    setBatches(b.data)
    setRecipes(r.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!form.name || !form.recipeId) { setError('Nombre y receta son requeridos'); return }
    setSaving(true)
    try {
      await api.post('/batches', {
        ...form,
        plannedQty: form.plannedQty ? parseFloat(form.plannedQty) : undefined,
        plannedStartAt: form.plannedStartAt || undefined
      })
      setCreating(false)
      setForm(emptyForm)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error')
    } finally { setSaving(false) }
  }

  async function handleStart(batchId: string) {
    setStarting(batchId)
    try {
      const { data } = await api.post(`/batches/${batchId}/start`)
      navigate(`/operator/execution/${data.id}`)
    } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al iniciar')
    } finally { setStarting(null) }
  }

  function openCreate() {
    setForm(emptyForm)
    setError('')
    setCreating(true)
  }

  const pending = batches.filter(b => b.status === 'PENDING')
  const inProgress = batches.filter(b => b.status === 'IN_PROGRESS')
  const recent = batches.filter(b => b.status === 'COMPLETED' || b.status === 'CANCELLED').slice(0, 5)

  function PriorityDot({ priority }: { priority: Priority }) {
    const colors: Record<Priority, string> = { LOW: 'bg-gray-300', NORMAL: 'bg-blue-400', HIGH: 'bg-orange-400', URGENT: 'bg-red-500' }
    return <span className={`inline-block w-2 h-2 rounded-full ${colors[priority]}`} />
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel del Operario</h1>
          <p className="text-gray-500 text-sm mt-1">{inProgress.length} en proceso · {pending.length} pendientes</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nuevo Lote</button>
      </div>

      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
      ) : (
        <>
          {/* In progress */}
          {inProgress.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">En Proceso</h2>
              <div className="space-y-3">
                {inProgress.map(b => (
                  <div key={b.id} className="card px-5 py-4 border-l-4 border-l-indigo-500">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg shrink-0"><Package size={16} className="text-indigo-600" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800">{b.name}</p>
                          <PriorityDot priority={b.priority} />
                        </div>
                        <p className="text-xs text-gray-500">{b.recipe.name}</p>
                        {b.executions && b.executions.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">{b.executions.length} ejecución(es) activa(s)</p>
                        )}
                      </div>
                      <button
                        onClick={() => b.executions?.[0] && navigate(`/operator/execution/${b.executions[0].id}`)}
                        className="btn-primary shrink-0"
                      >
                        <Play size={14} /> Continuar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Pendientes</h2>
              <div className="space-y-3">
                {pending.map(b => (
                  <div key={b.id} className="card px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gray-50 rounded-lg shrink-0"><Package size={16} className="text-gray-400" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800">{b.name}</p>
                          <PriorityDot priority={b.priority} />
                          {b.priority === 'URGENT' && <span className="text-xs text-red-600 flex items-center gap-0.5"><AlertTriangle size={10} />Urgente</span>}
                        </div>
                        <p className="text-xs text-gray-500">{b.recipe.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          {b.supervisorName && <span className="flex items-center gap-1"><User size={10} />{b.supervisorName}</span>}
                          {b.plannedStartAt && <span className="flex items-center gap-1"><Calendar size={10} />{format(new Date(b.plannedStartAt), 'dd MMM', { locale: es })}</span>}
                          {b.plannedQty && <span>{b.plannedQty} {b.unit}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleStart(b.id)}
                        disabled={starting === b.id}
                        className="btn-primary shrink-0"
                      >
                        <Play size={14} /> {starting === b.id ? 'Iniciando...' : 'Iniciar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent */}
          {recent.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recientes</h2>
              <div className="space-y-2">
                {recent.map(b => (
                  <div key={b.id} className="card px-4 py-3 flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg shrink-0 ${b.status === 'COMPLETED' ? 'bg-green-50' : 'bg-gray-50'}`}>
                      {b.status === 'COMPLETED' ? <CheckCircle size={14} className="text-green-600" /> : <X size={14} className="text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{b.name}</p>
                      <p className="text-xs text-gray-400">{b.recipe.name}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {batches.length === 0 && (
            <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
              <Package size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Sin lotes asignados</p>
              <button onClick={openCreate} className="btn-secondary mt-4 text-sm"><Plus size={14} /> Crear primer lote</button>
            </div>
          )}
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo Lote de Producción" size="lg">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre del Lote *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: LOTE-2025-001" />
            </div>
            <div>
              <label className="label">Prioridad</label>
              <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
                {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Receta *</label>
            <select className="input" value={form.recipeId} onChange={e => {
              const recipe = recipes.find(r => r.id === e.target.value)
              setForm(f => ({ ...f, recipeId: e.target.value, unit: recipe?.yieldUnit || f.unit }))
            }}>
              <option value="">— Seleccionar receta —</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name} (v{r.version})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cantidad Planificada</label>
              <input type="number" min="0" step="0.01" className="input" value={form.plannedQty} onChange={e => setForm(f => ({ ...f, plannedQty: e.target.value }))} placeholder="Opcional" />
            </div>
            <div>
              <label className="label">Unidad</label>
              <input className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="kg, unidades..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label"><User size={12} className="inline mr-1" />Supervisor</label>
              <input className="input" value={form.supervisorName} onChange={e => setForm(f => ({ ...f, supervisorName: e.target.value }))} placeholder="Nombre supervisor" />
            </div>
            <div>
              <label className="label"><Calendar size={12} className="inline mr-1" />Inicio Planificado</label>
              <input type="datetime-local" className="input" value={form.plannedStartAt} onChange={e => setForm(f => ({ ...f, plannedStartAt: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Instrucciones..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCreating(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary">{saving ? 'Creando...' : 'Crear Lote'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
