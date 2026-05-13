import { useEffect, useState } from 'react'
import { Plus, Trash2, Package, AlertTriangle, Calendar, User, Pencil } from 'lucide-react'
import api from '../../lib/api'
import { Batch, Recipe, BatchStatus, Priority } from '../../types'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_OPTIONS: BatchStatus[] = ['PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED']
const STATUS_LABELS: Record<BatchStatus, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En Progreso', PAUSED: 'Pausado',
  COMPLETED: 'Completado', CANCELLED: 'Cancelado'
}
const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Baja', color: 'text-gray-500 bg-gray-100' },
  { value: 'NORMAL', label: 'Normal', color: 'text-blue-600 bg-blue-50' },
  { value: 'HIGH', label: 'Alta', color: 'text-orange-600 bg-orange-50' },
  { value: 'URGENT', label: 'Urgente', color: 'text-red-600 bg-red-50' }
]

function PriorityBadge({ priority }: { priority: Priority }) {
  const opt = PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[1]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${opt.color}`}>
      {priority === 'URGENT' && <AlertTriangle size={10} className="inline mr-1" />}
      {opt.label}
    </span>
  )
}

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

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<BatchStatus | ''>('')
  const [form, setForm] = useState<BatchForm>(emptyForm)
  const [saving, setSaving] = useState(false)
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

  function openCreate() {
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.recipeId) { setError('Nombre y receta son requeridos'); return }
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
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error')
    } finally { setSaving(false) }
  }

  async function handleDelete(b: Batch) {
    if (!confirm(`¿Eliminar el lote "${b.name}"?`)) return
    try {
      await api.delete(`/batches/${b.id}`)
      load()
    } catch {
      alert('No se puede eliminar: tiene ejecuciones registradas')
    }
  }

  async function updateStatus(id: string, status: BatchStatus) {
    await api.patch(`/batches/${id}/status`, { status })
    load()
  }

  const filtered = statusFilter ? batches.filter(b => b.status === statusFilter) : batches

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lotes de Producción</h1>
          <p className="text-gray-500 text-sm mt-1">{batches.length} lotes registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nuevo Lote</button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('')} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${!statusFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
          Todos ({batches.length})
        </button>
        {STATUS_OPTIONS.map(s => {
          const count = batches.filter(b => b.status === s).length
          return (
            <button key={s} onClick={() => setStatusFilter(s)} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {STATUS_LABELS[s]} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <Package size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{statusFilter ? 'Sin lotes con este estado' : 'Sin lotes registrados'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => (
            <div key={b.id} className="card px-5 py-4">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-indigo-50 rounded-xl shrink-0"><Package size={18} className="text-indigo-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800">{b.name}</p>
                    <PriorityBadge priority={b.priority} />
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{b.recipe.name}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                    {b.supervisorName && (
                      <span className="flex items-center gap-1"><User size={11} />{b.supervisorName}</span>
                    )}
                    {b.plannedQty && (
                      <span><span className="font-medium text-gray-600">{b.plannedQty}</span> {b.unit || 'unidades'} planificadas</span>
                    )}
                    {b.plannedStartAt && (
                      <span className="flex items-center gap-1"><Calendar size={11} />{format(new Date(b.plannedStartAt), 'dd MMM yyyy', { locale: es })}</span>
                    )}
                    {b.executions && b.executions.length > 0 && (
                      <span>{b.executions.length} ejecución(es)</span>
                    )}
                  </div>
                  {b.notes && <p className="text-xs text-gray-400 mt-1 italic">{b.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {b.status === 'PENDING' && (
                    <select className="text-xs border rounded-lg px-2 py-1.5 bg-white text-gray-600 cursor-pointer" value={b.status} onChange={e => updateStatus(b.id, e.target.value as BatchStatus)}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  )}
                  <button onClick={() => handleDelete(b)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Lote de Producción" size="lg">
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
              <input className="input" value={form.supervisorName} onChange={e => setForm(f => ({ ...f, supervisorName: e.target.value }))} placeholder="Nombre del supervisor" />
            </div>
            <div>
              <label className="label"><Calendar size={12} className="inline mr-1" />Inicio Planificado</label>
              <input type="datetime-local" className="input" value={form.plannedStartAt} onChange={e => setForm(f => ({ ...f, plannedStartAt: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Instrucciones especiales..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Crear Lote'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
