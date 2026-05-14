import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, CheckCircle2, Square, AlertCircle, Clock, ArrowRight, Save } from 'lucide-react'
import api from '../../lib/api'
import { Batch, BatchFlow, BatchStep } from '../../types'
import StatusBadge from '../../components/StatusBadge'

function yieldOf(bf: BatchFlow): number | null {
  if (!bf.inputQtyActual || bf.inputQtyActual <= 0 || bf.outputQtyActual == null) return null
  return (bf.outputQtyActual / bf.inputQtyActual) * 100
}

export default function BatchExecutionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [batch, setBatch] = useState<Batch | null>(null)
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null)

  async function load() {
    const { data } = await api.get<Batch>(`/batches/${id}`)
    setBatch(data)
    if (!activeFlowId && data.flows.length > 0) {
      setActiveFlowId(data.flows[0].id)
    }
  }
  useEffect(() => { load() }, [id])

  if (!batch) return <div className="p-6 text-gray-400">Cargando...</div>

  const activeFlow = batch.flows.find(f => f.id === activeFlowId) || batch.flows[0]

  async function startBatch() { await api.post(`/batches/${batch!.id}/start`); load() }
  async function completeBatch() {
    if (!confirm('¿Marcar el lote completo como terminado?')) return
    await api.post(`/batches/${batch!.id}/complete`); load()
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded hover:bg-gray-100"><ArrowLeft size={16}/></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{batch.name}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-gray-500">
            <span>{batch.mode === 'RECIPE' ? `Receta: ${batch.recipe?.name}` : 'Monoelemento'}</span>
            <span>·</span>
            <span>{batch.executionMode === 'PARALLEL' ? 'Ejecución paralela' : 'Ejecución secuencial'}</span>
            {batch.supervisorName && <><span>·</span><span>Sup: {batch.supervisorName}</span></>}
          </div>
        </div>
        <StatusBadge status={batch.status}/>
      </div>

      {batch.status === 'PENDING' && (
        <button onClick={startBatch} className="btn-primary"><Play size={14}/> Iniciar lote</button>
      )}
      {batch.status === 'IN_PROGRESS' && batch.flows.every(f => f.status === 'COMPLETED') && (
        <button onClick={completeBatch} className="btn-primary bg-green-600 hover:bg-green-700"><CheckCircle2 size={14}/> Cerrar lote</button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Lista de flujos */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase">Flujos del lote</p>
          {batch.flows.map((f, i) => {
            const y = yieldOf(f)
            return (
              <button key={f.id} onClick={() => setActiveFlowId(f.id)}
                className={`w-full text-left p-3 rounded-lg border ${activeFlowId === f.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-indigo-600">#{i+1}</span>
                  <span className="font-medium text-sm truncate flex-1">{f.flow.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <StatusBadge status={f.status}/>
                  {y !== null && <span className={`text-xs font-mono ${y >= 80 ? 'text-green-700' : 'text-amber-700'}`}>{y.toFixed(1)}%</span>}
                </div>
              </button>
            )
          })}
          {batch.status === 'COMPLETED' && (
            <div className="card p-3 mt-3 text-center">
              <p className="text-xs text-gray-500">Rendimiento total</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">
                {(() => {
                  const inSum = batch.flows.reduce((s, f) => s + (f.inputQtyActual || 0), 0)
                  const outSum = batch.flows.reduce((s, f) => s + (f.outputQtyActual || 0), 0)
                  return inSum > 0 ? `${((outSum / inSum) * 100).toFixed(1)}%` : '—'
                })()}
              </p>
            </div>
          )}
        </div>

        {/* Detalle del flujo activo */}
        <div className="lg:col-span-3">
          {activeFlow && <FlowPanel key={activeFlow.id} flow={activeFlow} batchStatus={batch.status} reload={load} />}
        </div>
      </div>
    </div>
  )
}

function FlowPanel({ flow, batchStatus, reload }: { flow: BatchFlow; batchStatus: string; reload: () => void }) {
  const [inputActual, setInputActual] = useState(flow.inputQtyActual?.toString() ?? flow.inputQtyPlanned.toString())
  const [outputActual, setOutputActual] = useState(flow.outputQtyActual?.toString() ?? '')
  const [downtime, setDowntime] = useState(flow.downtimeMin.toString())
  const [saving, setSaving] = useState(false)

  async function startFlow() {
    setSaving(true)
    try {
      await api.put(`/batches/flows/${flow.id}/start`, { inputQtyActual: parseFloat(inputActual) })
      reload()
    } finally { setSaving(false) }
  }

  async function saveProgress() {
    setSaving(true)
    try {
      await api.put(`/batches/flows/${flow.id}`, {
        inputQtyActual: inputActual ? parseFloat(inputActual) : undefined,
        outputQtyActual: outputActual ? parseFloat(outputActual) : undefined,
        downtimeMin: parseInt(downtime) || 0
      })
      reload()
    } finally { setSaving(false) }
  }

  async function completeFlow() {
    if (!outputActual || parseFloat(outputActual) <= 0) {
      alert('Registra la salida real antes de cerrar el flujo')
      return
    }
    setSaving(true)
    try {
      await api.put(`/batches/flows/${flow.id}/complete`, {
        outputQtyActual: parseFloat(outputActual),
        downtimeMin: parseInt(downtime) || 0
      })
      reload()
    } finally { setSaving(false) }
  }

  const yieldVal = inputActual && outputActual && parseFloat(inputActual) > 0
    ? (parseFloat(outputActual) / parseFloat(inputActual)) * 100
    : null

  const canStart = batchStatus === 'IN_PROGRESS' && flow.status === 'PENDING'
  const isRunning = flow.status === 'IN_PROGRESS'
  const isDone = flow.status === 'COMPLETED'

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-semibold text-lg">{flow.flow.name}</h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
              {flow.machine && <span className="bg-gray-100 px-2 py-0.5 rounded">{flow.machine.code}</span>}
              <span><Clock size={11} className="inline -mt-0.5"/> Planeado: {flow.plannedTimeMin} min</span>
            </div>
          </div>
          <StatusBadge status={flow.status}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-700 font-medium uppercase">Entrada</p>
            <p className="font-mono text-sm mt-1">{flow.inputProduct?.name}</p>
            <p className="text-xs text-gray-500 mt-1">Planeado: {flow.inputQtyPlanned} {flow.inputUnit}</p>
            <input
              className="input mt-2"
              type="number"
              step="0.01"
              value={inputActual}
              onChange={e => setInputActual(e.target.value)}
              disabled={isDone}
              placeholder="Real"
            />
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-700 font-medium uppercase">Salida</p>
            <p className="font-mono text-sm mt-1">{flow.outputProduct?.name}</p>
            <p className="text-xs text-gray-500 mt-1">Esperado: {flow.outputQtyExpected} {flow.outputUnit}</p>
            <input
              className="input mt-2"
              type="number"
              step="0.01"
              value={outputActual}
              onChange={e => setOutputActual(e.target.value)}
              disabled={isDone}
              placeholder="Real"
            />
          </div>
          <div className="bg-indigo-50 rounded-lg p-3">
            <p className="text-xs text-indigo-700 font-medium uppercase">Rendimiento</p>
            <p className="text-3xl font-bold text-indigo-700 mt-1">
              {yieldVal !== null ? `${yieldVal.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">salida real / entrada × 100</p>
          </div>
        </div>

        <div className="mt-3">
          <label className="label">Tiempo perdido / downtime (min)</label>
          <input
            className="input"
            type="number"
            value={downtime}
            onChange={e => setDowntime(e.target.value)}
            disabled={isDone}
          />
        </div>

        <div className="flex gap-2 mt-4">
          {canStart && (
            <button onClick={startFlow} disabled={saving} className="btn-primary"><Play size={14}/> Iniciar flujo</button>
          )}
          {isRunning && (
            <>
              <button onClick={saveProgress} disabled={saving} className="btn-secondary"><Save size={14}/> Guardar</button>
              <button onClick={completeFlow} disabled={saving} className="btn-primary bg-green-600 hover:bg-green-700"><CheckCircle2 size={14}/> Cerrar flujo</button>
            </>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3">Pasos</h3>
        <div className="space-y-2">
          {flow.steps.map((s, i) => (
            <StepItem key={s.id} step={s} index={i} disabled={!isRunning} reload={reload} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StepItem({ step, index, disabled, reload }: { step: BatchStep; index: number; disabled: boolean; reload: () => void }) {
  const [obs, setObs] = useState(step.observations || '')
  const [expanded, setExpanded] = useState(step.status === 'IN_PROGRESS')

  async function start() {
    await api.put(`/batches/steps/${step.id}/start`, {}); reload(); setExpanded(true)
  }
  async function complete() {
    const required = step.step.checklistItems.filter(c => c.required)
    const unchecked = required.filter(c => !step.checks.find(ch => ch.checklistItemId === c.id && ch.completed))
    if (unchecked.length > 0) {
      if (!confirm(`Hay ${unchecked.length} items requeridos sin marcar. ¿Completar de todos modos?`)) return
    }
    await api.put(`/batches/steps/${step.id}/complete`, { observations: obs }); reload()
  }
  async function toggleCheck(checkId: string, completed: boolean) {
    await api.put(`/batches/checks/${checkId}`, { completed }); reload()
  }

  const checkMap = new Map(step.checks.map(c => [c.checklistItemId, c]))
  const isDone = step.status === 'COMPLETED'
  const isActive = step.status === 'IN_PROGRESS'

  return (
    <div className={`border rounded-lg ${isActive ? 'border-indigo-400 bg-indigo-50' : isDone ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-3 flex items-center gap-3">
        <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
          {isDone ? '✓' : index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{step.step.name}</p>
          <p className="text-xs text-gray-500">{step.step.targetTimeMinutes} min objetivo · {step.step.checklistItems.length} checks</p>
        </div>
        <StatusBadge status={step.status}/>
      </button>
      {expanded && (
        <div className="border-t px-3 py-3 space-y-2">
          {step.step.description && <p className="text-xs text-gray-600">{step.step.description}</p>}
          {step.step.checklistItems.length > 0 && (
            <ul className="space-y-1">
              {step.step.checklistItems.map(ci => {
                const check = checkMap.get(ci.id)
                return (
                  <li key={ci.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={check?.completed || false}
                      onChange={e => check && toggleCheck(check.id, e.target.checked)}
                      disabled={!isActive}
                      className="w-4 h-4"
                    />
                    <span className={check?.completed ? 'line-through text-gray-400' : ''}>{ci.label}</span>
                    {ci.required && !check?.completed && <AlertCircle size={12} className="text-red-400"/>}
                  </li>
                )
              })}
            </ul>
          )}
          {isActive && (
            <>
              <textarea
                className="input text-sm"
                rows={2}
                placeholder="Observaciones (opcional)"
                value={obs}
                onChange={e => setObs(e.target.value)}
              />
              <button onClick={complete} className="btn-primary text-xs py-1.5"><CheckCircle2 size={14}/> Completar paso</button>
            </>
          )}
          {step.status === 'PENDING' && !disabled && (
            <button onClick={start} className="btn-secondary text-xs py-1.5"><Play size={14}/> Iniciar paso</button>
          )}
          {isDone && step.observations && (
            <div className="text-xs text-gray-600 bg-white border rounded p-2">
              <span className="font-medium">Obs:</span> {step.observations}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
