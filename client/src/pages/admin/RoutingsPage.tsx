import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, GitBranch, ChevronDown, ChevronRight, Clock, Cpu, Settings2 } from 'lucide-react'
import api from '../../lib/api'
import { Routing, Operation, Machine } from '../../types'
import Modal from '../../components/Modal'

export default function RoutingsPage() {
  const [routings, setRoutings] = useState<Routing[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [routingModal, setRoutingModal] = useState(false)
  const [stepModal, setStepModal] = useState(false)
  const [editingRouting, setEditingRouting] = useState<Routing | null>(null)
  const [selectedRoutingId, setSelectedRoutingId] = useState('')
  const [routingForm, setRoutingForm] = useState({ name: '', version: '1.0', description: '' })
  const [stepForm, setStepForm] = useState({ operationId: '', targetDurationMin: '0', preferredMachineId: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [r, ops, m] = await Promise.all([
      api.get<Routing[]>('/routings'),
      api.get<Operation[]>('/operations'),
      api.get<Machine[]>('/machines')
    ])
    setRoutings(r.data)
    setOperations(ops.data)
    setMachines(m.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEditingRouting(null)
    setRoutingForm({ name: '', version: '1.0', description: '' })
    setError('')
    setRoutingModal(true)
  }

  function openEdit(r: Routing) {
    setEditingRouting(r)
    setRoutingForm({ name: r.name, version: r.version, description: r.description || '' })
    setError('')
    setRoutingModal(true)
  }

  async function saveRouting() {
    if (!routingForm.name) { setError('Nombre requerido'); return }
    setSaving(true)
    try {
      if (editingRouting) {
        await api.put(`/routings/${editingRouting.id}`, routingForm)
      } else {
        await api.post('/routings', routingForm)
      }
      setRoutingModal(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error')
    } finally { setSaving(false) }
  }

  function openAddStep(routingId: string) {
    setSelectedRoutingId(routingId)
    setStepForm({ operationId: '', targetDurationMin: '0', preferredMachineId: '', notes: '' })
    setError('')
    setStepModal(true)
  }

  async function saveStep() {
    if (!stepForm.operationId) { setError('Operación requerida'); return }
    setSaving(true)
    try {
      await api.post(`/routings/${selectedRoutingId}/steps`, {
        ...stepForm,
        targetDurationMin: parseInt(stepForm.targetDurationMin) || 0,
        preferredMachineId: stepForm.preferredMachineId || undefined
      })
      setStepModal(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error')
    } finally { setSaving(false) }
  }

  async function deleteStep(routingId: string, stepId: string) {
    if (!confirm('¿Eliminar este paso?')) return
    await api.delete(`/routings/${routingId}/steps/${stepId}`)
    load()
  }

  async function deleteRouting(r: Routing) {
    if (!confirm(`¿Eliminar el flujo "${r.name}"?`)) return
    try {
      await api.delete(`/routings/${r.id}`)
      load()
    } catch {
      alert('No se puede eliminar: en uso por recetas')
    }
  }

  const totalMin = (r: Routing) => r.steps.reduce((acc, s) => acc + s.targetDurationMin, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flujos de Producción</h1>
          <p className="text-gray-500 text-sm mt-1">{routings.length} flujos definidos</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nuevo Flujo</button>
      </div>

      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
      ) : routings.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <GitBranch size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Sin flujos definidos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {routings.map(r => (
            <div key={r.id} className="card overflow-hidden">
              <div className="flex items-center px-5 py-4 gap-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                {expanded === r.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                <GitBranch size={16} className="text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800">{r.name}</p>
                    <span className="font-mono text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">v{r.version}</span>
                  </div>
                  {r.description && <p className="text-xs text-gray-500 truncate">{r.description}</p>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                  <span className="flex items-center gap-1"><Clock size={11} /> {totalMin(r)} min</span>
                  <span>{r.steps.length} operaciones</span>
                </div>
                <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"><Pencil size={13} /></button>
                  <button onClick={() => deleteRouting(r)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </div>

              {expanded === r.id && (
                <div className="border-t bg-gray-50/50 px-5 py-4 space-y-3">
                  {/* Visual flow */}
                  {r.steps.length > 0 && (
                    <div className="flex items-center gap-1 overflow-x-auto pb-2 flex-wrap">
                      {r.steps.map((step, idx) => (
                        <div key={step.id} className="flex items-center shrink-0">
                          <div className="flex items-center gap-1.5 bg-white border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-medium">
                            <Settings2 size={11} />
                            {idx + 1}. {step.operation.name}
                            <span className="text-gray-400">({step.targetDurationMin}min)</span>
                          </div>
                          {idx < r.steps.length - 1 && <ChevronRight size={14} className="text-gray-300 mx-0.5" />}
                        </div>
                      ))}
                    </div>
                  )}

                  {r.steps.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-2">Sin operaciones definidas</p>
                  ) : (
                    r.steps.map((step, idx) => (
                      <div key={step.id} className="flex items-start gap-3 bg-white border rounded-xl p-4">
                        <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm text-gray-800">{step.operation.name}</p>
                            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{step.operation.code}</span>
                            <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={11} />{step.targetDurationMin} min</span>
                            {step.preferredMachine && (
                              <span className="text-xs text-orange-600 flex items-center gap-1 bg-orange-50 px-1.5 py-0.5 rounded"><Cpu size={10} />{step.preferredMachine.name}</span>
                            )}
                          </div>
                          {step.notes && <p className="text-xs text-gray-500 mt-0.5">{step.notes}</p>}
                          {step.operation.checklistItems.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">{step.operation.checklistItems.length} verificaciones</p>
                          )}
                        </div>
                        <button onClick={() => deleteStep(r.id, step.id)} className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    ))
                  )}
                  <button onClick={() => openAddStep(r.id)} className="btn-secondary w-full justify-center text-xs py-2">
                    <Plus size={14} /> Agregar Operación
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Routing Modal */}
      <Modal open={routingModal} onClose={() => setRoutingModal(false)} title={editingRouting ? 'Editar Flujo' : 'Nuevo Flujo de Producción'}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={routingForm.name} onChange={e => setRoutingForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Línea Deshidratados" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Versión</label>
              <input className="input" value={routingForm.version} onChange={e => setRoutingForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0" />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={routingForm.description} onChange={e => setRoutingForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setRoutingModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={saveRouting} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </Modal>

      {/* Step Modal */}
      <Modal open={stepModal} onClose={() => setStepModal(false)} title="Agregar Operación al Flujo">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="label">Operación *</label>
            <select className="input" value={stepForm.operationId} onChange={e => {
              const op = operations.find(o => o.id === e.target.value)
              setStepForm(f => ({ ...f, operationId: e.target.value, targetDurationMin: op ? op.defaultDurationMin.toString() : f.targetDurationMin }))
            }}>
              <option value="">— Seleccionar operación —</option>
              {operations.map(op => <option key={op.id} value={op.id}>{op.name} ({op.code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Duración Objetivo (min)</label>
              <input type="number" min="0" className="input" value={stepForm.targetDurationMin} onChange={e => setStepForm(f => ({ ...f, targetDurationMin: e.target.value }))} />
            </div>
            <div>
              <label className="label">Máquina Preferida</label>
              <select className="input" value={stepForm.preferredMachineId} onChange={e => setStepForm(f => ({ ...f, preferredMachineId: e.target.value }))}>
                <option value="">— Sin preferencia —</option>
                {machines.filter(m => m.status === 'ACTIVE').map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <input className="input" value={stepForm.notes} onChange={e => setStepForm(f => ({ ...f, notes: e.target.value }))} placeholder="Instrucciones específicas..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setStepModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={saveStep} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Agregar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
