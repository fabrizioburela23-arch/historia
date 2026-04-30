import { useEffect, useState, useRef } from 'react'
import { Plus, Upload, MapPin, Cpu } from 'lucide-react'
import api from '../../lib/api'
import { PlantLayout, Machine } from '../../types'
import Modal from '../../components/Modal'

interface Pin { machineId: string; x: number; y: number }

export default function LayoutPage() {
  const [layouts, setLayouts] = useState<PlantLayout[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [selected, setSelected] = useState<PlantLayout | null>(null)
  const [pins, setPins] = useState<Pin[]>([])
  const [placingPin, setPlacingPin] = useState<string | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const imageRef = useRef<HTMLDivElement>(null)

  async function load() {
    const [l, m] = await Promise.all([api.get<PlantLayout[]>('/layouts'), api.get<Machine[]>('/machines')])
    setLayouts(l.data)
    setMachines(m.data)
  }
  useEffect(() => { load() }, [])

  function selectLayout(l: PlantLayout) {
    setSelected(l)
    const existing = (l.machines || [])
      .filter(m => m.locationX !== undefined && m.locationY !== undefined)
      .map(m => ({ machineId: m.id, x: m.locationX!, y: m.locationY! }))
    setPins(existing)
    setPlacingPin(null)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selected || !e.target.files?.[0]) return
    const fd = new FormData()
    fd.append('image', e.target.files[0])
    const { data } = await api.post<PlantLayout>(`/layouts/${selected.id}/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    setSelected(data)
    load()
  }

  async function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placingPin || !imageRef.current || !selected) return
    const rect = imageRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    await api.put(`/layouts/${selected.id}/machine-pin`, { machineId: placingPin, locationX: x, locationY: y })
    setPins(prev => {
      const filtered = prev.filter(p => p.machineId !== placingPin)
      return [...filtered, { machineId: placingPin, x, y }]
    })
    setPlacingPin(null)
    load()
  }

  async function createLayout() {
    if (!newName) return
    setSaving(true)
    await api.post('/layouts', { name: newName })
    setNewName('')
    setCreateModal(false)
    setSaving(false)
    load()
  }

  const unplacedMachines = machines.filter(m => !pins.find(p => p.machineId === m.id))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Layout de Planta</h1>
          <p className="text-gray-500 text-sm mt-1">Mapa visual del piso de producción</p>
        </div>
        <button onClick={() => setCreateModal(true)} className="btn-primary"><Plus size={16} /> Nuevo Layout</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Layout List */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Layouts</p>
          {layouts.length === 0 ? (
            <div className="card p-4 text-center text-gray-400 text-sm">Sin layouts</div>
          ) : (
            layouts.map(l => (
              <button
                key={l.id}
                onClick={() => selectLayout(l)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${selected?.id === l.id ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-200'}`}
              >
                <p className="font-medium">{l.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{(l.machines || []).length} máquinas</p>
              </button>
            ))
          )}
        </div>

        {/* Canvas */}
        <div className="lg:col-span-3 space-y-4">
          {!selected ? (
            <div className="card flex flex-col items-center justify-center h-80 text-gray-400">
              <MapPin size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Selecciona un layout para editar</p>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-3">
                <label className="btn-secondary cursor-pointer text-sm">
                  <Upload size={15} /> {selected.imageUrl ? 'Cambiar imagen' : 'Subir plano'}
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleImageUpload} />
                </label>
                {placingPin && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <MapPin size={14} className="animate-bounce" />
                    Haz clic en el plano para colocar <strong>{machines.find(m => m.id === placingPin)?.name}</strong>
                    <button onClick={() => setPlacingPin(null)} className="ml-2 text-xs underline">Cancelar</button>
                  </div>
                )}
              </div>

              {/* Image canvas */}
              <div
                ref={imageRef}
                onClick={handleImageClick}
                className={`relative w-full bg-gray-100 border-2 rounded-2xl overflow-hidden ${placingPin ? 'border-amber-400 cursor-crosshair' : 'border-gray-200'}`}
                style={{ aspectRatio: '16/9' }}
              >
                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt="Layout" className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                    <MapPin size={48} className="mb-2 opacity-30" />
                    <p className="text-sm">Sube un plano para comenzar</p>
                  </div>
                )}
                {/* Pins */}
                {pins.map(pin => {
                  const machine = machines.find(m => m.id === pin.machineId)
                  return (
                    <div
                      key={pin.machineId}
                      className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
                      style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    >
                      <div className="flex flex-col items-center">
                        <div className="bg-indigo-600 text-white text-xs font-medium px-2 py-0.5 rounded-lg mb-1 whitespace-nowrap shadow-lg">
                          {machine?.code || '?'}
                        </div>
                        <MapPin size={20} className="text-indigo-600 drop-shadow-md" fill="#4f46e5" />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Unplaced machines */}
              {machines.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Colocar en Plano</p>
                  <div className="flex flex-wrap gap-2">
                    {machines.map(m => {
                      const placed = pins.find(p => p.machineId === m.id)
                      return (
                        <button
                          key={m.id}
                          onClick={() => setPlacingPin(placingPin === m.id ? null : m.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            placingPin === m.id ? 'bg-amber-500 text-white border-amber-500' :
                            placed ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                          }`}
                        >
                          {placed ? <MapPin size={11} className="fill-current" /> : <Cpu size={11} />}
                          {m.code}
                          {placed && <span className="opacity-60">(mover)</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Nuevo Layout">
        <div className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Planta Principal Piso 1" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreateModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={createLayout} disabled={saving || !newName} className="btn-primary">{saving ? 'Creando...' : 'Crear'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
