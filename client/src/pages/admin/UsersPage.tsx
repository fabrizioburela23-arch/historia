import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, Users as UsersIcon, ShieldAlert } from 'lucide-react'
import api from '../../lib/api'
import { User, Role } from '../../types'
import Modal from '../../components/Modal'

interface FormState {
  id?: string
  name: string
  email: string
  password: string
  role: Role
}

const empty: FormState = { name: '', email: '', password: '', role: 'OPERATOR' }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState<FormState>(empty)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reveal, setReveal] = useState<Record<string, boolean>>({})

  async function load() {
    const { data } = await api.get<User[]>('/users')
    setUsers(data)
  }
  useEffect(() => { load() }, [])

  function openCreate() { setForm(empty); setModal(true); setError('') }
  function openEdit(u: User) {
    setForm({ id: u.id, name: u.name, email: u.email, password: '', role: u.role })
    setModal(true); setError('')
  }

  async function save() {
    setSaving(true); setError('')
    try {
      if (form.id) {
        const data: any = { name: form.name, email: form.email, role: form.role }
        if (form.password) data.password = form.password
        await api.put(`/users/${form.id}`, data)
      } else {
        await api.post('/users', form)
      }
      setModal(false); load()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar usuario?')) return
    try { await api.delete(`/users/${id}`); load() }
    catch (e: any) { alert(e?.response?.data?.error || 'Error') }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">Administradores y operarios del sistema</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16}/> Nuevo Usuario</button>
      </div>

      <div className="card p-3 flex items-start gap-2 bg-amber-50 border-amber-200 text-amber-800 text-xs">
        <ShieldAlert size={14} className="shrink-0 mt-0.5" />
        <p>Las contraseñas se almacenan en texto plano para visualización por el administrador. Úsalas con discreción.</p>
      </div>

      <div className="card overflow-hidden">
        {users.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <UsersIcon size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin usuarios</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Contraseña</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`}>
                      {u.role === 'ADMIN' ? 'Administrador' : 'Operario'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {reveal[u.id] ? (u.passwordPlain || '—') : '••••••••'}
                      </span>
                      <button
                        onClick={() => setReveal(r => ({ ...r, [u.id]: !r[u.id] }))}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500"
                        title={reveal[u.id] ? 'Ocultar' : 'Mostrar'}
                      >
                        {reveal[u.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><Pencil size={14}/></button>
                    <button onClick={() => remove(u.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Usuario' : 'Nuevo Usuario'}>
        <div className="space-y-4">
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Contraseña {form.id ? '(dejar vacío para no cambiar)' : '*'}</label>
            <input className="input" type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={form.id ? '••••••' : 'al menos 4 caracteres'} />
          </div>
          <div>
            <label className="label">Rol *</label>
            <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>
              <option value="OPERATOR">Operario</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name || !form.email || (!form.id && !form.password)} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
