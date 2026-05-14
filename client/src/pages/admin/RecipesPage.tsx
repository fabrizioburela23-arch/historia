import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, FlaskConical, X, ChevronDown, ChevronRight } from 'lucide-react'
import api from '../../lib/api'
import { Recipe, Product, ProcessFlow } from '../../types'
import Modal from '../../components/Modal'

interface FlowSel { flowId: string }
interface MatSel { productId: string; quantity: number; unit: string }
interface FormState {
  id?: string
  name: string
  description: string
  version: string
  flows: FlowSel[]
  materials: MatSel[]
}
const empty: FormState = { name: '', description: '', version: '1.0', flows: [], materials: [] }

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [flows, setFlows] = useState<ProcessFlow[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [r, f, p] = await Promise.all([
      api.get<Recipe[]>('/recipes'),
      api.get<ProcessFlow[]>('/flows'),
      api.get<Product[]>('/products')
    ])
    setRecipes(r.data); setFlows(f.data); setProducts(p.data)
  }
  useEffect(() => { load() }, [])

  function openCreate() { setForm(empty); setError(''); setModal(true) }
  function openEdit(r: Recipe) {
    setForm({
      id: r.id,
      name: r.name,
      description: r.description || '',
      version: r.version,
      flows: r.flows.map(rf => ({ flowId: rf.flowId })),
      materials: r.materials.map(m => ({ productId: m.productId, quantity: m.quantity, unit: m.unit }))
    })
    setError(''); setModal(true)
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        flows: form.flows.map((f, i) => ({ ...f, order: i }))
      }
      if (form.id) await api.put(`/recipes/${form.id}`, payload)
      else await api.post('/recipes', payload)
      setModal(false); load()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar receta?')) return
    try { await api.delete(`/recipes/${id}`); load() }
    catch (e: any) { alert(e?.response?.data?.error || 'Error') }
  }

  const rawProducts = products.filter(p => p.type === 'RAW')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
          <p className="text-gray-500 text-sm mt-1">Combinación de flujos de proceso + materias primas directas</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16}/> Nueva Receta</button>
      </div>

      <div className="space-y-3">
        {recipes.length === 0 ? (
          <div className="card p-10 text-center text-gray-400">
            <FlaskConical size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin recetas</p>
          </div>
        ) : recipes.map(r => {
          const isOpen = expanded[r.id]
          return (
            <div key={r.id} className="card overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <button onClick={() => setExpanded(e => ({ ...e, [r.id]: !e[r.id] }))} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                  {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{r.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">v{r.version}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {r.flows.length} flujos · {r.materials.length} materias primas directas
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><Pencil size={14}/></button>
                  <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14}/></button>
                </div>
              </div>
              {isOpen && (
                <div className="border-t bg-gray-50 px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Flujos</p>
                    {r.flows.length === 0 ? <p className="text-xs text-gray-400">Sin flujos</p> :
                      <ol className="space-y-1 text-sm">
                        {r.flows.map((rf, i) => (
                          <li key={rf.id} className="bg-white px-2 py-1.5 rounded border text-gray-700">
                            <span className="text-xs font-mono text-indigo-600 mr-2">#{i+1}</span>
                            {rf.flow?.name}
                          </li>
                        ))}
                      </ol>
                    }
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Materias primas directas</p>
                    {r.materials.length === 0 ? <p className="text-xs text-gray-400">Sin materias directas</p> :
                      <ul className="space-y-1 text-sm">
                        {r.materials.map(m => (
                          <li key={m.id} className="bg-white px-2 py-1.5 rounded border flex justify-between">
                            <span className="text-gray-700">{m.product.name}</span>
                            <span className="font-mono text-xs text-gray-500">{m.quantity} {m.unit}</span>
                          </li>
                        ))}
                      </ul>
                    }
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Receta' : 'Nueva Receta'} size="xl">
        <div className="space-y-4">
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Versión</label>
              <input className="input" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Flujos de proceso (en orden)</label>
              <button onClick={() => setForm(f => ({ ...f, flows: [...f.flows, { flowId: '' }] }))} className="btn-secondary text-xs py-1"><Plus size={12}/> Flujo</button>
            </div>
            <div className="space-y-2">
              {form.flows.map((rf, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-indigo-600 w-6">#{i+1}</span>
                  <select className="input flex-1" value={rf.flowId} onChange={e => {
                    const next = [...form.flows]; next[i] = { flowId: e.target.value }; setForm({ ...form, flows: next })
                  }}>
                    <option value="">Selecciona flujo...</option>
                    {flows.map(f => <option key={f.id} value={f.id}>{f.name} ({f.inputProduct?.code} → {f.outputProduct?.code})</option>)}
                  </select>
                  <button onClick={() => setForm(s => ({ ...s, flows: s.flows.filter((_, idx) => idx !== i) }))} className="p-1.5 rounded hover:bg-red-50 text-red-500"><X size={14}/></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Materias primas directas</label>
              <button onClick={() => setForm(f => ({ ...f, materials: [...f.materials, { productId: '', quantity: 0, unit: 'kg' }] }))} className="btn-secondary text-xs py-1"><Plus size={12}/> Material</button>
            </div>
            <div className="space-y-2">
              {form.materials.map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select className="input col-span-6" value={m.productId} onChange={e => {
                    const next = [...form.materials]; next[i] = { ...m, productId: e.target.value }; setForm({ ...form, materials: next })
                  }}>
                    <option value="">Selecciona producto...</option>
                    {rawProducts.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
                  </select>
                  <input className="input col-span-3" type="number" step="0.01" placeholder="Cantidad" value={m.quantity} onChange={e => {
                    const next = [...form.materials]; next[i] = { ...m, quantity: parseFloat(e.target.value) || 0 }; setForm({ ...form, materials: next })
                  }} />
                  <input className="input col-span-2" placeholder="kg" value={m.unit} onChange={e => {
                    const next = [...form.materials]; next[i] = { ...m, unit: e.target.value }; setForm({ ...form, materials: next })
                  }} />
                  <button onClick={() => setForm(s => ({ ...s, materials: s.materials.filter((_, idx) => idx !== i) }))} className="col-span-1 p-1.5 rounded hover:bg-red-50 text-red-500"><X size={14}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name || (form.flows.length === 0 && form.materials.length === 0)} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
