import { useEffect, useState, useRef } from 'react'
import { Plus, Upload, MapPin, Cpu, Trash2, Image } from 'lucide-react'
import api from '../../lib/api'
import { PlantLayout, Machine } from '../../types'
import Modal from '../../components/Modal'

interface PinData { machineId: string; x: number; y: number }

export default function LayoutPage() {
  const [layouts, setLayouts] = useState<PlantLayout[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [selected, setSelected] = useState<PlantLayout | null>(null)
  const [pins, setPins] = useState<PinData[]>([])
  const [placingPin, setPlacingPin] = useState<string | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const imageRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const [l, m] = await Promise.all([
      api.get<PlantLayout[]>('/layouts'),
      api.get<Machine[]>('/machines')
    ])
    setLayouts(l.data)
    setMachines(m.data)
    if (l.data.length > 0 && !selected) selectLayout(l.data[0])
  }

  function selectLayout(layout: PlantLayout) {
    setSelected(layout)
    setPins(
      (layout.machines || [])
        .filter(m => m.locationX != null && m.locationY != null)
        .map(m => ({ machineId: m.id, x: m.locationX!, y: m.locationY! }))
    )
  }

  useEffect(() => { load() }, [])

  async function createLayout() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const { data } = await api.post<PlantLayout>('/layouts', { name: newName.trim() })
      setCreateModal(false)
      setNewName('')
      await load()
      selectLayout(data)
    } finally { setSaving(false) }
  }

  async function deleteLayout(id: string) {
    if (!confirm('¿Eliminar este layout?')) return
    await api.delete(`/layouts/${id}`)
    setSelected(null)
    setPins([])
    load()
  }

  function handleImageFile(file: File) {
    if (!selected) return
    if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageBase64 = e.target?.result as string
      try {
        const { data } = await api.put<PlantLayout>(`/layouts/${selected.id}/image`, { imageBase64 })
        setSelected(data)
        load()
      } finally { setUploading(false) }
    }
    reader.readAsDataURL(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImageFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleImageFile(file)
  }

  async function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placingPin || !selected || !imageRef.current) return
    const rect = imageRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    await api.patch(`/layouts/${selected.id}/machines/${placingPin}`, { locationX: x, locationY: y })
    setPins(prev => {
      const filtered = prev.filter(p => p.machineId !== placingPin)
      return [...filtered, { machineId: placingPin, x, y }]
    })
    setPlacingPin(null)
    load()
  }

  async function removePin(machineId: string) {
    if (!selected) return
    await api.patch(`/layouts/${selected.id}/machines/${machineId}`, { locationX: null, locationY: null })
    setPins(prev => prev.filter(p => p.machineId !== machineId))
    load()
  }

  const pinnedIds = new Set(pins.map(p => p.machineId))
  const layoutMachines = selected?.machines || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Layout de Planta</h1>
          <p className="text-gray-500 text-sm mt-1">Mapa visual de equipos</p>
        </div>
        <button onClick={() => setCreateModal(true)} className="btn-primary"><Plus size={16} /> Nuevo Layout</button>
      </div>

      {/* Layout tabs */}
      {layouts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {layouts.map(l => (
            <button
              key={l.id}
              onClick={() => selectLayout(l)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${selected?.id === l.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map area */}
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="font-semibold text-gray-800">{selected.name}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-secondary text-xs py-1.5"
                >
                  <Upload size={13} /> {uploading ? 'Subiendo...' : 'Subir imagen'}
                </button>
                <button onClick={() => deleteLayout(selected.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
            </div>

            <div
              ref={imageRef}
              className={`relative min-h-[400px] bg-gray-100 ${placingPin ? 'cursor-crosshair' : ''}`}
              onClick={handleMapClick}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              {selected.imageBase64 ? (
                <img src={selected.imageBase64} alt="Layout" className="w-full h-full object-contain" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
                  <Image size={48} className="opacity-30" />
                  <p className="text-sm">Sube una imagen del layout</p>
                  <p className="text-xs">Arrastra y suelta o usa el botón "Subir imagen"</p>
                </div>
              )}

              {/* Pins */}
              {pins.map(pin => {
                const machine = machines.find(m => m.id === pin.machineId)
                if (!machine) return null
                return (
                  <div
                    key={pin.machineId}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex flex-col items-center">
                      <div className="bg-indigo-600 text-white p-1.5 rounded-full shadow-lg cursor-pointer hover:bg-red-600 transition-colors" onClick={() => removePin(pin.machineId)}>
                        <MapPin size={14} />
                      </div>
                      <div className="bg-white text-xs px-1.5 py-0.5 rounded shadow border mt-1 whitespace-nowrap">{machine.name}</div>
                    </div>
                  </div>
                )
              })}

              {placingPin && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
                  Haz clic en el mapa para ubicar la máquina
                </div>
              )}
            </div>
          </div>

          {/* Machine list */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b">
              <p className="font-semibold text-gray-800 text-sm">Equipos en este Layout</p>
              <p className="text-xs text-gray-400 mt-0.5">{layoutMachines.length} máquinas asignadas</p>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {machines.filter(m => m.status === 'ACTIVE').map(m => {
                const isPinned = pinnedIds.has(m.id)
                const isPlacing = placingPin === m.id
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`p-1.5 rounded-lg shrink-0 ${isPinned ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                      <Cpu size={13} className={isPinned ? 'text-indigo-600' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.code}</p>
                    </div>
                    <button
                      onClick={() => setPlacingPin(isPlacing ? null : m.id)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors shrink-0 ${
                        isPlacing ? 'bg-indigo-600 text-white border-indigo-600' :
                        isPinned ? 'bg-green-50 text-green-600 border-green-200' :
                        'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {isPlacing ? 'Cancelar' : isPinned ? 'Ubicado' : 'Ubicar'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <MapPin size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Crea un layout para comenzar</p>
        </div>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Nuevo Layout" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Nombre del Layout</label>
            <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Planta Principal" autoFocus />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreateModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={createLayout} disabled={saving || !newName.trim()} className="btn-primary">{saving ? 'Creando...' : 'Crear'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
