import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

router.get('/', authenticate, async (_req, res: Response) => {
  const layouts = await prisma.plantLayout.findMany({
    include: { machines: { select: { id: true, name: true, code: true, status: true, locationX: true, locationY: true } } },
    orderBy: { createdAt: 'desc' }
  })
  res.json(layouts)
})

router.get('/:id', authenticate, async (req, res: Response) => {
  const layout = await prisma.plantLayout.findUnique({
    where: { id: req.params.id },
    include: { machines: true }
  })
  if (!layout) { res.status(404).json({ error: 'Layout no encontrado' }); return }
  res.json(layout)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name } = req.body
  if (!name) { res.status(400).json({ error: 'Nombre requerido' }); return }
  const layout = await prisma.plantLayout.create({ data: { name } })
  res.status(201).json(layout)
})

// Guardar imagen como Base64 en la BD (reemplaza Multer/disco)
router.put('/:id/image', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { imageBase64 } = req.body
  if (!imageBase64) { res.status(400).json({ error: 'Imagen en Base64 requerida' }); return }
  if (!imageBase64.startsWith('data:image/')) {
    res.status(400).json({ error: 'Formato Base64 inválido (debe comenzar con data:image/)' }); return
  }
  const layout = await prisma.plantLayout.update({
    where: { id: req.params.id },
    data: { imageBase64 }
  })
  res.json({ id: layout.id, name: layout.name, hasImage: !!layout.imageBase64 })
})

router.put('/:id/machine-pin', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { machineId, locationX, locationY } = req.body
  if (!machineId) { res.status(400).json({ error: 'ID de máquina requerido' }); return }
  const machine = await prisma.machine.update({
    where: { id: machineId },
    data: { locationX, locationY, plantLayoutId: req.params.id }
  })
  res.json(machine)
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name } = req.body
  try {
    const layout = await prisma.plantLayout.update({
      where: { id: req.params.id },
      data: { ...(name && { name }) }
    })
    res.json(layout)
  } catch {
    res.status(404).json({ error: 'Layout no encontrado' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.plantLayout.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Layout no encontrado' })
  }
})

export default router
