import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, FlaskConical, TrendingDown, TrendingUp } from 'lucide-react'
import api from '../../lib/api'
import { RawMaterial } from '../../types'
import Modal from '../../components/Modal'

const UNITS = ['kg', 'g', 'L', 'mL', 'unidades', 'metros', 'toneladas', 'cajas', 'bolsas', 'piezas', 'litros']

export default function RawMaterialsPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [stockModal, setStockModal] = useState<RawMaterial | null>(null)
  const [editing, setEditing] = useState<RawMaterial | null>(null)
  const [form, setForm] = useState({ name: '', code: '', unit: '', unitCost: '', stockQty: '', description: '' })
  const [stockDelta, setStockDelta] = useState('')
  const [stockDir, setStockDir] = useState<'add' | 'sub'>('add')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    const { data } = await api.get<RawMaterial[]>('/raw-materials')
    setMaterials(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', code: '', unit: '', unitCost: '0', stockQty: '0', description: '' })
    setError('')
    setModalOpen(true)
  }

  function openEdit(m: RawMaterial) {
    setEditing(m)
    setForm({ name: m.name, code: m.code, unit: m.unit, unitCost: m.unitCost.toString(), stockQty: m.stockQty.toString(), description: m.description || '' })
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.code || !form.unit) { setError('Nombre, código y unidad son requeridos'); return }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/raw-materials/${editing.id}`, { ...form, unitCost: parseFloat(form.unitCost) || 0, stockQty: parseFloat(form.stockQty) || 0 })
      } else {
        await api.post('/raw-materials', { ...form, unitCost: parseFloat(form.unitCost) || 0, stockQty: parseFloat(form.stockQty) || 0 })
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function handleStockAdjust() {
    if (!stockModal || !stockDelta) return
    const delta = stockDir === 'add' ? parseFloat(stockDelta) : -parseFloat(stockDelta)
    await api.patch(`/raw-materials/${stockModal.id}/stock`, { delta })
    setStockModal(null)
    setStockDelta('')
    load()
  }

  async function handleDelete(m: RawMaterial) {
    if (!confirm(`¿Eliminar "${m.name}"?`)) return
    try {
      await api.delete(`/raw-materials/${m.id}`)
      load()
    } catch {
      alert('No se puede eliminar: está en uso en recetas o consumos registrados')
    }
  }

  const filtered = materials.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase())
  )

  const totalStockValue = materials.reduce((acc, m) => acc + m.stockQty * m.unitCost, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Materias Primas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {materials.length} registradas · Valor en stock: <span className="font-medium text-gray-700">${totalStockValue.toFixed(2)}</span>
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nueva Materia Prima</button>
      </div>

      <input className="input max-w-sm" placeholder="Buscar por nombre o código..." value={search} onChange={e => setSearch(e.target.value)} />

      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <FlaskConical size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{search ? 'Sin resultados' : 'Sin materias primas registradas'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Material</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Código</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Costo Unitario</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Stock</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Valor Stock</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 rounded-lg"><FlaskConical size={14} className="text-emerald-600" /></div>
                      <div>
                        <p className="font-medium text-gray-800">{m.name}</p>
                        {m.description && <p className="text-xs text-gray-400">{m.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{m.code}</span></td>
                  <td className="px-5 py-3 text-gray-700">${m.unitCost.toFixed(4)} / {m.unit}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => { setStockModal(m); setStockDelta(''); setStockDir('add') }}
                      className={`font-medium hover:underline ${m.stockQty <= 0 ? 'text-red-600' : m.stockQty < 10 ? 'text-orange-500' : 'text-gray-800'}`}
                    >
                      {m.stockQty} {m.unit}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-gray-600 text-xs">${(m.stockQty * m.unitCost).toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(m)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Materia Prima' : 'Nueva Materia Prima'}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Locoto deshidratado" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Código *</label>
              <input className="input font-mono" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="MP-001" />
            </div>
            <div>
              <label className="label">Unidad *</label>
              <select className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Costo Unitario ($)</label>
              <input type="number" step="0.0001" min="0" className="input" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Stock Inicial</label>
              <input type="number" step="0.01" min="0" className="input" value={form.stockQty} onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </Modal>

      {/* Stock Adjust Modal */}
      {stockModal && (
        <Modal open={!!stockModal} onClose={() => setStockModal(null)} title={`Ajustar Stock — ${stockModal.name}`} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Stock actual: <span className="font-bold text-gray-800">{stockModal.stockQty} {stockModal.unit}</span></p>
            <div className="flex gap-2">
              <button onClick={() => setStockDir('add')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium transition-colors ${stockDir === 'add' ? 'bg-green-600 text-white border-green-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                <TrendingUp size={15} /> Ingreso
              </button>
              <button onClick={() => setStockDir('sub')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium transition-colors ${stockDir === 'sub' ? 'bg-red-600 text-white border-red-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                <TrendingDown size={15} /> Egreso
              </button>
            </div>
            <div>
              <label className="label">Cantidad ({stockModal.unit})</label>
              <input type="number" step="0.01" min="0" className="input" value={stockDelta} onChange={e => setStockDelta(e.target.value)} placeholder="0.00" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStockModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleStockAdjust} disabled={!stockDelta} className="btn-primary">Confirmar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
