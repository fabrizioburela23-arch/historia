import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, CheckSquare, Square, AlertCircle, CheckCircle2, Cpu, Clock, FlaskConical, ChevronDown, ChevronRight } from 'lucide-react'
import api from '../../lib/api'
import { BatchExecution, ProcessExecution, Machine } from '../../types'
import StatusBadge from '../../components/StatusBadge'

interface CompleteForm {
  machineId: string
  manHours: string
  machineHours: string
  waste: string
  wasteUnit: string
  observations: string
  checklistCompletions: { checklistItemId: string; completed: boolean }[]
  materialConsumptions: { rawMaterialId: string; actualQty: string; unit: string; notes: string }[]
}

export default function ExecutionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [execution, setExecution] = useState<BatchExecution | null>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [activeProcess, setActiveProcess] = useState<ProcessExecution | null>(null)
  const [form, setForm] = useState<CompleteForm>({ machineId: '', manHours: '', machineHours: '', waste: '', wasteUnit: '', observations: '', checklistCompletions: [], materialConsumptions: [] })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: exec }, { data: mach }] = await Promise.all([
      api.get<BatchExecution>(`/executions/${id}`),
      api.get<Machine[]>('/machines')
    ])
    setExecution(exec)
    setMachines(mach)
    const inProgress = exec.processExecutions.find(p => p.status === 'IN_PROGRESS')
    const nextPending = exec.processExecutions.find(p => p.status === 'PENDING')
    const current = inProgress || nextPending || null
    if (current && (!activeProcess || activeProcess.id !== current.id)) {
      setActiveProcess(current)
      initForm(current, exec)
    }
    setLoading(false)
  }, [id])

  function initForm(proc: ProcessExecution, exec: BatchExecution) {
    const bom = exec.batch.recipe.bom || []
    setForm({
      machineId: proc.routingStep.preferredMachineId || '',
      manHours: '',
      machineHours: (proc.routingStep.targetDurationMin / 60).toFixed(2),
      waste: '',
      wasteUnit: '',
      observations: '',
      checklistCompletions: proc.routingStep.operation.checklistItems.map(item => ({
        checklistItemId: item.id,
        completed: proc.checklistCompletions.find(c => c.checklistItemId === item.id)?.completed ?? false
      })),
      materialConsumptions: bom.map(item => ({
        rawMaterialId: item.rawMaterialId,
        actualQty: item.quantity.toString(),
        unit: item.unit || item.rawMaterial.unit,
        notes: ''
      }))
    })
  }

  useEffect(() => { load() }, [load])

  async function startProcess(processId: string) {
    setSubmitting(true)
    setError('')
    try {
      await api.put(`/executions/${id}/processes/${processId}/start`)
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al iniciar')
    } finally { setSubmitting(false) }
  }

  async function completeProcess(processId: string) {
    if (!form.manHours) { setError('Las horas-hombre son requeridas'); return }
    const requiredItems = activeProcess?.routingStep.operation.checklistItems.filter(i => i.required) || []
    const missingRequired = requiredItems.filter(item => {
      const completion = form.checklistCompletions.find(c => c.checklistItemId === item.id)
      return !completion?.completed
    })
    if (missingRequired.length > 0) {
      setError(`Debes completar los ítems requeridos: ${missingRequired.map(i => i.label).join(', ')}`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.put(`/executions/${id}/processes/${processId}/complete`, {
        machineId: form.machineId || undefined,
        manHours: parseFloat(form.manHours) || 0,
        machineHours: form.machineHours ? parseFloat(form.machineHours) : undefined,
        waste: form.waste ? parseFloat(form.waste) : undefined,
        wasteUnit: form.wasteUnit || undefined,
        observations: form.observations || undefined,
        checklistCompletions: form.checklistCompletions,
        materialConsumptions: form.materialConsumptions
          .filter(c => parseFloat(c.actualQty) > 0)
          .map(c => ({ ...c, actualQty: parseFloat(c.actualQty) }))
      })
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error al completar')
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="animate-spin h-8 w-8 rounded-full border-b-2 border-indigo-600" /></div>
  if (!execution) return <div className="p-6 text-red-600">Ejecución no encontrada</div>

  const allDone = execution.processExecutions.every(p => p.status === 'COMPLETED' || p.status === 'SKIPPED')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/operator')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-lg text-gray-900">{execution.batch.name}</h1>
          <p className="text-sm text-gray-500">{execution.batch.recipe.name}</p>
        </div>
        <StatusBadge status={execution.status} />
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {allDone && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Lote completado</p>
              <p className="text-sm text-green-600">Todos los procesos han sido ejecutados</p>
            </div>
          </div>
        )}

        {/* Process steps */}
        {execution.processExecutions.map((proc, idx) => {
          const isActive = activeProcess?.id === proc.id
          const isDone = proc.status === 'COMPLETED' || proc.status === 'SKIPPED'
          const isPending = proc.status === 'PENDING'
          const isInProgress = proc.status === 'IN_PROGRESS'
          const isExpandable = isDone || isActive

          return (
            <div key={proc.id} className={`card overflow-hidden ${isActive ? 'ring-2 ring-indigo-500' : ''}`}>
              <div
                className={`flex items-center gap-3 px-5 py-4 ${isExpandable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={() => isExpandable && setExpanded(expanded === proc.id ? null : proc.id)}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isDone ? 'bg-green-100 text-green-700' : isInProgress ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
                  {isDone ? <CheckCircle2 size={16} /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-800">{proc.routingStep.operation.name}</p>
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{proc.routingStep.operation.code}</span>
                    <StatusBadge status={proc.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1"><Clock size={10} />{proc.routingStep.targetDurationMin} min objetivo</span>
                    {proc.routingStep.preferredMachine && <span className="flex items-center gap-1"><Cpu size={10} />{proc.routingStep.preferredMachine.name}</span>}
                    {proc.routingStep.operation.checklistItems.length > 0 && <span>{proc.routingStep.operation.checklistItems.length} verificaciones</span>}
                  </div>
                </div>
                {isExpandable && (expanded === proc.id ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />)}
              </div>

              {/* Expand completed */}
              {isDone && expanded === proc.id && (
                <div className="border-t bg-gray-50/50 px-5 py-3 text-sm text-gray-600 space-y-1">
                  {proc.manHours != null && <p><span className="font-medium">Horas-hombre:</span> {proc.manHours}h</p>}
                  {proc.machineHours != null && <p><span className="font-medium">Horas-máquina:</span> {proc.machineHours}h</p>}
                  {proc.machine && <p><span className="font-medium">Máquina usada:</span> {proc.machine.name}</p>}
                  {proc.waste != null && <p><span className="font-medium">Merma:</span> {proc.waste} {proc.wasteUnit || ''}</p>}
                  {proc.observations && <p><span className="font-medium">Observaciones:</span> {proc.observations}</p>}
                </div>
              )}

              {/* Active process form */}
              {isActive && (expanded === proc.id || isPending || isInProgress) && (
                <div className="border-t px-5 py-5 space-y-5">
                  {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

                  {isPending && (
                    <button onClick={() => startProcess(proc.id)} disabled={submitting} className="btn-primary w-full justify-center">
                      <Play size={15} /> Iniciar Proceso
                    </button>
                  )}

                  {isInProgress && (
                    <>
                      {/* Machine selector */}
                      <div>
                        <label className="label flex items-center gap-1"><Cpu size={12} />Máquina Utilizada</label>
                        <select className="input" value={form.machineId} onChange={e => setForm(f => ({ ...f, machineId: e.target.value }))}>
                          <option value="">— Sin máquina —</option>
                          {machines.filter(m => m.status === 'ACTIVE').map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                        </select>
                      </div>

                      {/* Hours */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Horas-Hombre *</label>
                          <input type="number" min="0" step="0.25" className="input" value={form.manHours} onChange={e => setForm(f => ({ ...f, manHours: e.target.value }))} placeholder="0.00" />
                        </div>
                        <div>
                          <label className="label">Horas-Máquina</label>
                          <input type="number" min="0" step="0.25" className="input" value={form.machineHours} onChange={e => setForm(f => ({ ...f, machineHours: e.target.value }))} placeholder="0.00" />
                        </div>
                      </div>

                      {/* Waste */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Merma / Desperdicio</label>
                          <input type="number" min="0" step="0.01" className="input" value={form.waste} onChange={e => setForm(f => ({ ...f, waste: e.target.value }))} placeholder="0.00" />
                        </div>
                        <div>
                          <label className="label">Unidad Merma</label>
                          <input className="input" value={form.wasteUnit} onChange={e => setForm(f => ({ ...f, wasteUnit: e.target.value }))} placeholder="kg, L..." />
                        </div>
                      </div>

                      {/* Checklist */}
                      {form.checklistCompletions.length > 0 && (
                        <div>
                          <p className="label mb-2">Verificaciones</p>
                          <div className="space-y-2">
                            {form.checklistCompletions.map((item, i) => {
                              const checkItem = proc.routingStep.operation.checklistItems.find(c => c.id === item.checklistItemId)
                              return (
                                <label key={item.checklistItemId} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-gray-100">
                                  <button
                                    type="button"
                                    onClick={() => setForm(f => ({
                                      ...f,
                                      checklistCompletions: f.checklistCompletions.map((c, ci) => ci === i ? { ...c, completed: !c.completed } : c)
                                    }))}
                                    className={`shrink-0 ${item.completed ? 'text-green-600' : 'text-gray-300'}`}
                                  >
                                    {item.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                                  </button>
                                  <span className="text-sm flex-1">{checkItem?.label}</span>
                                  {checkItem?.required && <span className="text-xs text-red-400 shrink-0">Requerido</span>}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Material consumptions */}
                      {form.materialConsumptions.length > 0 && (
                        <div>
                          <p className="label mb-2 flex items-center gap-1"><FlaskConical size={12} />Consumo de Materiales (basado en receta)</p>
                          <div className="space-y-2">
                            {form.materialConsumptions.map((item, i) => {
                              const bom = execution.batch.recipe.bom?.find(b => b.rawMaterialId === item.rawMaterialId)
                              return (
                                <div key={item.rawMaterialId} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 truncate">{bom?.rawMaterial.name || item.rawMaterialId}</p>
                                    <p className="text-xs text-gray-400">Planificado: {bom?.quantity} {item.unit}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <input
                                      type="number" min="0" step="0.001"
                                      className="input w-24 text-sm py-1.5"
                                      value={item.actualQty}
                                      onChange={e => setForm(f => ({
                                        ...f,
                                        materialConsumptions: f.materialConsumptions.map((c, ci) => ci === i ? { ...c, actualQty: e.target.value } : c)
                                      }))}
                                    />
                                    <span className="text-xs text-gray-500 w-10">{item.unit}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="label">Observaciones</label>
                        <textarea className="input resize-none" rows={2} value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Notas del operario..." />
                      </div>

                      <button onClick={() => completeProcess(proc.id)} disabled={submitting} className="btn-primary w-full justify-center">
                        <CheckCircle2 size={15} /> {submitting ? 'Guardando...' : 'Completar Proceso'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
