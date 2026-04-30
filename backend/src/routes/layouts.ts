import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    cb(null, `layout-${Date.now()}${path.extname(file.originalname)}`)
  }
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

router.get('/', authenticate, async (_req, res: Response) => {
  const layouts = await prisma.plantLayout.findMany({
    include: { machines: { select: { id: true, name: true, code: true, locationX: true, locationY: true } } },
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

router.post('/:id/upload', authenticate, requireAdmin, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'Archivo requerido' }); return }
  const imageUrl = `/uploads/${req.file.filename}`
  const layout = await prisma.plantLayout.update({
    where: { id: req.params.id },
    data: { imageUrl }
  })
  res.json(layout)
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

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.plantLayout.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Layout no encontrado' })
  }
})

export default router
