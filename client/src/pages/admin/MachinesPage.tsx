import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Cpu, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react'
import api from '../../lib/api'
import { Machine, MachineStatus } from '../../types'
import Modal from '../../components/Modal'

const MACHINE_STATUS: { value: MachineStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'ACTIVE', label: 'Activa', color: 'text-green-600 bg-green-50', icon: <CheckCircle size={12} /> },
  { value: 'IDLE', label: 'Inactiva', color: 'text-gray-500 bg-gray-100', icon: <Clock size={12} /> },
  { value: 'MAINTENANCE', label: 'Mantenimiento', color: 'text-orange-600 bg-orange-50', icon: <AlertTriangle size={12} /> }
]

const MACHINE_TYPES = ['Mezcladora', 'Cocedora', 'Envasadora', 'Prensa', 'Cortadora', 'Transportador', 'Enfriadora', 'Secadora', 'Deshidratadora', 'Compresor', 'Bomba', 'Otro']

function StatusChip({ status }: { status: MachineStatus }) {
  const s = MACHINE_STATUS.find(x => x.value === status) || MACHINE_STATUS[0]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
      {s.icon}{s.label}
    </span>
  )
}

interface MachineForm {
  name: string; code: string; description: string; machineType: string
  status: MachineStatus; hourlyOperatingCost: string
  capacity: string; capacityUnit: string
}

const emptyForm: MachineForm = {
  name: '', code: '', description: '', machineType: '',
  status: 'ACTIVE', hourlyOperatingCost: '0',
  capacity: '', capacityUnit: ''
}

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Machine | null>(null)
  const [form, setForm] = useState<MachineForm>(emptyForm)
  const [search, setSearch] = useState('')
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
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEdit(m: Machine) {
    setEditing(m)
    setForm({
      name: m.name, code: m.code, description: m.description || '',
      machineType: m.machineType || '', status: m.status,
      hourlyOperatingCost: m.hourlyOperatingCost.toString(),
      capacity: m.capacity?.toString() || '', capacityUnit: m.capacityUnit || ''
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.code) { setError('Nombre y código son requeridos'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        hourlyOperatingCost: parseFloat(form.hourlyOperatingCost) || 0,
        capacity: form.capacity ? parseFloat(form.capacity) : undefined,
        capacityUnit: form.capacityUnit || undefined
      }
      if (editing) {
        await api.put(`/machines/${editing.id}`, payload)
      } else {
        await api.post('/machines', payload)
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function handleDelete(m: Machine) {
    if (!confirm(`¿Eliminar la máquina "${m.name}"?`)) return
    try {
      await api.delete(`/machines/${m.id}`)
      load()
    } catch {
      alert('No se puede eliminar: en uso en ejecuciones o flujos de producción')
    }
  }

  const filtered = machines.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Máquinas y Equipos</h1>
          <p className="text-gray-500 text-sm mt-1">{machines.length} equipos registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nueva Máquina</button>
      </div>

      <input className="input max-w-sm" placeholder="Buscar por nombre o código..." value={search} onChange={e => setSearch(e.target.value)} />

      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <Cpu size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{search ? 'Sin resultados' : 'Sin máquinas registradas'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Máquina</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Código</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Costo/hora</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Capacidad</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 rounded-lg"><Cpu size={14} className="text-indigo-600" /></div>
                      <div>
                        <p className="font-medium text-gray-800">{m.name}</p>
                        {m.description && <p className="text-xs text-gray-400">{m.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{m.code}</span></td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{m.machineType || '—'}</td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1 text-gray-700">
                      <DollarSign size={11} className="text-gray-400" />
                      {m.hourlyOperatingCost.toFixed(2)}/h
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{m.capacity ? `${m.capacity} ${m.capacityUnit || ''}` : '—'}</td>
                  <td className="px-5 py-3"><StatusChip status={m.status} /></td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Máquina' : 'Nueva Máquina'} size="lg">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Deshidratadora Nro 1" />
            </div>
            <div>
              <label className="label">Código *</label>
              <input className="input font-mono" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="MAQ-001" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.machineType} onChange={e => setForm(f => ({ ...f, machineType: e.target.value }))}>
                <option value="">— Seleccionar tipo —</option>
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
          <div>
            <label className="label flex items-center gap-1"><DollarSign size={12} className="text-gray-400" />Costo Operativo por Hora ($)</label>
            <input type="number" min="0" step="0.01" className="input" value={form.hourlyOperatingCost} onChange={e => setForm(f => ({ ...f, hourlyOperatingCost: e.target.value }))} placeholder="0.00" />
            <p className="text-xs text-gray-400 mt-1">Usado para calcular el costo de máquinas en recetas</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Capacidad</label>
              <input type="number" min="0" step="0.01" className="input" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="Opcional" />
            </div>
            <div>
              <label className="label">Unidad de Capacidad</label>
              <input className="input" value={form.capacityUnit} onChange={e => setForm(f => ({ ...f, capacityUnit: e.target.value }))} placeholder="kg, L, unidades..." />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Características técnicas..." />
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
