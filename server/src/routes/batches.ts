import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { status } = req.query
  const batches = await prisma.batch.findMany({
    where: status ? { status: status as string } : undefined,
    include: {
      recipe: { select: { id: true, name: true, targetTimeMinutes: true } },
      machine: { select: { id: true, name: true, code: true, status: true } },
      executions: { select: { id: true, status: true, startedAt: true, completedAt: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
  res.json(batches)
})

router.get('/:id', authenticate, async (req, res: Response) => {
  const batch = await prisma.batch.findUnique({
    where: { id: req.params.id },
    include: {
      recipe: {
        include: {
          steps: {
            include: {
              checklistItems: { orderBy: { order: 'asc' } },
              materials: { include: { material: true } }
            },
            orderBy: { order: 'asc' }
          }
        }
      },
      machine: true,
      executions: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { startedAt: 'desc' }
      }
    }
  })
  if (!batch) { res.status(404).json({ error: 'Lote no encontrado' }); return }
  res.json(batch)
})

// Operators and admins can create batches
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { name, recipeId, machineId, notes, priority, plannedQty, unit, supervisorName, plannedStartAt, plannedEndAt } = req.body
  if (!name || !recipeId || !machineId) {
    res.status(400).json({ error: 'Nombre, flujo y máquina son requeridos' }); return
  }
  const batch = await prisma.batch.create({
    data: {
      name,
      recipeId,
      machineId,
      notes,
      priority: priority || 'NORMAL',
      plannedQty: plannedQty ? parseFloat(plannedQty) : undefined,
      unit,
      supervisorName,
      plannedStartAt: plannedStartAt ? new Date(plannedStartAt) : undefined,
      plannedEndAt: plannedEndAt ? new Date(plannedEndAt) : undefined,
      createdBy: req.user?.role === 'OPERATOR' ? 'OPERATOR' : 'ADMIN',
      createdById: req.user?.id
    },
    include: {
      recipe: { select: { id: true, name: true } },
      machine: { select: { id: true, name: true, code: true } }
    }
  })
  res.status(201).json(batch)
})

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const isAdmin = req.user?.role === 'ADMIN'
  const { name, status, notes, priority, plannedQty, actualQty, unit, supervisorName, plannedStartAt, plannedEndAt } = req.body
  try {
    const data: Record<string, unknown> = {
      ...(name && { name }),
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(priority && { priority }),
      ...(plannedQty !== undefined && { plannedQty: parseFloat(plannedQty) }),
      ...(unit && { unit }),
      ...(supervisorName !== undefined && { supervisorName }),
      ...(plannedStartAt !== undefined && { plannedStartAt: plannedStartAt ? new Date(plannedStartAt) : null }),
      ...(plannedEndAt !== undefined && { plannedEndAt: plannedEndAt ? new Date(plannedEndAt) : null })
    }
    if (actualQty !== undefined && isAdmin) {
      data.actualQty = parseFloat(actualQty)
    }
    const batch = await prisma.batch.update({
      where: { id: req.params.id },
      data,
      include: {
        recipe: { select: { id: true, name: true } },
        machine: { select: { id: true, name: true, code: true } }
      }
    })
    res.json(batch)
  } catch {
    res.status(404).json({ error: 'Lote no encontrado' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.batch.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Lote no encontrado' })
  }
})

// Start a batch execution (operator or admin)
router.post('/:id/start', authenticate, async (req: AuthRequest, res: Response) => {
  const batch = await prisma.batch.findUnique({
    where: { id: req.params.id },
    include: {
      recipe: { include: { steps: { include: { checklistItems: true }, orderBy: { order: 'asc' } } } }
    }
  })
  if (!batch) { res.status(404).json({ error: 'Lote no encontrado' }); return }
  if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
    res.status(400).json({ error: 'Este lote ya fue completado o cancelado' }); return
  }

  const execution = await prisma.batchExecution.create({
    data: {
      batchId: batch.id,
      userId: req.user!.id,
      status: 'IN_PROGRESS',
      stepExecutions: {
        create: batch.recipe.steps.map(step => ({
          recipeStepId: step.id,
          status: 'PENDING',
          checklistCompletions: {
            create: step.checklistItems.map(item => ({
              checklistItemId: item.id,
              completed: false
            }))
          }
        }))
      }
    },
    include: {
      stepExecutions: {
        include: {
          recipeStep: { include: { checklistItems: true } },
          checklistCompletions: true
        },
        orderBy: { recipeStep: { order: 'asc' } }
      }
    }
  })

  await prisma.batch.update({ where: { id: batch.id }, data: { status: 'IN_PROGRESS' } })

  res.status(201).json(execution)
})

export default router
