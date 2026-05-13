import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, BookOpen, ChevronDown, ChevronRight, FlaskConical, GitBranch, DollarSign, Percent, TrendingUp, AlertCircle } from 'lucide-react'
import api from '../../lib/api'
import { Recipe, Routing, RawMaterial, RecipeCost } from '../../types'
import Modal from '../../components/Modal'

const YIELD_UNITS = ['kg', 'g', 'L', 'mL', 'unidades', 'cajas', 'bolsas', 'piezas', 'metros', 'toneladas']

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [routings, setRoutings] = useState<Routing[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [recipeModal, setRecipeModal] = useState(false)
  const [bomModal, setBomModal] = useState(false)
  const [costModal, setCostModal] = useState<Recipe | null>(null)
  const [cost, setCost] = useState<RecipeCost | null>(null)
  const [costLoading, setCostLoading] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [recipeForm, setRecipeForm] = useState({ name: '', version: '1.0', description: '', routingId: '', yieldQty: '1', yieldUnit: 'kg', salePrice: '0', taxRate: '19' })
  const [bomForm, setBomForm] = useState({ rawMaterialId: '', quantity: '1', unit: '', isOptional: false, notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [r, ro, m] = await Promise.all([
      api.get<Recipe[]>('/recipes'),
      api.get<Routing[]>('/routings'),
      api.get<RawMaterial[]>('/raw-materials')
    ])
    setRecipes(r.data)
    setRoutings(ro.data)
    setMaterials(m.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEditingRecipe(null)
    setRecipeForm({ name: '', version: '1.0', description: '', routingId: '', yieldQty: '1', yieldUnit: 'kg', salePrice: '0', taxRate: '19' })
    setError('')
    setRecipeModal(true)
  }

  function openEdit(r: Recipe) {
    setEditingRecipe(r)
    setRecipeForm({
      name: r.name, version: r.version, description: r.description || '',
      routingId: r.routingId, yieldQty: r.yieldQty.toString(), yieldUnit: r.yieldUnit,
      salePrice: r.salePrice.toString(), taxRate: (r.taxRate * 100).toString()
    })
    setError('')
    setRecipeModal(true)
  }

  async function saveRecipe() {
    if (!recipeForm.name || !recipeForm.routingId) { setError('Nombre y flujo de producción son requeridos'); return }
    setSaving(true)
    try {
      const payload = {
        ...recipeForm,
        yieldQty: parseFloat(recipeForm.yieldQty) || 1,
        salePrice: parseFloat(recipeForm.salePrice) || 0,
        taxRate: (parseFloat(recipeForm.taxRate) || 0) / 100
      }
      if (editingRecipe) {
        await api.put(`/recipes/${editingRecipe.id}`, payload)
      } else {
        await api.post('/recipes', payload)
      }
      setRecipeModal(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error')
    } finally { setSaving(false) }
  }

  function openAddBom(recipeId: string) {
    setSelectedRecipeId(recipeId)
    setBomForm({ rawMaterialId: '', quantity: '1', unit: '', isOptional: false, notes: '' })
    setError('')
    setBomModal(true)
  }

  async function saveBom() {
    if (!bomForm.rawMaterialId || !bomForm.quantity) { setError('Material y cantidad son requeridos'); return }
    setSaving(true)
    try {
      await api.post(`/recipes/${selectedRecipeId}/bom`, {
        ...bomForm,
        quantity: parseFloat(bomForm.quantity) || 1,
        unit: bomForm.unit || undefined
      })
      setBomModal(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error')
    } finally { setSaving(false) }
  }

  async function deleteBomItem(recipeId: string, itemId: string) {
    if (!confirm('¿Eliminar este ingrediente?')) return
    await api.delete(`/recipes/${recipeId}/bom/${itemId}`)
    load()
  }

  async function deleteRecipe(r: Recipe) {
    if (!confirm(`¿Eliminar la receta "${r.name}"?`)) return
    try {
      await api.delete(`/recipes/${r.id}`)
      load()
    } catch {
      alert('No se puede eliminar: en uso por lotes de producción')
    }
  }

  async function openCost(r: Recipe) {
    setCostModal(r)
    setCost(null)
    setCostLoading(true)
    try {
      const { data } = await api.get<RecipeCost>(`/recipes/${r.id}/cost`)
      setCost(data)
    } finally { setCostLoading(false) }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas de Producción</h1>
          <p className="text-gray-500 text-sm mt-1">{recipes.length} recetas definidas</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nueva Receta</button>
      </div>

      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
      ) : recipes.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <BookOpen size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Sin recetas definidas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map(r => (
            <div key={r.id} className="card overflow-hidden">
              <div className="flex items-center px-5 py-4 gap-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                {expanded === r.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                <BookOpen size={16} className="text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800">{r.name}</p>
                    <span className="font-mono text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">v{r.version}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-400 flex items-center gap-1"><GitBranch size={10} />{r.routing.name}</span>
                    <span className="text-xs text-gray-400">{r.bom.length} ingredientes</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                  <span>Rend: {r.yieldQty} {r.yieldUnit}</span>
                  <span className="flex items-center gap-1"><DollarSign size={11} />{r.salePrice.toFixed(2)}</span>
                </div>
                <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openCost(r)} className="p-1.5 rounded hover:bg-emerald-50 text-gray-400 hover:text-emerald-600" title="Análisis de costos"><TrendingUp size={13} /></button>
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"><Pencil size={13} /></button>
                  <button onClick={() => deleteRecipe(r)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </div>

              {expanded === r.id && (
                <div className="border-t bg-gray-50/50 px-5 py-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lista de Materiales (BOM)</p>
                  {r.bom.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-2">Sin ingredientes definidos</p>
                  ) : (
                    r.bom.map(item => (
                      <div key={item.id} className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3">
                        <div className="p-1.5 bg-emerald-50 rounded-lg shrink-0"><FlaskConical size={13} className="text-emerald-600" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm text-gray-800">{item.rawMaterial.name}</p>
                            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{item.rawMaterial.code}</span>
                            {item.isOptional && <span className="text-xs text-gray-400 italic">opcional</span>}
                          </div>
                          {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
                        </div>
                        <span className="text-sm font-semibold text-gray-700 shrink-0">{item.quantity} {item.unit || item.rawMaterial.unit}</span>
                        <button onClick={() => deleteBomItem(r.id, item.id)} className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    ))
                  )}
                  <button onClick={() => openAddBom(r.id)} className="btn-secondary w-full justify-center text-xs py-2">
                    <Plus size={14} /> Agregar Ingrediente
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recipe Modal */}
      <Modal open={recipeModal} onClose={() => setRecipeModal(false)} title={editingRecipe ? 'Editar Receta' : 'Nueva Receta'} size="lg">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={recipeForm.name} onChange={e => setRecipeForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Locoto Deshidratado Premium" />
            </div>
            <div>
              <label className="label">Versión</label>
              <input className="input" value={recipeForm.version} onChange={e => setRecipeForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0" />
            </div>
          </div>
          <div>
            <label className="label">Flujo de Producción *</label>
            <select className="input" value={recipeForm.routingId} onChange={e => setRecipeForm(f => ({ ...f, routingId: e.target.value }))}>
              <option value="">— Seleccionar flujo —</option>
              {routings.map(ro => <option key={ro.id} value={ro.id}>{ro.name} (v{ro.version})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={recipeForm.description} onChange={e => setRecipeForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rendimiento (cantidad producida)</label>
              <input type="number" min="0.01" step="0.01" className="input" value={recipeForm.yieldQty} onChange={e => setRecipeForm(f => ({ ...f, yieldQty: e.target.value }))} />
            </div>
            <div>
              <label className="label">Unidad de Rendimiento</label>
              <select className="input" value={recipeForm.yieldUnit} onChange={e => setRecipeForm(f => ({ ...f, yieldUnit: e.target.value }))}>
                {YIELD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><DollarSign size={12} />Precio y Fiscalidad</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Precio de Venta ($)</label>
                <input type="number" min="0" step="0.01" className="input" value={recipeForm.salePrice} onChange={e => setRecipeForm(f => ({ ...f, salePrice: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="label flex items-center gap-1">Carga Impositiva (%) <Percent size={11} className="text-gray-400" /></label>
                <input type="number" min="0" max="100" step="0.1" className="input" value={recipeForm.taxRate} onChange={e => setRecipeForm(f => ({ ...f, taxRate: e.target.value }))} placeholder="19" />
                <p className="text-xs text-gray-400 mt-1">Ej: 19 para IVA 19%, 16 para IVA 16%</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setRecipeModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={saveRecipe} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </Modal>

      {/* BOM Modal */}
      <Modal open={bomModal} onClose={() => setBomModal(false)} title="Agregar Ingrediente (BOM)">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="label">Materia Prima *</label>
            <select className="input" value={bomForm.rawMaterialId} onChange={e => {
              const mat = materials.find(m => m.id === e.target.value)
              setBomForm(f => ({ ...f, rawMaterialId: e.target.value, unit: mat?.unit || '' }))
            }}>
              <option value="">— Seleccionar material —</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.code}) — Stock: {m.stockQty} {m.unit}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cantidad *</label>
              <input type="number" min="0.001" step="0.001" className="input" value={bomForm.quantity} onChange={e => setBomForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div>
              <label className="label">Unidad</label>
              <input className="input" value={bomForm.unit} onChange={e => setBomForm(f => ({ ...f, unit: e.target.value }))} placeholder="kg, L, unidades..." />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <input className="input" value={bomForm.notes} onChange={e => setBomForm(f => ({ ...f, notes: e.target.value }))} placeholder="Especificaciones..." />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={bomForm.isOptional} onChange={e => setBomForm(f => ({ ...f, isOptional: e.target.checked }))} />
            Ingrediente opcional
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setBomModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={saveBom} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Agregar'}</button>
          </div>
        </div>
      </Modal>

      {/* Cost Modal */}
      {costModal && (
        <Modal open={!!costModal} onClose={() => setCostModal(null)} title={`Análisis de Costos — ${costModal.name}`} size="lg">
          {costLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
          ) : cost ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Costo Materiales</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">${cost.materialCost.toFixed(4)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Costo Máquinas</p>
                  <p className="text-2xl font-bold text-orange-700 mt-1">${cost.machineCost.toFixed(4)}</p>
                </div>
              </div>
              <div className="bg-gray-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Costo Total</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">${cost.totalCost.toFixed(4)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600">Rendimiento</p>
                  <p className="text-lg font-semibold text-gray-700">{cost.yieldQty} {cost.yieldUnit}</p>
                  <p className="text-xs text-gray-500">Costo/unidad: ${cost.yieldQty > 0 ? (cost.totalCost / cost.yieldQty).toFixed(4) : '—'}</p>
                </div>
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Precio venta (c/impuesto)</span>
                  <span className="font-medium">${cost.salePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Carga impositiva</span>
                  <span className="font-medium">{(cost.taxRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Monto impuesto</span>
                  <span className="font-medium text-orange-600">+ ${cost.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-gray-600">Precio s/impuesto</span>
                  <span className="font-medium">${cost.priceExTax.toFixed(2)}</span>
                </div>
              </div>
              <div className={`rounded-xl p-4 ${cost.margin >= 0.3 ? 'bg-green-50' : cost.margin >= 0.1 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${cost.margin >= 0.3 ? 'text-green-600' : cost.margin >= 0.1 ? 'text-yellow-600' : 'text-red-600'}`}>
                      Margen sobre Precio
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">(Precio s/imp. − Costo) / Precio s/imp.</p>
                  </div>
                  <p className={`text-3xl font-bold ${cost.margin >= 0.3 ? 'text-green-700' : cost.margin >= 0.1 ? 'text-yellow-700' : 'text-red-700'}`}>
                    {(cost.margin * 100).toFixed(1)}%
                  </p>
                </div>
                {cost.margin < 0 && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
                    <AlertCircle size={12} />
                    <span>El costo supera el precio de venta. Revisar precios o reducir costos.</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  )
}
