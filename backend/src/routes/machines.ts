import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

router.get('/', authenticate, async (_req, res: Response) => {
  const machines = await prisma.machine.findMany({
    include: { plantLayout: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  })
  res.json(machines)
})

router.get('/:id', authenticate, async (req, res: Response) => {
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: { plantLayout: true }
  })
  if (!machine) { res.status(404).json({ error: 'Máquina no encontrada' }); return }
  res.json(machine)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, code, plantLayoutId } = req.body
  if (!name || !code) { res.status(400).json({ error: 'Nombre y código requeridos' }); return }
  try {
    const machine = await prisma.machine.create({
      data: { name, description, code, plantLayoutId: plantLayoutId || null }
    })
    res.status(201).json(machine)
  } catch {
    res.status(409).json({ error: 'El código de máquina ya existe' })
  }
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, code, locationX, locationY, plantLayoutId } = req.body
  try {
    const machine = await prisma.machine.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(code && { code }),
        ...(locationX !== undefined && { locationX }),
        ...(locationY !== undefined && { locationY }),
        ...(plantLayoutId !== undefined && { plantLayoutId: plantLayoutId || null })
      }
    })
    res.json(machine)
  } catch {
    res.status(404).json({ error: 'Máquina no encontrada' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.machine.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Máquina no encontrada' })
  }
})

export default router
