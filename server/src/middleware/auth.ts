import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'mes-industrial-secret-2024'

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string; name: string }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string; name: string }
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido' })
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Acceso de administrador requerido' })
    return
  }
  next()
}
