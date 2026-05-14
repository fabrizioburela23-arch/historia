import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const recipeInclude = {
  flows: {
    orderBy: { order: 'asc' as const },
    include: {
      flow: {
        include: {
          inputProduct: true,
          outputProduct: true,
          machine: { select: { id: true, name: true, code: true } }
        }
      }
    }
  },
  materials: {
    include: { product: true }
  }
}

router.get('/', authenticate, async (_req, res: Response) => {
  const recipes = await prisma.recipe.findMany({
    include: recipeInclude,
    orderBy: { createdAt: 'desc' }
  })
  res.json(recipes)
})

router.get('/:id', authenticate, async (req, res: Response) => {
  const recipe = await prisma.recipe.findUnique({
    where: { id: req.params.id },
    include: recipeInclude
  })
  if (!recipe) { res.status(404).json({ error: 'Receta no encontrada' }); return }
  res.json(recipe)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, version, flows, materials } = req.body
  if (!name) { res.status(400).json({ error: 'Nombre requerido' }); return }

  const recipe = await prisma.recipe.create({
    data: {
      name,
      description,
      version: version || '1.0',
      flows: Array.isArray(flows) ? {
        create: flows.map((f: any, idx: number) => ({
          flowId: f.flowId,
          order: f.order ?? idx
        }))
      } : undefined,
      materials: Array.isArray(materials) ? {
        create: materials.map((m: any) => ({
          productId: m.productId,
          quantity: parseFloat(m.quantity),
          unit: m.unit
        }))
      } : undefined
    },
    include: recipeInclude
  })
  res.status(201).json(recipe)
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, version, flows, materials } = req.body
  try {
    await prisma.recipe.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(version && { version })
      }
    })

    if (Array.isArray(flows)) {
      await prisma.recipeFlow.deleteMany({ where: { recipeId: req.params.id } })
      for (let i = 0; i < flows.length; i++) {
        await prisma.recipeFlow.create({
          data: { recipeId: req.params.id, flowId: flows[i].flowId, order: flows[i].order ?? i }
        })
      }
    }

    if (Array.isArray(materials)) {
      await prisma.recipeMaterial.deleteMany({ where: { recipeId: req.params.id } })
      for (const m of materials) {
        await prisma.recipeMaterial.create({
          data: {
            recipeId: req.params.id,
            productId: m.productId,
            quantity: parseFloat(m.quantity),
            unit: m.unit
          }
        })
      }
    }

    const updated = await prisma.recipe.findUnique({
      where: { id: req.params.id },
      include: recipeInclude
    })
    res.json(updated)
  } catch (e) {
    console.error(e)
    res.status(404).json({ error: 'Receta no encontrada' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.recipe.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(409).json({ error: 'No se puede eliminar: receta en uso' })
  }
})

export default router
