import { useEffect, useState } from 'react'
import { Plus, Trash2, Package, Filter, User, Calendar, AlertTriangle, Cpu } from 'lucide-react'
import api from '../../lib/api'
import { Batch, Recipe, Machine, BatchStatus, Priority } from '../../types'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_OPTIONS: BatchStatus[] = ['PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED']
const STATUS_LABELS: Record<BatchStatus, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En Progreso', PAUSED: 'Pausado',
  COMPLETED: 'Completado', CANCELLED: 'Cancelado'
}
const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Baja', color: 'text-gray-500 bg-gray-50' },
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
  name: string; recipeId: string; machineId: string; notes: string
  priority: Priority; plannedQty: string; unit: string
  supervisorName: string; plannedStartAt: string; plannedEndAt: string
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<BatchForm>({
    name: '', recipeId: '', machineId: '', notes: '',
    priority: 'NORMAL', plannedQty: '', unit: '',
    supervisorName: '', plannedStartAt: '', plannedEndAt: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [b, r, m] = await Promise.all([
      api.get<Batch[]>('/batches'),
      api.get<Recipe[]>('/recipes'),
      api.get<Machine[]>('/machines')
    ])
    setBatches(b.data)
    setRecipes(r.data)
    setMachines(m.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setForm({
      name: '', recipeId: '', machineId: '', notes: '',
      priority: 'NORMAL', plannedQty: '', unit: '',
      supervisorName: '', plannedStartAt: '', plannedEndAt: ''
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.recipeId || !form.machineId) { setError('Nombre, flujo y máquina son requeridos'); return }
    setSaving(true)
    try {
      await api.post('/batches', {
        ...form,
        plannedQty: form.plannedQty ? parseFloat(form.plannedQty) : undefined,
        plannedStartAt: form.plannedStartAt || undefined,
        plannedEndAt: form.plannedEndAt || undefined
      })
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error')
    } finally { setSaving(false) }
  }

  async function handleDelete(b: Batch) {
    if (!confirm(`¿Eliminar el lote "${b.name}"?`)) return
    await api.delete(`/batches/${b.id}`)
    load()
  }

  async function handleStatusChange(b: Batch, status: BatchStatus) {
    await api.put(`/batches/${b.id}`, { status })
    load()
  }

  const filtered = filter === 'ALL' ? batches : batches.filter(b => b.status === filter)

  const activeMachines = machines.filter(m => m.status === 'ACTIVE' || !m.status)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lotes de Producción</h1>
          <p className="text-gray-500 text-sm mt-1">{batches.length} lotes registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Nuevo Lote
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={15} className="text-gray-400" />
        {(['ALL', ...STATUS_OPTIONS] as string[]).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}
          >
            {s === 'ALL' ? 'Todos' : STATUS_LABELS[s as BatchStatus]}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <Package size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Sin lotes{filter !== 'ALL' ? ' con este estado' : ''}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Lote</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Flujo</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Máquina</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Prioridad</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Cant. / Encargado</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Creado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800">{b.name}</p>
                    {b.plannedStartAt && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={10} />
                        {format(new Date(b.plannedStartAt), 'dd/MM/yy HH:mm')}
                      </p>
                    )}
                    {b.notes && <p className="text-xs text-gray-400 truncate max-w-xs">{b.notes}</p>}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{b.recipe.name}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Cpu size={13} className="text-gray-400" />
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{b.machine.code}</span>
                      {b.machine.status === 'MAINTENANCE' && (
                        <span className="text-xs text-orange-600 bg-orange-50 px-1 py-0.5 rounded">Mant.</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3"><PriorityBadge priority={b.priority || 'NORMAL'} /></td>
                  <td className="px-5 py-3">
                    <div className="space-y-0.5">
                      {b.plannedQty && (
                        <p className="text-xs text-gray-600">
                          {b.actualQty !== undefined && b.actualQty !== null
                            ? <><span className="font-medium">{b.actualQty}</span>/{b.plannedQty} {b.unit}</>
                            : <>{b.plannedQty} {b.unit} planeado</>
                          }
                        </p>
                      )}
                      {b.supervisorName && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <User size={10} />{b.supervisorName}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={b.status}
                      onChange={e => handleStatusChange(b, e.target.value as BatchStatus)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{formatDistanceToNow(new Date(b.createdAt), { addSuffix: true, locale: es })}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <button onClick={() => handleDelete(b)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Lote de Producción" size="lg">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre / Código del Lote *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: LOTE-2024-001" />
            </div>
            <div>
              <label className="label">Flujo de Producción *</label>
              <select className="input" value={form.recipeId} onChange={e => setForm(f => ({ ...f, recipeId: e.target.value }))}>
                <option value="">— Seleccionar flujo —</option>
                {recipes.map(r => <option key={r.id} value={r.id}>{r.name} (v{r.version})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Máquina *</label>
              <select className="input" value={form.machineId} onChange={e => setForm(f => ({ ...f, machineId: e.target.value }))}>
                <option value="">— Seleccionar máquina —</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id} disabled={m.status === 'MAINTENANCE'}>
                    {m.name} ({m.code}){m.status === 'MAINTENANCE' ? ' [MANTENIMIENTO]' : m.status === 'IDLE' ? ' [INACTIVA]' : ''}
                  </option>
                ))}
              </select>
              {form.machineId && machines.find(m => m.id === form.machineId)?.status === 'IDLE' && (
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1"><AlertTriangle size={11} />Máquina actualmente inactiva</p>
              )}
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
              <label className="label">Cantidad Planificada</label>
              <input type="number" className="input" value={form.plannedQty} min={0} step={0.01} onChange={e => setForm(f => ({ ...f, plannedQty: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="label">Unidad</label>
              <input className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="kg, L, unid..." />
            </div>
          </div>

          <div>
            <label className="label">Encargado / Supervisor</label>
            <input className="input" value={form.supervisorName} onChange={e => setForm(f => ({ ...f, supervisorName: e.target.value }))} placeholder="Nombre del encargado..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1"><Calendar size={12} />Inicio Planificado</label>
              <input type="datetime-local" className="input" value={form.plannedStartAt} onChange={e => setForm(f => ({ ...f, plannedStartAt: e.target.value }))} />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Calendar size={12} />Fin Planificado</label>
              <input type="datetime-local" className="input" value={form.plannedEndAt} onChange={e => setForm(f => ({ ...f, plannedEndAt: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones opcionales..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Creando...' : 'Crear Lote'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
