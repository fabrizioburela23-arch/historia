import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const VALID_TYPES = ['RAW', 'INTERMEDIATE', 'FINAL']

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { type } = req.query
  const where = type && VALID_TYPES.includes(type as string) ? { type: type as string } : {}
  const products = await prisma.product.findMany({ where, orderBy: { name: 'asc' } })
  res.json(products)
})

router.get('/:id', authenticate, async (req, res: Response) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } })
  if (!product) { res.status(404).json({ error: 'Producto no encontrado' }); return }
  res.json(product)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, code, type, unit, description } = req.body
  if (!name || !code || !unit) {
    res.status(400).json({ error: 'Nombre, código y unidad son requeridos' }); return
  }
  if (type && !VALID_TYPES.includes(type)) {
    res.status(400).json({ error: 'Tipo inválido' }); return
  }
  try {
    const product = await prisma.product.create({
      data: { name, code, type: type || 'RAW', unit, description }
    })
    res.status(201).json(product)
  } catch {
    res.status(409).json({ error: 'El código ya existe' })
  }
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, code, type, unit, description } = req.body
  if (type && !VALID_TYPES.includes(type)) {
    res.status(400).json({ error: 'Tipo inválido' }); return
  }
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(type && { type }),
        ...(unit && { unit }),
        ...(description !== undefined && { description })
      }
    })
    res.json(product)
  } catch {
    res.status(404).json({ error: 'Producto no encontrado o código duplicado' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(409).json({ error: 'No se puede eliminar: producto en uso' })
  }
})

export default router
