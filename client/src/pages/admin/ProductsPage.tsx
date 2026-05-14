import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Boxes, Search } from 'lucide-react'
import api from '../../lib/api'
import { Product, ProductType } from '../../types'
import Modal from '../../components/Modal'

const typeLabels: Record<ProductType, string> = {
  RAW: 'Materia Prima',
  INTERMEDIATE: 'Intermedio',
  FINAL: 'Producto Final'
}
const typeColors: Record<ProductType, string> = {
  RAW: 'bg-blue-100 text-blue-700',
  INTERMEDIATE: 'bg-amber-100 text-amber-700',
  FINAL: 'bg-green-100 text-green-700'
}

interface FormState {
  id?: string
  name: string
  code: string
  type: ProductType
  unit: string
  description: string
}

const empty: FormState = { name: '', code: '', type: 'RAW', unit: 'kg', description: '' }

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filter, setFilter] = useState<'ALL' | ProductType>('ALL')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState>(empty)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get<Product[]>('/products')
    setProducts(data)
  }
  useEffect(() => { load() }, [])

  function openCreate() { setForm(empty); setModal(true); setError('') }
  function openEdit(p: Product) {
    setForm({ id: p.id, name: p.name, code: p.code, type: p.type, unit: p.unit, description: p.description || '' })
    setModal(true); setError('')
  }

  async function save() {
    setSaving(true); setError('')
    try {
      if (form.id) await api.put(`/products/${form.id}`, form)
      else await api.post('/products', form)
      setModal(false); load()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar producto? Esta acción no se puede deshacer.')) return
    try { await api.delete(`/products/${id}`); load() }
    catch (e: any) { alert(e?.response?.data?.error || 'Error') }
  }

  const filtered = products.filter(p => {
    if (filter !== 'ALL' && p.type !== filter) return false
    if (search && !`${p.name} ${p.code}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500 text-sm mt-1">Materias primas, intermedios y productos finales</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16}/> Nuevo Producto</button>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar por nombre o código" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {(['ALL', 'RAW', 'INTERMEDIATE', 'FINAL'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t === 'ALL' ? 'Todos' : typeLabels[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Boxes size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin productos</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Unidad</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[p.type]}`}>{typeLabels[p.type]}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.description || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><Pencil size={14}/></button>
                    <button onClick={() => remove(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Producto' : 'Nuevo Producto'}>
        <div className="space-y-4">
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Código *</label>
              <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="MP-TOM" />
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ProductType })}>
                <option value="RAW">Materia Prima</option>
                <option value="INTERMEDIATE">Intermedio</option>
                <option value="FINAL">Producto Final</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Unidad *</label>
            <input className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="kg, g, L, ml, u" />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name || !form.code || !form.unit} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
