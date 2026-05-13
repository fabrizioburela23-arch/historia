import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

router.get('/', authenticate, async (_req, res: Response) => {
  const materials = await prisma.material.findMany({
    orderBy: { name: 'asc' }
  })
  res.json(materials)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, code, unit, description } = req.body
  if (!name || !code || !unit) {
    res.status(400).json({ error: 'Nombre, código y unidad son requeridos' }); return
  }
  try {
    const material = await prisma.material.create({
      data: { name, code, unit, description }
    })
    res.status(201).json(material)
  } catch {
    res.status(400).json({ error: 'El código ya existe' })
  }
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, code, unit, description } = req.body
  try {
    const material = await prisma.material.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(unit && { unit }),
        ...(description !== undefined && { description })
      }
    })
    res.json(material)
  } catch {
    res.status(404).json({ error: 'Material no encontrado' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.material.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Material no encontrado' })
  }
})

export default router
