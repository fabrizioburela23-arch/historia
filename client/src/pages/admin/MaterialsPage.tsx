import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, FlaskConical } from 'lucide-react'
import api from '../../lib/api'
import { Material } from '../../types'
import Modal from '../../components/Modal'

const UNITS = ['kg', 'g', 'L', 'mL', 'unidades', 'metros', 'litros', 'toneladas', 'cajas', 'bolsas', 'piezas']

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)
  const [form, setForm] = useState({ name: '', code: '', unit: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    const { data } = await api.get<Material[]>('/materials')
    setMaterials(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', code: '', unit: '', description: '' })
    setError('')
    setModalOpen(true)
  }

  function openEdit(m: Material) {
    setEditing(m)
    setForm({ name: m.name, code: m.code, unit: m.unit, description: m.description || '' })
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.code || !form.unit) { setError('Nombre, código y unidad son requeridos'); return }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/materials/${editing.id}`, form)
      } else {
        await api.post('/materials', form)
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function handleDelete(m: Material) {
    if (!confirm(`¿Eliminar "${m.name}"?`)) return
    try {
      await api.delete(`/materials/${m.id}`)
      load()
    } catch {
      alert('No se puede eliminar: está siendo usado en flujos de producción')
    }
  }

  const filtered = materials.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Materiales & Elementos</h1>
          <p className="text-gray-500 text-sm mt-1">{materials.length} materiales registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nuevo Material</button>
      </div>

      {/* Search */}
      <div>
        <input
          className="input max-w-sm"
          placeholder="Buscar por nombre o código..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <FlaskConical size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{search ? 'Sin resultados' : 'Sin materiales registrados'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Material</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Código</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Unidad</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Descripción</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 rounded-lg"><FlaskConical size={14} className="text-emerald-600" /></div>
                      <span className="font-medium text-gray-800">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{m.code}</span></td>
                  <td className="px-5 py-3"><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{m.unit}</span></td>
                  <td className="px-5 py-3 text-gray-500 text-xs max-w-xs truncate">{m.description || '—'}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Material' : 'Nuevo Material'}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Harina de Trigo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Código *</label>
              <input className="input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Ej: MAT-001" />
            </div>
            <div>
              <label className="label">Unidad *</label>
              <select className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                <option value="__custom">Otra...</option>
              </select>
              {form.unit === '__custom' && (
                <input className="input mt-2" placeholder="Escribir unidad..." onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
              )}
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción opcional..." />
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
