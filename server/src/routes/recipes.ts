import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const INCLUDE_FULL = {
  routing: {
    include: {
      steps: {
        include: { operation: { include: { checklistItems: { orderBy: { order: 'asc' } } } }, preferredMachine: { select: { id: true, name: true, code: true } } },
        orderBy: { order: 'asc' }
      }
    }
  },
  bom: {
    include: { rawMaterial: true },
    orderBy: { rawMaterial: { name: 'asc' } }
  }
} as const

router.get('/', authenticate, async (_req, res: Response) => {
  const recipes = await prisma.recipe.findMany({
    include: INCLUDE_FULL,
    orderBy: { createdAt: 'desc' }
  })
  res.json(recipes)
})

router.get('/:id', authenticate, async (req, res: Response) => {
  const recipe = await prisma.recipe.findUnique({
    where: { id: req.params.id },
    include: INCLUDE_FULL
  })
  if (!recipe) { res.status(404).json({ error: 'Receta no encontrada' }); return }
  res.json(recipe)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, version, description, routingId, yieldQty, yieldUnit, salePrice, taxRate } = req.body
  if (!name || !routingId) { res.status(400).json({ error: 'Nombre y flujo de producción son requeridos' }); return }
  const recipe = await prisma.recipe.create({
    data: {
      name,
      version: version || '1.0',
      description,
      routingId,
      yieldQty: yieldQty || 1,
      yieldUnit: yieldUnit || 'unidades',
      salePrice: salePrice || 0,
      taxRate: taxRate !== undefined ? parseFloat(taxRate) : 0.19
    },
    include: INCLUDE_FULL
  })
  res.status(201).json(recipe)
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, version, description, routingId, yieldQty, yieldUnit, salePrice, taxRate } = req.body
  try {
    const recipe = await prisma.recipe.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(version && { version }),
        ...(description !== undefined && { description }),
        ...(routingId && { routingId }),
        ...(yieldQty !== undefined && { yieldQty: parseFloat(yieldQty) }),
        ...(yieldUnit && { yieldUnit }),
        ...(salePrice !== undefined && { salePrice: parseFloat(salePrice) }),
        ...(taxRate !== undefined && { taxRate: parseFloat(taxRate) })
      },
      include: INCLUDE_FULL
    })
    res.json(recipe)
  } catch {
    res.status(404).json({ error: 'Receta no encontrada' })
  }
})

// BOM management
router.post('/:id/bom', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { rawMaterialId, quantity, unit, isOptional, notes } = req.body
  if (!rawMaterialId || quantity === undefined) {
    res.status(400).json({ error: 'Materia prima y cantidad son requeridas' }); return
  }
  try {
    const item = await prisma.recipeBOMItem.upsert({
      where: { recipeId_rawMaterialId: { recipeId: req.params.id, rawMaterialId } },
      update: { quantity: parseFloat(quantity), unit, isOptional: isOptional || false, notes },
      create: { recipeId: req.params.id, rawMaterialId, quantity: parseFloat(quantity), unit, isOptional: isOptional || false, notes },
    })
    res.json(item)
  } catch {
    res.status(400).json({ error: 'Error al agregar ingrediente' })
  }
})

router.delete('/:id/bom/:itemId', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.recipeBOMItem.delete({ where: { id: req.params.itemId } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Ítem de BOM no encontrado' })
  }
})

// Cost calculation endpoint
router.get('/:id/cost', authenticate, async (req, res: Response) => {
  const recipe = await prisma.recipe.findUnique({
    where: { id: req.params.id },
    include: {
      bom: { include: { rawMaterial: true } },
      routing: {
        include: {
          steps: {
            include: { preferredMachine: { select: { hourlyOperatingCost: true, name: true } } }
          }
        }
      }
    }
  })
  if (!recipe) { res.status(404).json({ error: 'Receta no encontrada' }); return }

  const materialCost = recipe.bom.reduce((acc, item) => acc + item.quantity * item.rawMaterial.unitCost, 0)
  const machineCost = recipe.routing.steps.reduce((acc, step) => {
    const hours = step.targetDurationMin / 60
    const rate = step.preferredMachine?.hourlyOperatingCost || 0
    return acc + hours * rate
  }, 0)
  const totalCost = materialCost + machineCost
  const priceExTax = recipe.salePrice / (1 + recipe.taxRate)
  const margin = priceExTax > 0 ? (priceExTax - totalCost) / priceExTax : 0

  res.json({
    materialCost: +materialCost.toFixed(4),
    machineCost: +machineCost.toFixed(4),
    totalCost: +totalCost.toFixed(4),
    salePrice: recipe.salePrice,
    priceExTax: +priceExTax.toFixed(4),
    taxRate: recipe.taxRate,
    taxAmount: +(recipe.salePrice - priceExTax).toFixed(4),
    margin: +(margin * 100).toFixed(2),
    yieldQty: recipe.yieldQty,
    yieldUnit: recipe.yieldUnit
  })
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.recipe.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(400).json({ error: 'No se puede eliminar: en uso por lotes' })
  }
})

export default router
