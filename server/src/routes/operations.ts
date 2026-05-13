import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

router.get('/', authenticate, async (_req, res: Response) => {
  const ops = await prisma.operation.findMany({
    include: { checklistItems: { orderBy: { order: 'asc' } } },
    orderBy: { name: 'asc' }
  })
  res.json(ops)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, code, description, defaultDurationMin, checklistItems } = req.body
  if (!name || !code) { res.status(400).json({ error: 'Nombre y código requeridos' }); return }
  try {
    const op = await prisma.operation.create({
      data: {
        name, code, description,
        defaultDurationMin: defaultDurationMin || 0,
        checklistItems: checklistItems ? {
          create: checklistItems.map((c: { label: string; required?: boolean }, i: number) => ({
            label: c.label, required: c.required !== false, order: i
          }))
        } : undefined
      },
      include: { checklistItems: { orderBy: { order: 'asc' } } }
    })
    res.status(201).json(op)
  } catch {
    res.status(400).json({ error: 'El código de operación ya existe' })
  }
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, code, description, defaultDurationMin } = req.body
  try {
    const op = await prisma.operation.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(description !== undefined && { description }),
        ...(defaultDurationMin !== undefined && { defaultDurationMin: parseInt(defaultDurationMin) })
      },
      include: { checklistItems: { orderBy: { order: 'asc' } } }
    })
    res.json(op)
  } catch {
    res.status(404).json({ error: 'Operación no encontrada' })
  }
})

router.post('/:id/checklist', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { label, required } = req.body
  if (!label) { res.status(400).json({ error: 'Etiqueta requerida' }); return }
  const count = await prisma.checklistItem.count({ where: { operationId: req.params.id } })
  const item = await prisma.checklistItem.create({
    data: { operationId: req.params.id, label, required: required !== false, order: count }
  })
  res.status(201).json(item)
})

router.delete('/:id/checklist/:itemId', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.checklistItem.delete({ where: { id: req.params.itemId } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Ítem no encontrado' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.operation.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(400).json({ error: 'No se puede eliminar: en uso en flujos de producción' })
  }
})

export default router
