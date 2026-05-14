import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  passwordPlain: true,
  createdAt: true,
  updatedAt: true
}

router.get('/', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: 'desc' }
  })
  res.json(users)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, email, password, role } = req.body
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' }); return
  }
  if (role && !['ADMIN', 'OPERATOR'].includes(role)) {
    res.status(400).json({ error: 'Rol inválido' }); return
  }
  try {
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        passwordPlain: password,
        role: role || 'OPERATOR'
      },
      select: userSelect
    })
    res.status(201).json(user)
  } catch {
    res.status(409).json({ error: 'El email ya está registrado' })
  }
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, email, password, role } = req.body
  if (role && !['ADMIN', 'OPERATOR'].includes(role)) {
    res.status(400).json({ error: 'Rol inválido' }); return
  }
  try {
    const data: any = {
      ...(name && { name }),
      ...(email && { email }),
      ...(role && { role })
    }
    if (password) {
      data.password = await bcrypt.hash(password, 10)
      data.passwordPlain = password
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: userSelect
    })
    res.json(user)
  } catch {
    res.status(404).json({ error: 'Usuario no encontrado o email duplicado' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  if (req.user?.id === req.params.id) {
    res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' }); return
  }
  try {
    await prisma.user.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(409).json({ error: 'No se puede eliminar: usuario con ejecuciones asociadas' })
  }
})

export default router
