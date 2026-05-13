import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

router.get('/', authenticate, async (_req, res: Response) => {
  const materials = await prisma.rawMaterial.findMany({ orderBy: { name: 'asc' } })
  res.json(materials)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, code, unit, unitCost, stockQty, description } = req.body
  if (!name || !code || !unit) {
    res.status(400).json({ error: 'Nombre, código y unidad son requeridos' }); return
  }
  try {
    const mat = await prisma.rawMaterial.create({
      data: { name, code, unit, unitCost: unitCost || 0, stockQty: stockQty || 0, description }
    })
    res.status(201).json(mat)
  } catch {
    res.status(400).json({ error: 'El código ya existe' })
  }
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, code, unit, unitCost, stockQty, description } = req.body
  try {
    const mat = await prisma.rawMaterial.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(unit && { unit }),
        ...(unitCost !== undefined && { unitCost: parseFloat(unitCost) }),
        ...(stockQty !== undefined && { stockQty: parseFloat(stockQty) }),
        ...(description !== undefined && { description })
      }
    })
    res.json(mat)
  } catch {
    res.status(404).json({ error: 'Materia prima no encontrada' })
  }
})

// Adjust stock (add or subtract)
router.patch('/:id/stock', authenticate, async (req: AuthRequest, res: Response) => {
  const { delta } = req.body
  if (delta === undefined) { res.status(400).json({ error: 'Delta requerido' }); return }
  try {
    const current = await prisma.rawMaterial.findUnique({ where: { id: req.params.id } })
    if (!current) { res.status(404).json({ error: 'No encontrado' }); return }
    const mat = await prisma.rawMaterial.update({
      where: { id: req.params.id },
      data: { stockQty: Math.max(0, current.stockQty + parseFloat(delta)) }
    })
    res.json(mat)
  } catch {
    res.status(404).json({ error: 'Materia prima no encontrada' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.rawMaterial.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(400).json({ error: 'No se puede eliminar: en uso por recetas o consumos' })
  }
})

export default router
