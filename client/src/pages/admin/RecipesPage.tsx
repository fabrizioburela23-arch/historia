import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, GitBranch, ChevronDown, ChevronRight, Clock, CheckSquare, FlaskConical, AlertCircle, Cpu, Tag } from 'lucide-react'
import api from '../../lib/api'
import { Recipe, RecipeStep, Material, ProcessType } from '../../types'
import Modal from '../../components/Modal'

const PROCESS_TYPES: { value: ProcessType; label: string; color: string }[] = [
  { value: 'PREPARATION', label: 'Preparación', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'MIXING', label: 'Mezcla/Mezclado', color: 'bg-blue-100 text-blue-800' },
  { value: 'COOKING', label: 'Cocción/Tratamiento', color: 'bg-red-100 text-red-800' },
  { value: 'COOLING', label: 'Enfriamiento', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'PACKAGING', label: 'Empaque', color: 'bg-purple-100 text-purple-800' },
  { value: 'QC', label: 'Control de Calidad', color: 'bg-green-100 text-green-800' },
  { value: 'TRANSPORT', label: 'Transporte/Traslado', color: 'bg-orange-100 text-orange-800' },
  { value: 'OTHER', label: 'Otro', color: 'bg-gray-100 text-gray-700' }
]

function processLabel(type: ProcessType) {
  return PROCESS_TYPES.find(p => p.value === type) || PROCESS_TYPES[PROCESS_TYPES.length - 1]
}

