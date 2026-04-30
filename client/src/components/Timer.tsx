import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface TimerProps {
  startedAt?: string
  targetMinutes: number
  running: boolean
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function Timer({ startedAt, targetMinutes, running }: TimerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!running || !startedAt) return
    const update = () => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [running, startedAt])

  const targetSeconds = targetMinutes * 60
  const pct = targetSeconds > 0 ? (elapsed / targetSeconds) * 100 : 0

  const color =
    pct < 80 ? 'text-green-600' :
    pct < 100 ? 'text-yellow-500' :
    'text-red-600'

  const barColor =
    pct < 80 ? 'bg-green-500' :
    pct < 100 ? 'bg-yellow-400' :
    'bg-red-500'

  return (
    <div className="card p-5 text-center">
      <div className="flex items-center justify-center gap-2 text-gray-500 mb-2">
        <Clock size={16} />
        <span className="text-xs font-medium uppercase tracking-wider">Tiempo Transcurrido</span>
      </div>
      <div className={`text-5xl font-mono font-bold tabular-nums ${running ? color : 'text-gray-400'}`}>
        {formatTime(elapsed)}
      </div>
      <div className="mt-3 text-xs text-gray-400">
        Objetivo: <span className="font-semibold text-gray-600">{formatTime(targetSeconds)}</span>
      </div>
      {targetSeconds > 0 && (
        <div className="mt-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0%</span>
            <span className={pct > 100 ? 'text-red-500 font-bold' : ''}>
              {pct.toFixed(0)}%
              {pct > 100 && ' ⚠ Excedido'}
            </span>
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  )
}
