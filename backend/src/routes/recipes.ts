import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

router.get('/', authenticate, async (_req, res: Response) => {
  const recipes = await prisma.recipe.findMany({
    include: {
      steps: {
        include: { checklistItems: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  res.json(recipes)
})

router.get('/:id', authenticate, async (req, res: Response) => {
  const recipe = await prisma.recipe.findUnique({
    where: { id: req.params.id },
    include: {
      steps: {
        include: { checklistItems: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' }
      }
    }
  })
  if (!recipe) { res.status(404).json({ error: 'Receta no encontrada' }); return }
  res.json(recipe)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, targetTimeMinutes, steps } = req.body
  if (!name) { res.status(400).json({ error: 'Nombre requerido' }); return }
  const recipe = await prisma.recipe.create({
    data: {
      name,
      description,
      targetTimeMinutes: targetTimeMinutes || 0,
      steps: steps ? {
        create: steps.map((s: { name: string; description?: string; targetTimeMinutes?: number; order: number; checklistItems?: { label: string; required?: boolean; order?: number }[] }) => ({
          name: s.name,
          description: s.description,
          targetTimeMinutes: s.targetTimeMinutes || 0,
          order: s.order,
          checklistItems: s.checklistItems ? {
            create: s.checklistItems.map((c, ci) => ({
              label: c.label,
              required: c.required !== false,
              order: c.order || ci
            }))
          } : undefined
        }))
      } : undefined
    },
    include: {
      steps: { include: { checklistItems: true }, orderBy: { order: 'asc' } }
    }
  })
  res.status(201).json(recipe)
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, targetTimeMinutes } = req.body
  try {
    const recipe = await prisma.recipe.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(targetTimeMinutes !== undefined && { targetTimeMinutes })
      },
      include: { steps: { include: { checklistItems: true }, orderBy: { order: 'asc' } } }
    })
    res.json(recipe)
  } catch {
    res.status(404).json({ error: 'Receta no encontrada' })
  }
})

router.post('/:id/steps', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, targetTimeMinutes, order, checklistItems } = req.body
  if (!name) { res.status(400).json({ error: 'Nombre del paso requerido' }); return }
  const stepsCount = await prisma.recipeStep.count({ where: { recipeId: req.params.id } })
  const step = await prisma.recipeStep.create({
    data: {
      recipeId: req.params.id,
      name,
      description,
      targetTimeMinutes: targetTimeMinutes || 0,
      order: order !== undefined ? order : stepsCount + 1,
      checklistItems: checklistItems ? {
        create: checklistItems.map((c: { label: string; required?: boolean }, i: number) => ({
          label: c.label,
          required: c.required !== false,
          order: i
        }))
      } : undefined
    },
    include: { checklistItems: true }
  })
  res.status(201).json(step)
})

router.delete('/:id/steps/:stepId', authenticate, requireAdmin, async (_req, res: Response) => {
  try {
    await prisma.recipeStep.delete({ where: { id: _req.params.stepId } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Paso no encontrado' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.recipe.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Receta no encontrada' })
  }
})

export default router
