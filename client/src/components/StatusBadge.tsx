import { BatchStatus, StepStatus } from '../types'

const statusConfig: Record<string, { label: string; className: string }> = {
  PENDING:     { label: 'Pendiente',   className: 'bg-gray-100 text-gray-700' },
  IN_PROGRESS: { label: 'En Progreso', className: 'bg-blue-100 text-blue-700' },
  PAUSED:      { label: 'Pausado',     className: 'bg-yellow-100 text-yellow-700' },
  COMPLETED:   { label: 'Completado',  className: 'bg-green-100 text-green-700' },
  CANCELLED:   { label: 'Cancelado',   className: 'bg-red-100 text-red-700' },
  SKIPPED:     { label: 'Omitido',     className: 'bg-orange-100 text-orange-700' }
}

export default function StatusBadge({ status }: { status: BatchStatus | StepStatus | string }) {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
