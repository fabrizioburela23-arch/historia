import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Settings2, ChevronDown, ChevronRight, CheckSquare, Clock } from 'lucide-react'
import api from '../../lib/api'
import { Operation } from '../../types'
import Modal from '../../components/Modal'

export default function OperationsPage() {
  const [operations, setOperations] = useState<Operation[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Operation | null>(null)
  const [form, setForm] = useState({ name: '', code: '', description: '', defaultDurationMin: '0' })
  const [checkItems, setCheckItems] = useState<{ label: string; required: boolean }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get<Operation[]>('/operations')
    setOperations(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', code: '', description: '', defaultDurationMin: '0' })
    setCheckItems([])
    setError('')
    setModalOpen(true)
  }

  function openEdit(op: Operation) {
    setEditing(op)
    setForm({ name: op.name, code: op.code, description: op.description || '', defaultDurationMin: op.defaultDurationMin.toString() })
    setCheckItems([])
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.code) { setError('Nombre y código son requeridos'); return }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/operations/${editing.id}`, { ...form, defaultDurationMin: parseInt(form.defaultDurationMin) || 0 })
        // Add new checklist items
        for (const item of checkItems.filter(c => c.label)) {
          await api.post(`/operations/${editing.id}/checklist`, item)
        }
      } else {
        await api.post('/operations', { ...form, defaultDurationMin: parseInt(form.defaultDurationMin) || 0, checklistItems: checkItems.filter(c => c.label) })
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function deleteChecklistItem(opId: string, itemId: string) {
    await api.delete(`/operations/${opId}/checklist/${itemId}`)
    load()
  }

  async function deleteOperation(op: Operation) {
    if (!confirm(`¿Eliminar la operación "${op.name}"?`)) return
    try {
      await api.delete(`/operations/${op.id}`)
      load()
    } catch {
      alert('No se puede eliminar: en uso en flujos de producción')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Procesos</h1>
          <p className="text-gray-500 text-sm mt-1">{operations.length} operaciones estándar definidas</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nueva Operación</button>
      </div>

      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
      ) : operations.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <Settings2 size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Sin operaciones registradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {operations.map(op => (
            <div key={op.id} className="card overflow-hidden">
              <div
                className="flex items-center px-5 py-4 gap-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(expanded === op.id ? null : op.id)}
              >
                {expanded === op.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                <Settings2 size={16} className="text-violet-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800">{op.name}</p>
                    <span className="font-mono text-xs bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">{op.code}</span>
                  </div>
                  {op.description && <p className="text-xs text-gray-500 truncate">{op.description}</p>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                  <span className="flex items-center gap-1"><Clock size={11} /> {op.defaultDurationMin} min</span>
                  <span>{op.checklistItems.length} verificaciones</span>
                </div>
                <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(op)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"><Pencil size={13} /></button>
                  <button onClick={() => deleteOperation(op)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </div>

              {expanded === op.id && op.checklistItems.length > 0 && (
                <div className="border-t bg-gray-50/50 px-5 py-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Verificaciones</p>
                  {op.checklistItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
                      <CheckSquare size={13} className="text-indigo-400 shrink-0" />
                      <span className="text-sm flex-1">{item.label}</span>
                      {item.required && <span className="text-xs text-red-400">Requerido</span>}
                      <button onClick={() => deleteChecklistItem(op.id, item.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Operación' : 'Nueva Operación'} size="lg">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Deshidratación" />
            </div>
            <div>
              <label className="label">Código *</label>
              <input className="input font-mono" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="OP-DESH" />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Instrucciones del proceso..." />
          </div>
          <div>
            <label className="label">Duración Estándar (min)</label>
            <input type="number" min="0" className="input" value={form.defaultDurationMin} onChange={e => setForm(f => ({ ...f, defaultDurationMin: e.target.value }))} />
          </div>

          {/* Checklist section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Verificaciones / Checklist</label>
              <button onClick={() => setCheckItems(prev => [...prev, { label: '', required: true }])} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <Plus size={12} /> Agregar
              </button>
            </div>
            {/* Existing items (edit mode) */}
            {editing && editing.checklistItems.length > 0 && (
              <div className="space-y-1 mb-2">
                {editing.checklistItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg text-sm text-gray-600">
                    <CheckSquare size={13} className="text-indigo-400" />
                    <span className="flex-1">{item.label}</span>
                    {item.required && <span className="text-xs text-red-400">Req.</span>}
                  </div>
                ))}
              </div>
            )}
            {/* New items */}
            <div className="space-y-2">
              {checkItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="input flex-1 text-sm py-1.5" value={item.label} onChange={e => setCheckItems(prev => prev.map((c, ci) => ci === i ? { ...c, label: e.target.value } : c))} placeholder={`Verificación ${i + 1}...`} />
                  <label className="flex items-center gap-1 text-xs shrink-0 cursor-pointer">
                    <input type="checkbox" checked={item.required} onChange={e => setCheckItems(prev => prev.map((c, ci) => ci === i ? { ...c, required: e.target.checked } : c))} />
                    Req.
                  </label>
                  <button onClick={() => setCheckItems(prev => prev.filter((_, ci) => ci !== i))} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
