import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, BookOpen, ChevronDown, ChevronRight, Clock, CheckSquare } from 'lucide-react'
import api from '../../lib/api'
import { Recipe, RecipeStep } from '../../types'
import Modal from '../../components/Modal'

interface StepForm { name: string; description: string; targetTimeMinutes: number; checklistItems: { label: string; required: boolean }[] }

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [recipeModal, setRecipeModal] = useState(false)
  const [stepModal, setStepModal] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('')
  const [recipeForm, setRecipeForm] = useState({ name: '', description: '', targetTimeMinutes: 0 })
  const [stepForm, setStepForm] = useState<StepForm>({ name: '', description: '', targetTimeMinutes: 0, checklistItems: [] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get<Recipe[]>('/recipes')
    setRecipes(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreateRecipe() {
    setEditingRecipe(null)
    setRecipeForm({ name: '', description: '', targetTimeMinutes: 0 })
    setError('')
    setRecipeModal(true)
  }

  function openEditRecipe(r: Recipe) {
    setEditingRecipe(r)
    setRecipeForm({ name: r.name, description: r.description || '', targetTimeMinutes: r.targetTimeMinutes })
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
    setStepForm({ name: '', description: '', targetTimeMinutes: 0, checklistItems: [] })
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
    if (!confirm(`¿Eliminar la receta "${r.name}"?`)) return
    await api.delete(`/recipes/${r.id}`)
    load()
  }

  function addChecklistItem() {
    setStepForm(f => ({ ...f, checklistItems: [...f.checklistItems, { label: '', required: true }] }))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
          <p className="text-gray-500 text-sm mt-1">{recipes.length} recetas registradas</p>
        </div>
        <button onClick={openCreateRecipe} className="btn-primary"><Plus size={16} /> Nueva Receta</button>
      </div>

      {loading ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin h-6 w-6 rounded-full border-b-2 border-indigo-600" /></div>
      ) : recipes.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <BookOpen size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Sin recetas registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map(r => (
            <div key={r.id} className="card overflow-hidden">
              <div className="flex items-center px-5 py-4 gap-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                {expanded === r.id ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                <BookOpen size={18} className="text-indigo-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{r.name}</p>
                  {r.description && <p className="text-xs text-gray-500 truncate">{r.description}</p>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                  <span className="flex items-center gap-1"><Clock size={12} /> {r.targetTimeMinutes} min</span>
                  <span>{r.steps.length} pasos</span>
                </div>
                <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEditRecipe(r)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"><Pencil size={14} /></button>
                  <button onClick={() => deleteRecipe(r)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>

              {expanded === r.id && (
                <div className="border-t bg-gray-50/50 px-5 py-4 space-y-3">
                  {r.steps.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-2">Sin pasos definidos</p>
                  ) : (
                    r.steps.map((step: RecipeStep, idx: number) => (
                      <div key={step.id} className="flex items-start gap-3 bg-white border rounded-xl p-4">
                        <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-gray-800">{step.name}</p>
                            <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={11} />{step.targetTimeMinutes} min</span>
                          </div>
                          {step.description && <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>}
                          {step.checklistItems.length > 0 && (
                            <div className="mt-2 space-y-1">
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
                    ))
                  )}
                  <button onClick={() => openAddStep(r.id)} className="btn-secondary w-full justify-center text-xs py-2">
                    <Plus size={14} /> Agregar Paso
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recipe Modal */}
      <Modal open={recipeModal} onClose={() => setRecipeModal(false)} title={editingRecipe ? 'Editar Receta' : 'Nueva Receta'}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={recipeForm.name} onChange={e => setRecipeForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Procesado de Tomate" />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={recipeForm.description} onChange={e => setRecipeForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Tiempo Objetivo Total (min)</label>
            <input type="number" className="input" value={recipeForm.targetTimeMinutes} min={0} onChange={e => setRecipeForm(f => ({ ...f, targetTimeMinutes: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setRecipeModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={saveRecipe} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </Modal>

      {/* Step Modal */}
      <Modal open={stepModal} onClose={() => setStepModal(false)} title="Agregar Paso" size="lg">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="label">Nombre del Paso *</label>
            <input className="input" value={stepForm.name} onChange={e => setStepForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Preparación de Materia Prima" />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={stepForm.description} onChange={e => setStepForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Tiempo Objetivo (min)</label>
            <input type="number" className="input" value={stepForm.targetTimeMinutes} min={0} onChange={e => setStepForm(f => ({ ...f, targetTimeMinutes: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Checklist</label>
              <button onClick={addChecklistItem} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus size={12} /> Agregar ítem</button>
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
                  <button onClick={() => setStepForm(f => ({ ...f, checklistItems: f.checklistItems.filter((_, ci) => ci !== i) }))} className="text-gray-300 hover:text-red-500 p-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {stepForm.checklistItems.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Sin ítems de checklist</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setStepModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={saveStep} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Agregar Paso'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
