import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Cpu, Search, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import api from '../../lib/api'
import { Machine, MachineStatus } from '../../types'
import Modal from '../../components/Modal'

const MACHINE_STATUS: { value: MachineStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'ACTIVE', label: 'Activa', color: 'text-green-600 bg-green-50', icon: <CheckCircle size={12} /> },
  { value: 'IDLE', label: 'Inactiva', color: 'text-gray-500 bg-gray-100', icon: <Clock size={12} /> },
  { value: 'MAINTENANCE', label: 'Mantenimiento', color: 'text-orange-600 bg-orange-50', icon: <AlertTriangle size={12} /> }
]

const MACHINE_TYPES = ['Mezcladora', 'Cocedora', 'Envasadora', 'Prensa', 'Cortadora', 'Transportador', 'Enfriadora', 'Secadora', 'Compresor', 'Bomba', 'Otro']

function StatusChip({ status }: { status: MachineStatus }) {
  const s = MACHINE_STATUS.find(x => x.value === status) || MACHINE_STATUS[0]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
      {s.icon}{s.label}
    </span>
  )
}

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Machine | null>(null)
  const [form, setForm] = useState({
    name: '', code: '', description: '',
    status: 'ACTIVE' as MachineStatus,
    machineType: '', capacity: '', capacityUnit: ''
  })
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
    setForm({ name: '', code: '', description: '', status: 'ACTIVE', machineType: '', capacity: '', capacityUnit: '' })
    setError('')
    setModalOpen(true)
  }

  function openEdit(m: Machine) {
    setEditing(m)
    setForm({
      name: m.name, code: m.code, description: m.description || '',
      status: m.status || 'ACTIVE',
      machineType: m.machineType || '',
      capacity: m.capacity?.toString() || '',
      capacityUnit: m.capacityUnit || ''
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.code) { setError('Nombre y código son requeridos'); return }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/machines/${editing.id}`, {
          ...form,
          capacity: form.capacity ? parseFloat(form.capacity) : undefined
        })
      } else {
        await api.post('/machines', {
          ...form,
          capacity: form.capacity ? parseFloat(form.capacity) : undefined
        })
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function handleQuickStatus(m: Machine, status: MachineStatus) {
    await api.patch(`/machines/${m.id}/status`, { status })
    load()
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

  const activeCount = machines.filter(m => m.status === 'ACTIVE').length
  const maintenanceCount = machines.filter(m => m.status === 'MAINTENANCE').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Máquinas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {machines.length} registradas · <span className="text-green-600">{activeCount} activas</span>
            {maintenanceCount > 0 && <span className="text-orange-600"> · {maintenanceCount} en mantenimiento</span>}
          </p>
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
                <th className="text-left px-5 py-3 font-medium text-gray-600">Máquina</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Código</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Tipo / Capacidad</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Layout</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(m => (
                <tr key={m.id} className={`hover:bg-gray-50 ${m.status === 'MAINTENANCE' ? 'bg-orange-50/30' : ''}`}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800">{m.name}</p>
                    {m.description && <p className="text-xs text-gray-400 truncate max-w-xs">{m.description}</p>}
                  </td>
                  <td className="px-5 py-3"><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{m.code}</span></td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    <div>{m.machineType || '—'}</div>
                    {m.capacity && <div className="text-gray-400">{m.capacity} {m.capacityUnit}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={m.status || 'ACTIVE'}
                      onChange={e => handleQuickStatus(m, e.target.value as MachineStatus)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    >
                      {MACHINE_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Máquina' : 'Nueva Máquina'} size="lg">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Mezcladora Línea 1" />
            </div>
            <div>
              <label className="label">Código *</label>
              <input className="input font-mono" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Ej: MZC-L1" />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción opcional..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo de Máquina</label>
              <select className="input" value={form.machineType} onChange={e => setForm(f => ({ ...f, machineType: e.target.value }))}>
                <option value="">— Sin tipo —</option>
                {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as MachineStatus }))}>
                {MACHINE_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Capacidad</label>
              <input type="number" className="input" value={form.capacity} min={0} step={0.01} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="Ej: 500" />
            </div>
            <div>
              <label className="label">Unidad de Capacidad</label>
              <input className="input" value={form.capacityUnit} onChange={e => setForm(f => ({ ...f, capacityUnit: e.target.value }))} placeholder="kg, L, unid/h..." />
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
