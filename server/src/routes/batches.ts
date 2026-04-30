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
      machine: { select: { id: true, name: true, code: true } },
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
          steps: { include: { checklistItems: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } }
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

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, recipeId, machineId, notes } = req.body
  if (!name || !recipeId || !machineId) {
    res.status(400).json({ error: 'Nombre, receta y máquina requeridos' }); return
  }
  const batch = await prisma.batch.create({
    data: { name, recipeId, machineId, notes },
    include: {
      recipe: { select: { id: true, name: true } },
      machine: { select: { id: true, name: true, code: true } }
    }
  })
  res.status(201).json(batch)
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, status, notes } = req.body
  try {
    const batch = await prisma.batch.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(status && { status }),
        ...(notes !== undefined && { notes })
      },
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
