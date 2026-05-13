import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

router.get('/', authenticate, async (_req, res: Response) => {
  const routings = await prisma.routing.findMany({
    include: {
      steps: {
        include: {
          operation: { include: { checklistItems: { orderBy: { order: 'asc' } } } },
          preferredMachine: { select: { id: true, name: true, code: true } }
        },
        orderBy: { order: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  res.json(routings)
})

router.get('/:id', authenticate, async (req, res: Response) => {
  const routing = await prisma.routing.findUnique({
    where: { id: req.params.id },
    include: {
      steps: {
        include: {
          operation: { include: { checklistItems: { orderBy: { order: 'asc' } } } },
          preferredMachine: { select: { id: true, name: true, code: true } }
        },
        orderBy: { order: 'asc' }
      }
    }
  })
  if (!routing) { res.status(404).json({ error: 'Flujo no encontrado' }); return }
  res.json(routing)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, version, description } = req.body
  if (!name) { res.status(400).json({ error: 'Nombre requerido' }); return }
  const routing = await prisma.routing.create({
    data: { name, version: version || '1.0', description },
    include: { steps: true }
  })
  res.status(201).json(routing)
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, version, description } = req.body
  try {
    const routing = await prisma.routing.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(version && { version }),
        ...(description !== undefined && { description })
      },
      include: {
        steps: {
          include: { operation: true, preferredMachine: { select: { id: true, name: true, code: true } } },
          orderBy: { order: 'asc' }
        }
      }
    })
    res.json(routing)
  } catch {
    res.status(404).json({ error: 'Flujo no encontrado' })
  }
})

router.post('/:id/steps', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { operationId, targetDurationMin, preferredMachineId, notes } = req.body
  if (!operationId) { res.status(400).json({ error: 'Operación requerida' }); return }
  const count = await prisma.routingStep.count({ where: { routingId: req.params.id } })
  const step = await prisma.routingStep.create({
    data: {
      routingId: req.params.id,
      operationId,
      order: count + 1,
      targetDurationMin: targetDurationMin || 0,
      preferredMachineId: preferredMachineId || null,
      notes
    },
    include: {
      operation: { include: { checklistItems: { orderBy: { order: 'asc' } } } },
      preferredMachine: { select: { id: true, name: true, code: true } }
    }
  })
  res.status(201).json(step)
})

router.delete('/:id/steps/:stepId', authenticate, requireAdmin, async (_req, res: Response) => {
  try {
    await prisma.routingStep.delete({ where: { id: _req.params.stepId } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Paso no encontrado' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.routing.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(400).json({ error: 'No se puede eliminar: en uso por recetas' })
  }
})

export default router
