import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Clock, CheckCircle, Package, Cpu, Plus, AlertTriangle, Calendar, User, X } from 'lucide-react'
import api from '../../lib/api'
import { Batch, Recipe, Machine, Priority } from '../../types'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'Baja' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' }
]

interface BatchForm {
  name: string; recipeId: string; machineId: string; notes: string
  priority: Priority; plannedQty: string; unit: string
  supervisorName: string; plannedStartAt: string
}

export default function OperatorHomePage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<BatchForm>({
    name: '', recipeId: '', machineId: '', notes: '',
    priority: 'NORMAL', plannedQty: '', unit: '', supervisorName: '', plannedStartAt: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function load() {
    const [batchRes, recipeRes, machineRes] = await Promise.all([
      api.get<Batch[]>('/batches'),
      api.get<Recipe[]>('/recipes'),
      api.get<Machine[]>('/machines')
    ])
    setBatches(batchRes.data.filter(b => ['PENDING', 'IN_PROGRESS', 'PAUSED'].includes(b.status)))
    setRecipes(recipeRes.data)
    setMachines(machineRes.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleStart(batch: Batch) {
    setStarting(batch.id)
    try {
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

  function openCreateBatch() {
    setForm({
      name: `LOTE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      recipeId: '', machineId: '', notes: '',
      priority: 'NORMAL', plannedQty: '', unit: '', supervisorName: '', plannedStartAt: ''
    })
    setError('')
    setModalOpen(true)
  }

  async function handleCreateBatch() {
    if (!form.name || !form.recipeId || !form.machineId) {
      setError('Nombre, flujo y máquina son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/batches', {
        ...form,
        plannedQty: form.plannedQty ? parseFloat(form.plannedQty) : undefined,
        plannedStartAt: form.plannedStartAt || undefined
      })
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al crear lote')
    } finally { setSaving(false) }
  }

  const priorityColor = (p: Priority) => ({
    LOW: 'text-gray-500', NORMAL: 'text-blue-600', HIGH: 'text-orange-500', URGENT: 'text-red-600'
  }[p] || 'text-gray-500')

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Lotes de Trabajo</h1>
          <p className="text-gray-500 text-sm mt-1">Selecciona un lote para comenzar o crea uno nuevo</p>
        </div>
        <button onClick={openCreateBatch} className="btn-primary">
          <Plus size={16} /> Crear Lote
        </button>
      </div>

      {batches.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-gray-400">
          <Package size={56} className="mb-4 opacity-20" />
          <p className="text-lg font-medium text-gray-500">Sin lotes pendientes</p>
          <p className="text-sm mt-1">Crea un lote nuevo o espera que el administrador te asigne uno</p>
          <button onClick={openCreateBatch} className="btn-primary mt-4">
            <Plus size={16} /> Crear mi primer lote
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Urgent batches first */}
          {batches
            .sort((a, b) => {
              const order = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 }
              return (order[a.priority] ?? 2) - (order[b.priority] ?? 2)
            })
            .map(batch => (
              <div
                key={batch.id}
                className={`card p-5 flex items-center gap-4 transition-shadow hover:shadow-md ${
                  batch.status === 'IN_PROGRESS' ? 'ring-2 ring-blue-200' : ''
                } ${batch.priority === 'URGENT' ? 'border-red-200' : ''}`}
              >
                <div className={`p-3 rounded-xl shrink-0 ${
                  batch.status === 'IN_PROGRESS' ? 'bg-blue-50' :
                  batch.status === 'PAUSED' ? 'bg-yellow-50' : 'bg-gray-50'
                }`}>
                  {statusIcon(batch.status)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="font-bold text-gray-900">{batch.name}</h2>
                    <StatusBadge status={batch.status} />
                    {batch.priority && batch.priority !== 'NORMAL' && (
                      <span className={`text-xs font-medium ${priorityColor(batch.priority)}`}>
                        {batch.priority === 'URGENT' && <AlertTriangle size={11} className="inline mr-0.5" />}
                        {PRIORITY_OPTIONS.find(p => p.value === batch.priority)?.label}
                      </span>
                    )}
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
                    {batch.plannedQty && (
                      <span className="flex items-center gap-1.5">
                        <Package size={13} />
                        {batch.plannedQty} {batch.unit}
                      </span>
                    )}
                    {batch.supervisorName && (
                      <span className="flex items-center gap-1.5">
                        <User size={13} />
                        {batch.supervisorName}
                      </span>
                    )}
                    {batch.plannedStartAt && (
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        {new Date(batch.plannedStartAt).toLocaleDateString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  {batch.notes && <p className="text-xs text-gray-400 mt-1 truncate">{batch.notes}</p>}
                </div>

                <button
                  onClick={() => handleStart(batch)}
                  disabled={starting === batch.id}
                  className={`btn-primary shrink-0 px-5 py-2.5 ${
                    batch.status === 'IN_PROGRESS' || batch.status === 'PAUSED' ? 'bg-blue-600 hover:bg-blue-700' :
                    batch.priority === 'URGENT' ? 'bg-red-600 hover:bg-red-700' : ''
                  }`}
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

      {/* Create Batch Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Crear Nuevo Lote" size="lg">
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              <X size={14} />{error}
            </div>
          )}

          <div>
            <label className="label">Código de Lote *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: LOTE-20240101-001" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Flujo de Producción *</label>
              <select className="input" value={form.recipeId} onChange={e => setForm(f => ({ ...f, recipeId: e.target.value }))}>
                <option value="">— Seleccionar flujo —</option>
                {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Máquina *</label>
              <select className="input" value={form.machineId} onChange={e => setForm(f => ({ ...f, machineId: e.target.value }))}>
                <option value="">— Seleccionar máquina —</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id} disabled={m.status === 'MAINTENANCE'}>
                    {m.name} ({m.code}){m.status === 'MAINTENANCE' ? ' [EN MANTENIMIENTO]' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Prioridad</label>
              <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
                {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cantidad</label>
              <input type="number" className="input" value={form.plannedQty} min={0} step={0.01} onChange={e => setForm(f => ({ ...f, plannedQty: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="label">Unidad</label>
              <input className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="kg, L, unid..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1"><User size={12} />Encargado</label>
              <input className="input" value={form.supervisorName} onChange={e => setForm(f => ({ ...f, supervisorName: e.target.value }))} placeholder="Tu nombre o encargado..." />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Calendar size={12} />Inicio Planificado</label>
              <input type="datetime-local" className="input" value={form.plannedStartAt} onChange={e => setForm(f => ({ ...f, plannedStartAt: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Notas / Observaciones</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones del lote..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleCreateBatch} disabled={saving} className="btn-primary">
              {saving ? 'Creando...' : 'Crear Lote'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