interface StepMaterial { materialId: string; quantity: number; unit: string }
interface StepForm {
  name: string; description: string; processType: ProcessType
  machineRequired: boolean; targetTimeMinutes: number
  checklistItems: { label: string; required: boolean }[]
  materials: StepMaterial[]
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [allMaterials, setAllMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [recipeModal, setRecipeModal] = useState(false)
  const [stepModal, setStepModal] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('')
  const [recipeForm, setRecipeForm] = useState({ name: '', description: '', targetTimeMinutes: 0, version: '1.0' })
  const [stepForm, setStepForm] = useState<StepForm>({
    name: '', description: '', processType: 'OTHER', machineRequired: false,
    targetTimeMinutes: 0, checklistItems: [], materials: []
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [rec, mat] = await Promise.all([
      api.get<Recipe[]>('/recipes'),
      api.get<Material[]>('/materials')
    ])
    setRecipes(rec.data)
    setAllMaterials(mat.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreateRecipe() {
    setEditingRecipe(null)
    setRecipeForm({ name: '', description: '', targetTimeMinutes: 0, version: '1.0' })
    setError('')
    setRecipeModal(true)
  }

  function openEditRecipe(r: Recipe) {
    setEditingRecipe(r)
    setRecipeForm({ name: r.name, description: r.description || '', targetTimeMinutes: r.targetTimeMinutes, version: r.version })
    setError('')
    setRecipeModal(true)
  }

  async function saveRecipe() {
    if (!recipeForm.name) { setError('Nombre requerido'); return }
    setSaving(true)
    try {
      if (editingRecipe) {
        await api.put(`/recipes/${editingRecipe.id}`, recipeForm)
      } else {
        await api.post('/recipes', recipeForm)
      }
      setRecipeModal(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  function openAddStep(recipeId: string) {
    setSelectedRecipeId(recipeId)
    setStepForm({
      name: '', description: '', processType: 'OTHER', machineRequired: false,
      targetTimeMinutes: 0, checklistItems: [], materials: []
    })
    setError('')
    setStepModal(true)
  }

  async function saveStep() {
    if (!stepForm.name) { setError('Nombre del paso requerido'); return }
    setSaving(true)
    try {
      await api.post(`/recipes/${selectedRecipeId}/steps`, stepForm)
      setStepModal(false)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error')
    } finally { setSaving(false) }
  }

  async function deleteStep(recipeId: string, stepId: string) {
    if (!confirm('¿Eliminar este paso?')) return
    await api.delete(`/recipes/${recipeId}/steps/${stepId}`)
    load()
  }

  async function deleteRecipe(r: Recipe) {
    if (!confirm(`¿Eliminar el flujo "${r.name}"?`)) return
    await api.delete(`/recipes/${r.id}`)
    load()
  }

  function addChecklistItem() {
    setStepForm(f => ({ ...f, checklistItems: [...f.checklistItems, { label: '', required: true }] }))
  }

  function addMaterial() {
    if (allMaterials.length === 0) return
    setStepForm(f => ({ ...f, materials: [...f.materials, { materialId: '', quantity: 1, unit: '' }] }))
  }

  const totalMinutes = (recipe: Recipe) => recipe.steps.reduce((acc, s) => acc + s.targetTimeMinutes, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flujos de Producción</h1>
          <p className="text-gray-500 text-sm mt-1">{recipes.length} flujos registrados</p>
        </div>
        <button onClick={openCreateRecipe} className="btn-primary"><Plus size={16} /> Nuevo Flujo</button>
      </div>

      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
      ) : recipes.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <GitBranch size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Sin flujos de producción registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map(r => (
            <div key={r.id} className="card overflow-hidden">
              {/* Header */}
              <div className="flex items-center px-5 py-4 gap-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                {expanded === r.id ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                <GitBranch size={18} className="text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800">{r.name}</p>
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono">v{r.version}</span>
                  </div>
                  {r.description && <p className="text-xs text-gray-500 truncate">{r.description}</p>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                  <span className="flex items-center gap-1"><Clock size={12} /> {totalMinutes(r)} min</span>
                  <span>{r.steps.length} procesos</span>
                </div>
                <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEditRecipe(r)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"><Pencil size={14} /></button>
                  <button onClick={() => deleteRecipe(r)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Process flow */}
              {expanded === r.id && (
                <div className="border-t bg-gray-50/50 px-5 py-4 space-y-3">
                  {/* Visual timeline */}
                  {r.steps.length > 0 && (
                    <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-4">
                      {r.steps.map((step: RecipeStep, idx: number) => {
                        const pt = processLabel(step.processType)
                        return (
                          <div key={step.id} className="flex items-center shrink-0">
                            <div className={`px-2 py-1 rounded-lg text-xs font-medium ${pt.color}`}>
                              {idx + 1}. {step.name}
                            </div>
                            {idx < r.steps.length - 1 && (
                              <ChevronRight size={14} className="text-gray-300 mx-0.5" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {r.steps.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-2">Sin procesos definidos</p>
                  ) : (
                    r.steps.map((step: RecipeStep, idx: number) => {
                      const pt = processLabel(step.processType)
                      return (
                        <div key={step.id} className="flex items-start gap-3 bg-white border rounded-xl p-4">
                          <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-gray-800">{step.name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pt.color}`}>{pt.label}</span>
                              <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={11} />{step.targetTimeMinutes} min</span>
                              {step.machineRequired && (
                                <span className="text-xs text-orange-600 flex items-center gap-1 bg-orange-50 px-1.5 py-0.5 rounded"><Cpu size={10} />Req. Máquina</span>
                              )}
                            </div>
                            {step.description && <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>}

                            {/* Materials */}
                            {step.materials && step.materials.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-xs font-medium text-gray-500 flex items-center gap-1"><FlaskConical size={11} />Materiales:</p>
                                <div className="flex flex-wrap gap-1">
                                  {step.materials.map(sm => (
                                    <span key={sm.id} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                      {sm.material.name}: {sm.quantity} {sm.unit || sm.material.unit}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Checklist */}
                            {step.checklistItems.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-xs font-medium text-gray-500 flex items-center gap-1"><CheckSquare size={11} />Verificaciones:</p>
                                {step.checklistItems.map(c => (
                                  <div key={c.id} className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <CheckSquare size={12} className="text-indigo-400" />
                                    {c.label}
                                    {c.required && <span className="text-red-400">*</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <button onClick={() => deleteStep(r.id, step.id)} className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
                        </div>
                      )
                    })
                  )}
                  <button onClick={() => openAddStep(r.id)} className="btn-secondary w-full justify-center text-xs py-2">
                    <Plus size={14} /> Agregar Proceso
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recipe Modal */}
      <Modal open={recipeModal} onClose={() => setRecipeModal(false)} title={editingRecipe ? 'Editar Flujo' : 'Nuevo Flujo de Producción'}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="label">Nombre del Flujo *</label>
            <input className="input" value={recipeForm.name} onChange={e => setRecipeForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Línea de Envasado Producto A" />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={recipeForm.description} onChange={e => setRecipeForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción del proceso productivo..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tiempo Total Objetivo (min)</label>
              <input type="number" className="input" value={recipeForm.targetTimeMinutes} min={0} onChange={e => setRecipeForm(f => ({ ...f, targetTimeMinutes: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Versión</label>
              <input className="input" value={recipeForm.version} onChange={e => setRecipeForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setRecipeModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={saveRecipe} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </Modal>

      {/* Step Modal */}
      <Modal open={stepModal} onClose={() => setStepModal(false)} title="Agregar Proceso" size="lg">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre del Proceso *</label>
              <input className="input" value={stepForm.name} onChange={e => setStepForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Mezcla de ingredientes" />
            </div>
            <div>
              <label className="label">Tipo de Proceso</label>
              <select className="input" value={stepForm.processType} onChange={e => setStepForm(f => ({ ...f, processType: e.target.value as ProcessType }))}>
                {PROCESS_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tiempo Objetivo (min)</label>
              <input type="number" className="input" value={stepForm.targetTimeMinutes} min={0} onChange={e => setStepForm(f => ({ ...f, targetTimeMinutes: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>

          <div>
            <label className="label">Descripción / Instrucciones</label>
            <textarea className="input resize-none" rows={2} value={stepForm.description} onChange={e => setStepForm(f => ({ ...f, description: e.target.value }))} placeholder="Instrucciones del proceso..." />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="machReq" checked={stepForm.machineRequired} onChange={e => setStepForm(f => ({ ...f, machineRequired: e.target.checked }))} className="rounded" />
            <label htmlFor="machReq" className="text-sm text-gray-700 flex items-center gap-1 cursor-pointer">
              <Cpu size={14} className="text-orange-500" />
              Requiere máquina específica
            </label>
          </div>

          {/* Materials section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0 flex items-center gap-1"><FlaskConical size={13} />Materiales / Insumos</label>
              {allMaterials.length > 0 ? (
                <button onClick={addMaterial} className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1"><Plus size={12} /> Agregar</button>
              ) : (
                <span className="text-xs text-gray-400 flex items-center gap-1"><AlertCircle size={11} />Sin materiales registrados</span>
              )}
            </div>
            <div className="space-y-2">
              {stepForm.materials.map((mat, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <select
                    className="input flex-1 text-sm py-1.5"
                    value={mat.materialId}
                    onChange={e => setStepForm(f => ({ ...f, materials: f.materials.map((m, mi) => mi === i ? { ...m, materialId: e.target.value } : m) }))}
                  >
                    <option value="">— Material —</option>
                    {allMaterials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                  </select>
                  <input
                    type="number"
                    className="input w-24 text-sm py-1.5"
                    placeholder="Cant."
                    min={0}
                    step={0.01}
                    value={mat.quantity}
                    onChange={e => setStepForm(f => ({ ...f, materials: f.materials.map((m, mi) => mi === i ? { ...m, quantity: parseFloat(e.target.value) || 0 } : m) }))}
                  />
                  <input
                    className="input w-20 text-sm py-1.5"
                    placeholder="Unidad"
                    value={mat.unit}
                    onChange={e => setStepForm(f => ({ ...f, materials: f.materials.map((m, mi) => mi === i ? { ...m, unit: e.target.value } : m) }))}
                  />
                  <button onClick={() => setStepForm(f => ({ ...f, materials: f.materials.filter((_, mi) => mi !== i) }))} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={13} /></button>
                </div>
              ))}
              {stepForm.materials.length === 0 && <p className="text-xs text-gray-400 text-center py-1">Sin materiales asignados</p>}
            </div>
          </div>

          {/* Checklist section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0 flex items-center gap-1"><CheckSquare size={13} />Verificaciones / Checklist</label>
              <button onClick={addChecklistItem} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus size={12} /> Agregar</button>
            </div>
            <div className="space-y-2">
              {stepForm.checklistItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="input flex-1 text-sm py-1.5"
                    value={item.label}
                    onChange={e => setStepForm(f => ({ ...f, checklistItems: f.checklistItems.map((c, ci) => ci === i ? { ...c, label: e.target.value } : c) }))}
                    placeholder={`Ítem ${i + 1}...`}
                  />
                  <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0 cursor-pointer">
                    <input type="checkbox" checked={item.required} onChange={e => setStepForm(f => ({ ...f, checklistItems: f.checklistItems.map((c, ci) => ci === i ? { ...c, required: e.target.checked } : c) }))} />
                    Req.
                  </label>
                  <button onClick={() => setStepForm(f => ({ ...f, checklistItems: f.checklistItems.filter((_, ci) => ci !== i) }))} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={13} /></button>
                </div>
              ))}
              {stepForm.checklistItems.length === 0 && <p className="text-xs text-gray-400 text-center py-1">Sin verificaciones</p>}
            </div>
          </div>

          {/* Tags hint */}
          <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
            <Tag size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">Los materiales y verificaciones quedan registrados en el historial de cada ejecución de lote.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setStepModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={saveStep} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Agregar Proceso'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
