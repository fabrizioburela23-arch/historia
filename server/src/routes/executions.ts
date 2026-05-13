import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const PROCESS_INCLUDE = {
  routingStep: {
    include: {
      operation: { include: { checklistItems: { orderBy: { order: 'asc' } } } },
      preferredMachine: { select: { id: true, name: true, code: true } }
    }
  },
  machine: { select: { id: true, name: true, code: true } },
  operator: { select: { id: true, name: true } },
  checklistCompletions: { include: { checklistItem: true } },
  consumptions: { include: { rawMaterial: true } }
} as const

router.get('/:id', authenticate, async (req, res: Response) => {
  const execution = await prisma.batchExecution.findUnique({
    where: { id: req.params.id },
    include: {
      batch: {
        include: {
          recipe: {
            select: {
              id: true, name: true,
              bom: { include: { rawMaterial: true } }
            }
          }
        }
      },
      user: { select: { id: true, name: true } },
      processExecutions: {
        include: PROCESS_INCLUDE,
        orderBy: { routingStep: { order: 'asc' } }
      }
    }
  })
  if (!execution) { res.status(404).json({ error: 'Ejecución no encontrada' }); return }
  res.json(execution)
})

// Iniciar un proceso — verifica secuencia
router.put('/:id/processes/:processId/start', authenticate, async (req: AuthRequest, res: Response) => {
  const { id: executionId, processId } = req.params

  const execution = await prisma.batchExecution.findUnique({
    where: { id: executionId },
    include: {
      processExecutions: {
        include: { routingStep: { select: { order: true } } },
        orderBy: { routingStep: { order: 'asc' } }
      }
    }
  })
  if (!execution) { res.status(404).json({ error: 'Ejecución no encontrada' }); return }

  const idx = execution.processExecutions.findIndex(p => p.id === processId)
  if (idx === -1) { res.status(404).json({ error: 'Proceso no encontrado' }); return }

  if (idx > 0 && execution.processExecutions[idx - 1].status !== 'COMPLETED') {
    res.status(400).json({ error: 'Debes completar el proceso anterior primero' }); return
  }

  if (execution.processExecutions[idx].status !== 'PENDING') {
    res.status(400).json({ error: 'El proceso ya fue iniciado o completado' }); return
  }

  const { machineId } = req.body

  const updated = await prisma.processExecution.update({
    where: { id: processId },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      operatorId: req.user!.id,
      ...(machineId && { machineId })
    },
    include: PROCESS_INCLUDE
  })
  res.json(updated)
})

// Completar un proceso
router.put('/:id/processes/:processId/complete', authenticate, async (req: AuthRequest, res: Response) => {
  const { id: executionId, processId } = req.params
  const { machineId, manHours, machineHours, waste, wasteUnit, observations, checklistCompletions, materialConsumptions } = req.body

  const process = await prisma.processExecution.findFirst({
    where: { id: processId, batchExecutionId: executionId },
    include: { routingStep: { include: { operation: { include: { checklistItems: true } } } } }
  })
  if (!process) { res.status(404).json({ error: 'Proceso no encontrado' }); return }
  if (process.status !== 'IN_PROGRESS') {
    res.status(400).json({ error: 'El proceso debe estar en progreso para completarlo' }); return
  }

  // Verificar ítems requeridos del checklist
  const required = process.routingStep.operation.checklistItems.filter(c => c.required)
  if (checklistCompletions && required.length > 0) {
    const doneIds = new Set(
      (checklistCompletions as { checklistItemId: string; completed: boolean }[])
        .filter(c => c.completed).map(c => c.checklistItemId)
    )
    const missing = required.filter(r => !doneIds.has(r.id))
    if (missing.length > 0) {
      res.status(400).json({ error: `Verificaciones requeridas pendientes: ${missing.map(r => r.label).join(', ')}` })
      return
    }
  }

  const completedAt = new Date()

  // Actualizar checklist
  if (checklistCompletions) {
    for (const cc of checklistCompletions as { checklistItemId: string; completed: boolean }[]) {
      await prisma.checklistCompletion.updateMany({
        where: { processExecutionId: processId, checklistItemId: cc.checklistItemId },
        data: { completed: cc.completed, completedAt: cc.completed ? completedAt : null }
      })
    }
  }

  // Registrar consumos de materia prima
  if (materialConsumptions) {
    for (const mc of materialConsumptions as { rawMaterialId: string; plannedQty?: number; actualQty: number; unit?: string; waste?: number; notes?: string }[]) {
      if (!mc.rawMaterialId || mc.actualQty === undefined) continue
      await prisma.materialConsumption.create({
        data: {
          processExecutionId: processId,
          rawMaterialId: mc.rawMaterialId,
          plannedQty: mc.plannedQty,
          actualQty: mc.actualQty,
          unit: mc.unit,
          waste: mc.waste,
          notes: mc.notes
        }
      })
      // Descontar del stock
      await prisma.rawMaterial.update({
        where: { id: mc.rawMaterialId },
        data: { stockQty: { decrement: mc.actualQty } }
      }).catch(() => {}) // non-critical
    }
  }

  const updated = await prisma.processExecution.update({
    where: { id: processId },
    data: {
      status: 'COMPLETED',
      completedAt,
      ...(machineId && { machineId }),
      manHours: manHours !== undefined ? parseFloat(manHours) : null,
      machineHours: machineHours !== undefined ? parseFloat(machineHours) : null,
      waste: waste !== undefined ? parseFloat(waste) : null,
      wasteUnit: wasteUnit || null,
      observations: observations || null
    },
    include: PROCESS_INCLUDE
  })

  // Auto-finalizar ejecución si todos los procesos están completos
  const allProcesses = await prisma.processExecution.findMany({ where: { batchExecutionId: executionId } })
  const allDone = allProcesses.every(p => p.status === 'COMPLETED' || p.id === processId)
  if (allDone) {
    await prisma.batchExecution.update({ where: { id: executionId }, data: { status: 'COMPLETED', completedAt } })
    const exec = await prisma.batchExecution.findUnique({ where: { id: executionId }, select: { batchId: true } })
    if (exec) await prisma.batch.update({ where: { id: exec.batchId }, data: { status: 'COMPLETED' } })
  }

  res.json(updated)
})

router.put('/:id/pause', authenticate, async (req, res: Response) => {
  const exec = await prisma.batchExecution.findUnique({ where: { id: req.params.id } })
  if (!exec) { res.status(404).json({ error: 'Ejecución no encontrada' }); return }
  await prisma.batchExecution.update({ where: { id: req.params.id }, data: { status: 'PAUSED' } })
  await prisma.batch.update({ where: { id: exec.batchId }, data: { status: 'PAUSED' } })
  res.json({ success: true })
})

router.put('/:id/resume', authenticate, async (req, res: Response) => {
  const exec = await prisma.batchExecution.findUnique({ where: { id: req.params.id } })
  if (!exec) { res.status(404).json({ error: 'Ejecución no encontrada' }); return }
  await prisma.batchExecution.update({ where: { id: req.params.id }, data: { status: 'IN_PROGRESS' } })
  await prisma.batch.update({ where: { id: exec.batchId }, data: { status: 'IN_PROGRESS' } })
  res.json({ success: true })
})

export default router
