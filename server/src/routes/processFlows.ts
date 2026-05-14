import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const flowInclude = {
  inputProduct: true,
  outputProduct: true,
  machine: { select: { id: true, name: true, code: true } },
  steps: {
    orderBy: { order: 'asc' as const },
    include: {
      checklistItems: { orderBy: { order: 'asc' as const } }
    }
  }
}

router.get('/', authenticate, async (_req, res: Response) => {
  const flows = await prisma.processFlow.findMany({
    include: flowInclude,
    orderBy: { createdAt: 'desc' }
  })

  // Adjuntar rendimiento histórico promedio
  const stats = await prisma.batchFlow.groupBy({
    by: ['flowId'],
    where: { status: 'COMPLETED', outputQtyActual: { not: null }, inputQtyActual: { not: null } },
    _count: { id: true }
  })

  const histYields = await Promise.all(
    stats.map(async s => {
      const runs = await prisma.batchFlow.findMany({
        where: { flowId: s.flowId, status: 'COMPLETED', outputQtyActual: { not: null }, inputQtyActual: { not: null } },
        select: { inputQtyActual: true, outputQtyActual: true }
      })
      const yields = runs
        .map(r => (r.inputQtyActual && r.inputQtyActual > 0 ? (r.outputQtyActual! / r.inputQtyActual) * 100 : null))
        .filter((y): y is number => y !== null)
      const avg = yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : null
      return { flowId: s.flowId, avgYield: avg, runs: s._count.id }
    })
  )

  const yieldMap = new Map(histYields.map(h => [h.flowId, h]))
  res.json(flows.map(f => ({
    ...f,
    historicalYield: yieldMap.get(f.id)?.avgYield ?? null,
    historicalRuns: yieldMap.get(f.id)?.runs ?? 0
  })))
})

router.get('/:id', authenticate, async (req, res: Response) => {
  const flow = await prisma.processFlow.findUnique({
    where: { id: req.params.id },
    include: flowInclude
  })
  if (!flow) { res.status(404).json({ error: 'Flujo no encontrado' }); return }
  res.json(flow)
})

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const {
    name, description, machineId,
    inputProductId, inputQty, inputUnit,
    outputProductId, expectedOutputQty, outputUnit,
    targetTimeMinutes, steps
  } = req.body

  if (!name || !inputProductId || !outputProductId || inputQty == null || expectedOutputQty == null) {
    res.status(400).json({ error: 'Faltan campos requeridos' }); return
  }

  const flow = await prisma.processFlow.create({
    data: {
      name,
      description,
      machineId: machineId || null,
      inputProductId,
      inputQty: parseFloat(inputQty),
      inputUnit: inputUnit || '',
      outputProductId,
      expectedOutputQty: parseFloat(expectedOutputQty),
      outputUnit: outputUnit || '',
      targetTimeMinutes: targetTimeMinutes ? parseInt(targetTimeMinutes) : 0,
      steps: Array.isArray(steps) ? {
        create: steps.map((s: any, idx: number) => ({
          order: s.order ?? idx,
          name: s.name,
          description: s.description || null,
          targetTimeMinutes: s.targetTimeMinutes ? parseInt(s.targetTimeMinutes) : 0,
          checklistItems: Array.isArray(s.checklistItems) ? {
            create: s.checklistItems.map((c: any, cIdx: number) => ({
              label: c.label,
              required: c.required !== false,
              order: c.order ?? cIdx
            }))
          } : undefined
        }))
      } : undefined
    },
    include: flowInclude
  })
  res.status(201).json(flow)
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const {
    name, description, machineId,
    inputProductId, inputQty, inputUnit,
    outputProductId, expectedOutputQty, outputUnit,
    targetTimeMinutes, steps
  } = req.body

  try {
    // Update top-level fields
    await prisma.processFlow.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(machineId !== undefined && { machineId: machineId || null }),
        ...(inputProductId && { inputProductId }),
        ...(inputQty != null && { inputQty: parseFloat(inputQty) }),
        ...(inputUnit !== undefined && { inputUnit }),
        ...(outputProductId && { outputProductId }),
        ...(expectedOutputQty != null && { expectedOutputQty: parseFloat(expectedOutputQty) }),
        ...(outputUnit !== undefined && { outputUnit }),
        ...(targetTimeMinutes != null && { targetTimeMinutes: parseInt(targetTimeMinutes) })
      }
    })

    // Si llegan steps, reemplazar todos
    if (Array.isArray(steps)) {
      await prisma.processStep.deleteMany({ where: { flowId: req.params.id } })
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]
        await prisma.processStep.create({
          data: {
            flowId: req.params.id,
            order: s.order ?? i,
            name: s.name,
            description: s.description || null,
            targetTimeMinutes: s.targetTimeMinutes ? parseInt(s.targetTimeMinutes) : 0,
            checklistItems: Array.isArray(s.checklistItems) ? {
              create: s.checklistItems.map((c: any, cIdx: number) => ({
                label: c.label,
                required: c.required !== false,
                order: c.order ?? cIdx
              }))
            } : undefined
          }
        })
      }
    }

    const updated = await prisma.processFlow.findUnique({
      where: { id: req.params.id },
      include: flowInclude
    })
    res.json(updated)
  } catch (e) {
    console.error(e)
    res.status(404).json({ error: 'Flujo no encontrado' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.processFlow.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(409).json({ error: 'No se puede eliminar: flujo en uso' })
  }
})

export default router
