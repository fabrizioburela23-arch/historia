import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Cpu, Search } from 'lucide-react'
import api from '../../lib/api'
import { Machine } from '../../types'
import Modal from '../../components/Modal'

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Machine | null>(null)
  const [form, setForm] = useState({ name: '', code: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get<Machine[]>('/machines')
    setMachines(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', code: '', description: '' })
    setError('')
    setModalOpen(true)
  }

  function openEdit(m: Machine) {
    setEditing(m)
    setForm({ name: m.name, code: m.code, description: m.description || '' })
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.code) { setError('Nombre y código son requeridos'); return }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/machines/${editing.id}`, form)
      } else {
        await api.post('/machines', form)
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(m: Machine) {
    if (!confirm(`¿Eliminar la máquina "${m.name}"?`)) return
    await api.delete(`/machines/${m.id}`)
    load()
  }

  const filtered = machines.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Máquinas</h1>
          <p className="text-gray-500 text-sm mt-1">{machines.length} máquinas registradas</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Nueva Máquina
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar..." />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Cpu size={40} className="mb-3 opacity-30" />
            <p className="text-sm">{search ? 'Sin resultados' : 'Sin máquinas registradas'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Código</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Descripción</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Layout</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{m.name}</td>
                  <td className="px-5 py-3"><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{m.code}</span></td>
                  <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{m.description || '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{m.plantLayout?.name || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-indigo-600 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(m)} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Máquina' : 'Nueva Máquina'}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Procesadora de Tomate L1" />
          </div>
          <div>
            <label className="label">Código *</label>
            <input className="input font-mono" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Ej: PROC-TOM-L1" />
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
