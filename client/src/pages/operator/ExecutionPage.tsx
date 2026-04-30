import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, CheckSquare, Square, AlertCircle, CheckCircle2, Lock, ChevronRight } from 'lucide-react'
import api from '../../lib/api'
import { BatchExecution, StepExecution, ChecklistCompletion } from '../../types'
import Timer from '../../components/Timer'
import StatusBadge from '../../components/StatusBadge'

interface CompleteForm {
  waste: string
  observations: string
  checklistCompletions: { checklistItemId: string; completed: boolean }[]
}

export default function ExecutionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [execution, setExecution] = useState<BatchExecution | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState<StepExecution | null>(null)
  const [form, setForm] = useState<CompleteForm>({ waste: '', observations: '', checklistCompletions: [] })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await api.get<BatchExecution>(`/executions/${id}`)
    setExecution(data)
    const inProgress = data.stepExecutions.find(s => s.status === 'IN_PROGRESS')
    const nextPending = data.stepExecutions.find(s => s.status === 'PENDING')
    const current = inProgress || nextPending || null
    setActiveStep(current)

    if (current) {
      setForm({
        waste: current.waste?.toString() || '',
        observations: current.observations || '',
        checklistCompletions: current.checklistCompletions.map((cc: ChecklistCompletion) => ({
          checklistItemId: cc.checklistItemId,
          completed: cc.completed
        }))
      })
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleStartStep() {
    if (!activeStep) return
    setError('')
    try {
      await api.put(`/executions/${id}/steps/${activeStep.id}/start`)
      await load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al iniciar')
    }
  }

  async function handleCompleteStep() {
    if (!activeStep) return
    const required = activeStep.recipeStep.checklistItems.filter(c => c.required)
    const completedRequired = required.every(r => form.checklistCompletions.find(cc => cc.checklistItemId === r.id)?.completed)
    if (!completedRequired) {
      setError('Debes completar todos los ítems requeridos del checklist antes de finalizar')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.put(`/executions/${id}/steps/${activeStep.id}/complete`, form)
      await load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al completar')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleChecklist(checklistItemId: string) {
    setForm(f => ({
      ...f,
      checklistCompletions: f.checklistCompletions.map(cc =>
        cc.checklistItemId === checklistItemId ? { ...cc, completed: !cc.completed } : cc
      )
    }))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-indigo-600" />
    </div>
  )

  if (!execution) return (
    <div className="p-6 text-center text-gray-500">Ejecución no encontrada</div>
  )

  const steps = execution.stepExecutions
  const totalSteps = steps.length
  const completedCount = steps.filter(s => s.status === 'COMPLETED').length
  const progressPct = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0

  if (execution.status === 'COMPLETED') {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/operator')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="card p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-green-100 rounded-full">
              <CheckCircle2 size={48} className="text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">¡Lote Completado!</h2>
          <p className="text-gray-500">{execution.batch.name} — {execution.batch.recipe.name}</p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {steps.map(s => (
              <div key={s.id} className="bg-gray-50 rounded-xl p-3 text-left">
                <p className="text-xs font-medium text-gray-600">{s.recipeStep.name}</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {s.actualTimeSeconds ? `${Math.floor(s.actualTimeSeconds / 60)}m ${s.actualTimeSeconds % 60}s` : '—'}
                  <span className="text-xs font-normal text-gray-400 ml-1">/ {s.recipeStep.targetTimeMinutes}m obj.</span>
                </p>
                {s.waste !== null && s.waste !== undefined && <p className="text-xs text-orange-600 mt-0.5">Merma: {s.waste}%</p>}
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/operator')} className="btn-primary mx-auto">
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/operator')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 text-lg truncate">{execution.batch.name}</h1>
          <p className="text-xs text-gray-500">{execution.batch.recipe.name} · {execution.batch.machine.name}</p>
        </div>
        <StatusBadge status={execution.status} />
      </div>

      {/* Progress */}
      <div className="card p-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span className="font-medium">Progreso del Lote</span>
          <span>{completedCount}/{totalSteps} pasos</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        {/* Step indicators */}
        <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1 shrink-0">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                step.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                step.id === activeStep?.id ? 'bg-indigo-600 text-white' :
                'bg-gray-100 text-gray-400'
              }`}>
                {step.status === 'COMPLETED' ? <CheckCircle2 size={11} /> : step.id !== activeStep?.id && i > completedCount ? <Lock size={11} /> : null}
                {i + 1}. {step.recipeStep.name}
              </div>
              {i < steps.length - 1 && <ChevronRight size={12} className="text-gray-300" />}
            </div>
          ))}
        </div>
      </div>

      {/* Active Step */}
      {activeStep && (
        <div className="space-y-4">
          <div className="card p-5 border-l-4 border-l-indigo-500">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Paso Actual</span>
                <h2 className="text-xl font-bold text-gray-900 mt-0.5">{activeStep.recipeStep.name}</h2>
              </div>
              <StatusBadge status={activeStep.status} />
            </div>
            {activeStep.recipeStep.description && (
              <p className="text-sm text-gray-600">{activeStep.recipeStep.description}</p>
            )}
          </div>

          {/* Timer */}
          <Timer
            startedAt={activeStep.startedAt}
            targetMinutes={activeStep.recipeStep.targetTimeMinutes}
            running={activeStep.status === 'IN_PROGRESS'}
          />

          {/* Checklist */}
          {activeStep.recipeStep.checklistItems.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Checklist de Verificación</h3>
              <div className="space-y-2">
                {activeStep.recipeStep.checklistItems.map(item => {
                  const cc = form.checklistCompletions.find(c => c.checklistItemId === item.id)
                  const checked = cc?.completed || false
                  const canEdit = activeStep.status === 'IN_PROGRESS'
                  return (
                    <button
                      key={item.id}
                      onClick={() => canEdit && toggleChecklist(item.id)}
                      disabled={!canEdit}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${checked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-indigo-200'} ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {checked
                        ? <CheckSquare size={18} className="text-green-600 shrink-0" />
                        : <Square size={18} className="text-gray-300 shrink-0" />
                      }
                      <span className={`text-sm ${checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {item.label}
                      </span>
                      {item.required && <span className="ml-auto text-red-400 text-xs shrink-0">Requerido</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Complete form (only shown when step is IN_PROGRESS) */}
          {activeStep.status === 'IN_PROGRESS' && (
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-gray-800">Datos de Cierre</h3>
              <div>
                <label className="label">Merma (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="input"
                  value={form.waste}
                  onChange={e => setForm(f => ({ ...f, waste: e.target.value }))}
                  placeholder="Ej: 2.5"
                />
              </div>
              <div>
                <label className="label">Observaciones / Comentarios de Calidad</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={form.observations}
                  onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                  placeholder="Anota cualquier incidencia, ajuste o novedad del proceso..."
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {activeStep.status === 'PENDING' && (
              <button onClick={handleStartStep} className="btn-primary flex-1 justify-center py-3 text-base">
                <Play size={18} /> Iniciar Paso
              </button>
            )}
            {activeStep.status === 'IN_PROGRESS' && (
              <button onClick={handleCompleteStep} disabled={submitting} className="flex-1 justify-center py-3 text-base inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50">
                <CheckCircle2 size={18} />
                {submitting ? 'Finalizando...' : 'Finalizar Paso'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Completed steps summary */}
      {steps.filter(s => s.status === 'COMPLETED').length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-sm text-gray-700">Pasos Completados</h3>
          </div>
          <div className="divide-y">
            {steps.filter(s => s.status === 'COMPLETED').map(s => (
              <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">{s.recipeStep.name}</p>
                  {s.observations && <p className="text-xs text-gray-400 truncate">{s.observations}</p>}
                </div>
                <div className="text-right text-xs text-gray-500 shrink-0">
                  <p>{s.actualTimeSeconds ? `${Math.floor(s.actualTimeSeconds / 60)}m ${s.actualTimeSeconds % 60}s` : '—'}</p>
                  {s.waste !== null && s.waste !== undefined && <p className="text-orange-500">Merma: {s.waste}%</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
