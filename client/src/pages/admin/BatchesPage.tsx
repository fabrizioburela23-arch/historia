import { useEffect, useState } from 'react'
import { Plus, Trash2, Package, Eye, Layers, Workflow } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { Batch, Recipe, ProcessFlow, Machine, BatchMode, ExecMode, Priority } from '../../types'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'

interface FormState {
  name: string
  mode: BatchMode
  executionMode: ExecMode
  priority: Priority
  notes: string
  supervisorName: string
  flowId: string
  machineId: string
  plannedInputQty: string
  recipeId: string
  batchSize: string
  plannedStartAt: string
  plannedEndAt: string
}
const empty: FormState = {
  name: '', mode: 'SINGLE_FLOW', executionMode: 'SEQUENTIAL', priority: 'NORMAL',
  notes: '', supervisorName: '',
  flowId: '', machineId: '', plannedInputQty: '',
  recipeId: '', batchSize: '1',
  plannedStartAt: '', plannedEndAt: ''
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [flows, setFlows] = useState<ProcessFlow[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function load() {
    const q = statusFilter ? `?status=${statusFilter}` : ''
    const [b, f, r, m] = await Promise.all([
      api.get<Batch[]>(`/batches${q}`),
      api.get<ProcessFlow[]>('/flows'),
      api.get<Recipe[]>('/recipes'),
      api.get<Machine[]>('/machines')
    ])
    setBatches(b.data); setFlows(f.data); setRecipes(r.data); setMachines(m.data)
  }
  useEffect(() => { load() }, [statusFilter])

  function openCreate() { setForm(empty); setError(''); setModal(true) }

  async function save() {
    setSaving(true); setError('')
    try {
      const payload: any = {
        name: form.name,
        mode: form.mode,
        executionMode: form.executionMode,
        priority: form.priority,
        notes: form.notes || undefined,
        supervisorName: form.supervisorName || undefined,
        plannedStartAt: form.plannedStartAt || undefined,
        plannedEndAt: form.plannedEndAt || undefined
      }
      if (form.mode === 'SINGLE_FLOW') {
        payload.flowId = form.flowId
        payload.machineId = form.machineId || undefined
        if (form.plannedInputQty) payload.plannedInputQty = parseFloat(form.plannedInputQty)
      } else {
        payload.recipeId = form.recipeId
        if (form.batchSize) payload.batchSize = parseFloat(form.batchSize)
      }
      await api.post('/batches', payload)
      setModal(false); load()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar lote?')) return
    try { await api.delete(`/batches/${id}`); load() }
    catch (e: any) { alert(e?.response?.data?.error || 'Error') }
  }

  function computeYield(b: Batch): number | null {
    const totalIn = b.flows.reduce((s, f) => s + (f.inputQtyActual || 0), 0)
    const totalOut = b.flows.reduce((s, f) => s + (f.outputQtyActual || 0), 0)
    if (totalIn === 0) return null
    return (totalOut / totalIn) * 100
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lotes de Producción</h1>
          <p className="text-gray-500 text-sm mt-1">Monoelemento (1 flujo) o basados en receta</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16}/> Nuevo Lote</button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[{ v: '', l: 'Todos' }, { v: 'PENDING', l: 'Pendientes' }, { v: 'IN_PROGRESS', l: 'En proceso' }, { v: 'COMPLETED', l: 'Completados' }, { v: 'CANCELLED', l: 'Cancelados' }].map(o => (
          <button key={o.v} onClick={() => setStatusFilter(o.v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === o.v ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {o.l}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {batches.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Package size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin lotes</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Modo</th>
                <th className="px-4 py-3">Receta / Flujo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Flujos</th>
                <th className="px-4 py-3">Rendimiento</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(b => {
                const y = computeYield(b)
                return (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        {b.mode === 'RECIPE' ? <Layers size={12}/> : <Workflow size={12}/>}
                        {b.mode === 'RECIPE' ? 'Receta' : 'Monoelemento'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {b.recipe?.name || b.flows[0]?.flow?.name || '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={b.status}/></td>
                    <td className="px-4 py-3 text-xs">
                      {b.flows.filter(f => f.status === 'COMPLETED').length}/{b.flows.length}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {y !== null ? <span className={`font-medium ${y >= 80 ? 'text-green-700' : 'text-amber-700'}`}>{y.toFixed(1)}%</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button onClick={() => navigate(`/operator/batch/${b.id}`)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><Eye size={14}/></button>
                      <button onClick={() => remove(b.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Lote" size="lg">
        <div className="space-y-4">
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="LOTE-2026-001" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setForm({ ...form, mode: 'SINGLE_FLOW' })}
              className={`p-3 rounded-lg border-2 text-left ${form.mode === 'SINGLE_FLOW' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
              <Workflow size={18} className="text-indigo-600 mb-1"/>
              <p className="font-medium text-sm">Monoelemento</p>
              <p className="text-xs text-gray-500">Un solo flujo de proceso</p>
            </button>
            <button onClick={() => setForm({ ...form, mode: 'RECIPE' })}
              className={`p-3 rounded-lg border-2 text-left ${form.mode === 'RECIPE' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
              <Layers size={18} className="text-indigo-600 mb-1"/>
              <p className="font-medium text-sm">Por Receta</p>
              <p className="text-xs text-gray-500">Múltiples flujos</p>
            </button>
          </div>

          {form.mode === 'SINGLE_FLOW' ? (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="label">Flujo *</label>
                <select className="input" value={form.flowId} onChange={e => setForm({ ...form, flowId: e.target.value })}>
                  <option value="">Selecciona...</option>
                  {flows.map(f => <option key={f.id} value={f.id}>{f.name} ({f.inputProduct?.code} → {f.outputProduct?.code})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Máquina</label>
                  <select className="input" value={form.machineId} onChange={e => setForm({ ...form, machineId: e.target.value })}>
                    <option value="">Default del flujo</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Cantidad entrada planeada</label>
                  <input className="input" type="number" step="0.01" value={form.plannedInputQty} onChange={e => setForm({ ...form, plannedInputQty: e.target.value })} placeholder="Default del flujo" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="label">Receta *</label>
                <select className="input" value={form.recipeId} onChange={e => setForm({ ...form, recipeId: e.target.value })}>
                  <option value="">Selecciona...</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name} (v{r.version})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Multiplicador de tamaño</label>
                  <input className="input" type="number" step="0.1" value={form.batchSize} onChange={e => setForm({ ...form, batchSize: e.target.value })} />
                </div>
                <div>
                  <label className="label">Modo de ejecución</label>
                  <select className="input" value={form.executionMode} onChange={e => setForm({ ...form, executionMode: e.target.value as ExecMode })}>
                    <option value="SEQUENTIAL">Secuencial</option>
                    <option value="PARALLEL">Paralelo</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prioridad</label>
              <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })}>
                <option value="LOW">Baja</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
            <div>
              <label className="label">Supervisor</label>
              <input className="input" value={form.supervisorName} onChange={e => setForm({ ...form, supervisorName: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={save}
              disabled={saving || !form.name || (form.mode === 'SINGLE_FLOW' ? !form.flowId : !form.recipeId)}
              className="btn-primary">
              {saving ? 'Creando...' : 'Crear Lote'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
