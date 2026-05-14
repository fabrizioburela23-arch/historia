import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, GitBranch, ArrowRight, ChevronDown, ChevronRight, X } from 'lucide-react'
import api from '../../lib/api'
import { Product, ProcessFlow, Machine } from '../../types'
import Modal from '../../components/Modal'

interface StepForm {
  name: string
  description: string
  targetTimeMinutes: number
  checklistItems: { label: string; required: boolean }[]
}

interface FormState {
  id?: string
  name: string
  description: string
  machineId: string
  inputProductId: string
  inputQty: number
  inputUnit: string
  outputProductId: string
  expectedOutputQty: number
  outputUnit: string
  targetTimeMinutes: number
  steps: StepForm[]
}

const emptyStep: StepForm = { name: '', description: '', targetTimeMinutes: 0, checklistItems: [] }
const empty: FormState = {
  name: '', description: '', machineId: '',
  inputProductId: '', inputQty: 0, inputUnit: 'kg',
  outputProductId: '', expectedOutputQty: 0, outputUnit: 'kg',
  targetTimeMinutes: 0, steps: []
}

export default function ProcessFlowsPage() {
  const [flows, setFlows] = useState<ProcessFlow[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [f, p, m] = await Promise.all([
      api.get<ProcessFlow[]>('/flows'),
      api.get<Product[]>('/products'),
      api.get<Machine[]>('/machines')
    ])
    setFlows(f.data); setProducts(p.data); setMachines(m.data)
  }
  useEffect(() => { load() }, [])

  function openCreate() { setForm(empty); setError(''); setModal(true) }
  function openEdit(f: ProcessFlow) {
    setForm({
      id: f.id,
      name: f.name,
      description: f.description || '',
      machineId: f.machineId || '',
      inputProductId: f.inputProductId,
      inputQty: f.inputQty,
      inputUnit: f.inputUnit,
      outputProductId: f.outputProductId,
      expectedOutputQty: f.expectedOutputQty,
      outputUnit: f.outputUnit,
      targetTimeMinutes: f.targetTimeMinutes,
      steps: f.steps.map(s => ({
        name: s.name,
        description: s.description || '',
        targetTimeMinutes: s.targetTimeMinutes,
        checklistItems: s.checklistItems.map(c => ({ label: c.label, required: c.required }))
      }))
    })
    setError(''); setModal(true)
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        machineId: form.machineId || null,
        steps: form.steps.map((s, i) => ({ ...s, order: i }))
      }
      if (form.id) await api.put(`/flows/${form.id}`, payload)
      else await api.post('/flows', payload)
      setModal(false); load()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar flujo?')) return
    try { await api.delete(`/flows/${id}`); load() }
    catch (e: any) { alert(e?.response?.data?.error || 'Error') }
  }

  function addStep() {
    setForm(f => ({ ...f, steps: [...f.steps, { ...emptyStep, checklistItems: [] }] }))
  }
  function removeStep(idx: number) {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }))
  }
  function updateStep(idx: number, patch: Partial<StepForm>) {
    setForm(f => ({ ...f, steps: f.steps.map((s, i) => i === idx ? { ...s, ...patch } : s) }))
  }
  function addCheck(stepIdx: number) {
    updateStep(stepIdx, { checklistItems: [...form.steps[stepIdx].checklistItems, { label: '', required: true }] })
  }
  function updateCheck(stepIdx: number, ckIdx: number, patch: Partial<{ label: string; required: boolean }>) {
    const items = form.steps[stepIdx].checklistItems.map((c, i) => i === ckIdx ? { ...c, ...patch } : c)
    updateStep(stepIdx, { checklistItems: items })
  }
  function removeCheck(stepIdx: number, ckIdx: number) {
    const items = form.steps[stepIdx].checklistItems.filter((_, i) => i !== ckIdx)
    updateStep(stepIdx, { checklistItems: items })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flujos de Proceso</h1>
          <p className="text-gray-500 text-sm mt-1">Transformaciones materia prima → producto intermedio/final</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16}/> Nuevo Flujo</button>
      </div>

      <div className="space-y-3">
        {flows.length === 0 ? (
          <div className="card p-10 text-center text-gray-400">
            <GitBranch size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin flujos</p>
          </div>
        ) : flows.map(f => {
          const isOpen = expanded[f.id]
          return (
            <div key={f.id} className="card overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <button onClick={() => setExpanded(e => ({ ...e, [f.id]: !e[f.id] }))} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                  {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold text-gray-900">{f.name}</p>
                    {f.machine && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{f.machine.code}</span>}
                    {f.historicalYield !== null && f.historicalYield !== undefined && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        Rend. hist.: {f.historicalYield.toFixed(1)}% ({f.historicalRuns} corridas)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 flex-wrap">
                    <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{f.inputProduct?.code} · {f.inputQty}{f.inputUnit}</span>
                    <ArrowRight size={14} className="text-gray-400"/>
                    <span className="font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded">{f.outputProduct?.code} · {f.expectedOutputQty}{f.outputUnit}</span>
                    <span className="text-xs text-gray-400 ml-2">{f.steps.length} pasos · {f.targetTimeMinutes} min</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(f)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><Pencil size={14}/></button>
                  <button onClick={() => remove(f.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14}/></button>
                </div>
              </div>
              {isOpen && (
                <div className="border-t bg-gray-50 px-4 py-3 space-y-2">
                  {f.steps.length === 0 ? <p className="text-xs text-gray-400">Sin pasos</p> :
                    f.steps.map((s, i) => (
                      <div key={s.id} className="bg-white rounded-lg p-3 border">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">P{i+1}</span>
                          <span className="font-medium text-sm">{s.name}</span>
                          <span className="text-xs text-gray-400 ml-auto">{s.targetTimeMinutes} min</span>
                        </div>
                        {s.checklistItems.length > 0 && (
                          <ul className="text-xs text-gray-600 ml-6 list-disc">
                            {s.checklistItems.map(c => <li key={c.id} className={c.required ? '' : 'text-gray-400'}>{c.label}{!c.required && ' (opcional)'}</li>)}
                          </ul>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Flujo' : 'Nuevo Flujo'} size="xl">
        <div className="space-y-4">
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Máquina</label>
              <select className="input" value={form.machineId} onChange={e => setForm({ ...form, machineId: e.target.value })}>
                <option value="">Sin máquina</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg">
            <div className="col-span-2 text-xs font-semibold text-blue-700 uppercase">Entrada</div>
            <div>
              <label className="label">Producto *</label>
              <select className="input" value={form.inputProductId} onChange={e => setForm({ ...form, inputProductId: e.target.value })}>
                <option value="">Selecciona...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Cantidad *</label>
                <input className="input" type="number" step="0.01" value={form.inputQty} onChange={e => setForm({ ...form, inputQty: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Unidad</label>
                <input className="input" value={form.inputUnit} onChange={e => setForm({ ...form, inputUnit: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-green-50 rounded-lg">
            <div className="col-span-2 text-xs font-semibold text-green-700 uppercase">Salida Esperada</div>
            <div>
              <label className="label">Producto *</label>
              <select className="input" value={form.outputProductId} onChange={e => setForm({ ...form, outputProductId: e.target.value })}>
                <option value="">Selecciona...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Cantidad *</label>
                <input className="input" type="number" step="0.01" value={form.expectedOutputQty} onChange={e => setForm({ ...form, expectedOutputQty: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Unidad</label>
                <input className="input" value={form.outputUnit} onChange={e => setForm({ ...form, outputUnit: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Tiempo objetivo total (min)</label>
            <input className="input" type="number" value={form.targetTimeMinutes} onChange={e => setForm({ ...form, targetTimeMinutes: parseInt(e.target.value) || 0 })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Pasos</label>
              <button onClick={addStep} className="btn-secondary text-xs py-1"><Plus size={12}/> Paso</button>
            </div>
            <div className="space-y-3">
              {form.steps.map((s, idx) => (
                <div key={idx} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono bg-indigo-100 text-indigo-700 px-2 py-1 rounded">P{idx + 1}</span>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <input className="input col-span-2" placeholder="Nombre del paso" value={s.name} onChange={e => updateStep(idx, { name: e.target.value })} />
                      <input className="input" type="number" placeholder="min" value={s.targetTimeMinutes} onChange={e => updateStep(idx, { targetTimeMinutes: parseInt(e.target.value) || 0 })} />
                    </div>
                    <button onClick={() => removeStep(idx)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><X size={14}/></button>
                  </div>
                  <input className="input" placeholder="Descripción" value={s.description} onChange={e => updateStep(idx, { description: e.target.value })} />
                  <div className="pl-6 space-y-1">
                    {s.checklistItems.map((c, cIdx) => (
                      <div key={cIdx} className="flex items-center gap-2">
                        <input className="input flex-1 text-sm" placeholder="Item del checklist" value={c.label} onChange={e => updateCheck(idx, cIdx, { label: e.target.value })} />
                        <label className="text-xs text-gray-600 flex items-center gap-1">
                          <input type="checkbox" checked={c.required} onChange={e => updateCheck(idx, cIdx, { required: e.target.checked })} />
                          Req.
                        </label>
                        <button onClick={() => removeCheck(idx, cIdx)} className="p-1 rounded hover:bg-red-50 text-red-500"><X size={12}/></button>
                      </div>
                    ))}
                    <button onClick={() => addCheck(idx)} className="text-xs text-indigo-600 hover:underline">+ checklist item</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name || !form.inputProductId || !form.outputProductId} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
