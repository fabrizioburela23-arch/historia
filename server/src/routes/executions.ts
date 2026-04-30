import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

router.get('/:id', authenticate, async (req, res: Response) => {
  const execution = await prisma.batchExecution.findUnique({
    where: { id: req.params.id },
    include: {
      batch: {
        include: {
          recipe: { select: { id: true, name: true } },
          machine: { select: { id: true, name: true, code: true } }
        }
      },
      user: { select: { id: true, name: true } },
      stepExecutions: {
        include: {
          recipeStep: {
            include: { checklistItems: { orderBy: { order: 'asc' } } }
          },
          checklistCompletions: {
            include: { checklistItem: true }
          }
        },
        orderBy: { recipeStep: { order: 'asc' } }
      }
    }
  })
  if (!execution) { res.status(404).json({ error: 'Ejecución no encontrada' }); return }
  res.json(execution)
})

// Start a step — enforces sequential unlock
router.put('/:id/steps/:stepId/start', authenticate, async (req: AuthRequest, res: Response) => {
  const { id: executionId, stepId } = req.params

  const execution = await prisma.batchExecution.findUnique({
    where: { id: executionId },
    include: {
      stepExecutions: {
        include: { recipeStep: { select: { order: true } } },
        orderBy: { recipeStep: { order: 'asc' } }
      }
    }
  })
  if (!execution) { res.status(404).json({ error: 'Ejecución no encontrada' }); return }

  const stepIndex = execution.stepExecutions.findIndex(s => s.id === stepId)
  if (stepIndex === -1) { res.status(404).json({ error: 'Paso no encontrado' }); return }

  if (stepIndex > 0) {
    const previousStep = execution.stepExecutions[stepIndex - 1]
    if (previousStep.status !== 'COMPLETED') {
      res.status(400).json({ error: 'Debes completar el paso anterior primero' }); return
    }
  }

  const currentStep = execution.stepExecutions[stepIndex]
  if (currentStep.status !== 'PENDING') {
    res.status(400).json({ error: 'El paso ya fue iniciado o completado' }); return
  }

  const updated = await prisma.stepExecution.update({
    where: { id: stepId },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
    include: {
      recipeStep: { include: { checklistItems: { orderBy: { order: 'asc' } } } },
      checklistCompletions: { include: { checklistItem: true } }
    }
  })
  res.json(updated)
})

// Complete a step
router.put('/:id/steps/:stepId/complete', authenticate, async (req: AuthRequest, res: Response) => {
  const { id: executionId, stepId } = req.params
  const { waste, observations, checklistCompletions } = req.body

  const stepExecution = await prisma.stepExecution.findFirst({
    where: { id: stepId, batchExecutionId: executionId },
    include: {
      recipeStep: { include: { checklistItems: true } }
    }
  })
  if (!stepExecution) { res.status(404).json({ error: 'Paso no encontrado' }); return }
  if (stepExecution.status !== 'IN_PROGRESS') {
    res.status(400).json({ error: 'El paso debe estar en progreso para completarlo' }); return
  }

  // Verify required checklist items are completed
  const requiredItems = stepExecution.recipeStep.checklistItems.filter(c => c.required)
  if (checklistCompletions && requiredItems.length > 0) {
    const completedIds = new Set(
      (checklistCompletions as { checklistItemId: string; completed: boolean }[])
        .filter(c => c.completed)
        .map(c => c.checklistItemId)
    )
    const missingRequired = requiredItems.filter(r => !completedIds.has(r.id))
    if (missingRequired.length > 0) {
      res.status(400).json({ error: `Ítems de checklist requeridos pendientes: ${missingRequired.map(r => r.label).join(', ')}` })
      return
    }
  }

  const completedAt = new Date()
  const actualTimeSeconds = stepExecution.startedAt
    ? Math.floor((completedAt.getTime() - stepExecution.startedAt.getTime()) / 1000)
    : null

  // Update checklist completions if provided
  if (checklistCompletions) {
    for (const cc of checklistCompletions as { checklistItemId: string; completed: boolean }[]) {
      await prisma.checklistCompletion.updateMany({
        where: { stepExecutionId: stepId, checklistItemId: cc.checklistItemId },
        data: { completed: cc.completed, completedAt: cc.completed ? completedAt : null }
      })
    }
  }

  const updated = await prisma.stepExecution.update({
    where: { id: stepId },
    data: {
      status: 'COMPLETED',
      completedAt,
      actualTimeSeconds,
      waste: waste !== undefined ? parseFloat(waste) : null,
      observations: observations || null
    },
    include: {
      recipeStep: { include: { checklistItems: true } },
      checklistCompletions: { include: { checklistItem: true } }
    }
  })

  // Check if all steps are completed — auto-finish execution
  const allSteps = await prisma.stepExecution.findMany({ where: { batchExecutionId: executionId } })
  const allDone = allSteps.every(s => s.status === 'COMPLETED' || s.id === stepId)
  if (allDone) {
    await prisma.batchExecution.update({
      where: { id: executionId },
      data: { status: 'COMPLETED', completedAt }
    })
    await prisma.batch.update({
      where: { id: (await prisma.batchExecution.findUnique({ where: { id: executionId }, select: { batchId: true } }))!.batchId },
      data: { status: 'COMPLETED' }
    })
  }

  res.json(updated)
})

// Pause an execution
router.put('/:id/pause', authenticate, async (req, res: Response) => {
  const execution = await prisma.batchExecution.findUnique({ where: { id: req.params.id } })
  if (!execution) { res.status(404).json({ error: 'Ejecución no encontrada' }); return }
  const updated = await prisma.batchExecution.update({
    where: { id: req.params.id },
    data: { status: 'PAUSED' }
  })
  await prisma.batch.update({ where: { id: execution.batchId }, data: { status: 'PAUSED' } })
  res.json(updated)
})

// Resume an execution
router.put('/:id/resume', authenticate, async (req, res: Response) => {
  const execution = await prisma.batchExecution.findUnique({ where: { id: req.params.id } })
  if (!execution) { res.status(404).json({ error: 'Ejecución no encontrada' }); return }
  const updated = await prisma.batchExecution.update({
    where: { id: req.params.id },
    data: { status: 'IN_PROGRESS' }
  })
  await prisma.batch.update({ where: { id: execution.batchId }, data: { status: 'IN_PROGRESS' } })
  res.json(updated)
})

export default router
