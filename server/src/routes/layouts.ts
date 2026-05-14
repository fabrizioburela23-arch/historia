import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'
import { v2 as cloudinary } from 'cloudinary'

const router = Router()
const prisma = new PrismaClient()

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const storage = multer.memoryStorage()
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
  try {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'mes-layouts', resource_type: 'image' },
        (error, result) => {
          if (error) reject(error)
          else resolve(result as { secure_url: string })
        }
      ).end(req.file!.buffer)
    })
    const layout = await prisma.plantLayout.update({
      where: { id: req.params.id },
      data: { imageUrl: result.secure_url }
    })
    res.json(layout)
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    res.status(500).json({ error: 'Error al subir imagen' })
  }
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
