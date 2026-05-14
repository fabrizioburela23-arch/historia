import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const batchInclude = {
  recipe: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  flows: {
    orderBy: { order: 'asc' as const },
    include: {
      flow: { select: { id: true, name: true, targetTimeMinutes: true } },
      inputProduct: true,
      outputProduct: true,
      machine: { select: { id: true, name: true, code: true } },
      operator: { select: { id: true, name: true } },
      steps: {
        orderBy: { order: 'asc' as const },
        include: {
          step: {
            include: {
              checklistItems: { orderBy: { order: 'asc' as const } }
            }
          },
          checks: true
        }
      }
    }
  }
}

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { status } = req.query
  const where = status ? { status: status as string } : {}
  const batches = await prisma.batch.findMany({
    where,
    include: batchInclude,
    orderBy: { createdAt: 'desc' }
  })
  res.json(batches)
})

router.get('/:id', authenticate, async (req, res: Response) => {
  const batch = await prisma.batch.findUnique({
    where: { id: req.params.id },
    include: batchInclude
  })
  if (!batch) { res.status(404).json({ error: 'Lote no encontrado' }); return }
  res.json(batch)
})

/**
 * Body shape:
 * - mode = "SINGLE_FLOW":  { name, flowId, plannedInputQty?, machineId?, ... }
 * - mode = "RECIPE":       { name, recipeId, batchSize?, ... }
 *
 * Genera la cadena de BatchFlow + BatchStep automáticamente.
 */
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const {
    name, mode, executionMode, priority, notes,
    supervisorName, plannedStartAt, plannedEndAt,
    flowId, machineId, plannedInputQty,
    recipeId, batchSize
  } = req.body

  if (!name) { res.status(400).json({ error: 'Nombre requerido' }); return }
  const batchMode = mode === 'RECIPE' ? 'RECIPE' : 'SINGLE_FLOW'

  if (batchMode === 'SINGLE_FLOW' && !flowId) {
    res.status(400).json({ error: 'flowId requerido para lote monoelemento' }); return
  }
  if (batchMode === 'RECIPE' && !recipeId) {
    res.status(400).json({ error: 'recipeId requerido para lote por receta' }); return
  }

  // Build flow definitions
  type FlowSpec = { flowId: string; order: number; inputMultiplier: number }
  let flowSpecs: FlowSpec[] = []

  if (batchMode === 'SINGLE_FLOW') {
    const flow = await prisma.processFlow.findUnique({ where: { id: flowId } })
    if (!flow) { res.status(404).json({ error: 'Flujo no encontrado' }); return }
    const mult = plannedInputQty ? parseFloat(plannedInputQty) / flow.inputQty : 1
    flowSpecs = [{ flowId: flow.id, order: 0, inputMultiplier: mult }]
  } else {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { flows: { orderBy: { order: 'asc' } } }
    })
    if (!recipe) { res.status(404).json({ error: 'Receta no encontrada' }); return }
    const mult = batchSize ? parseFloat(batchSize) : 1
    flowSpecs = recipe.flows.map(rf => ({ flowId: rf.flowId, order: rf.order, inputMultiplier: mult }))
  }

  const batch = await prisma.batch.create({
    data: {
      name,
      mode: batchMode,
      executionMode: executionMode === 'PARALLEL' ? 'PARALLEL' : 'SEQUENTIAL',
      priority: priority || 'NORMAL',
      notes,
      supervisorName,
      createdById: req.user!.id,
      recipeId: batchMode === 'RECIPE' ? recipeId : null,
      plannedStartAt: plannedStartAt ? new Date(plannedStartAt) : null,
      plannedEndAt: plannedEndAt ? new Date(plannedEndAt) : null
    }
  })

  // Crear BatchFlows + BatchSteps con snapshot del flow
  for (const spec of flowSpecs) {
    const flow = await prisma.processFlow.findUnique({
      where: { id: spec.flowId },
      include: { steps: { orderBy: { order: 'asc' }, include: { checklistItems: true } } }
    })
    if (!flow) continue

    const plannedTime = flow.steps.reduce((s, st) => s + (st.targetTimeMinutes || 0), 0) || flow.targetTimeMinutes

    const bf = await prisma.batchFlow.create({
      data: {
        batchId: batch.id,
        flowId: flow.id,
        order: spec.order,
        inputProductId: flow.inputProductId,
        inputQtyPlanned: flow.inputQty * spec.inputMultiplier,
        inputUnit: flow.inputUnit,
        outputProductId: flow.outputProductId,
        outputQtyExpected: flow.expectedOutputQty * spec.inputMultiplier,
        outputUnit: flow.outputUnit,
        machineId: batchMode === 'SINGLE_FLOW' && machineId ? machineId : flow.machineId,
        plannedTimeMin: plannedTime
      }
    })

    // BatchSteps
    for (let i = 0; i < flow.steps.length; i++) {
      const st = flow.steps[i]
      const bs = await prisma.batchStep.create({
        data: {
          batchFlowId: bf.id,
          stepId: st.id,
          order: st.order ?? i
        }
      })
      // Crear placeholders de check (no completados aún)
      if (st.checklistItems.length > 0) {
        await prisma.batchStepCheck.createMany({
          data: st.checklistItems.map(ci => ({
            batchStepId: bs.id,
            checklistItemId: ci.id,
            completed: false
          }))
        })
      }
    }
  }

  const full = await prisma.batch.findUnique({ where: { id: batch.id }, include: batchInclude })
  res.status(201).json(full)
})

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, priority, notes, supervisorName, plannedStartAt, plannedEndAt, executionMode } = req.body
  try {
    const batch = await prisma.batch.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(priority && { priority }),
        ...(notes !== undefined && { notes }),
        ...(supervisorName !== undefined && { supervisorName }),
        ...(plannedStartAt !== undefined && { plannedStartAt: plannedStartAt ? new Date(plannedStartAt) : null }),
        ...(plannedEndAt !== undefined && { plannedEndAt: plannedEndAt ? new Date(plannedEndAt) : null }),
        ...(executionMode && { executionMode })
      },
      include: batchInclude
    })
    res.json(batch)
  } catch {
    res.status(404).json({ error: 'Lote no encontrado' })
  }
})

router.delete('/:id', authenticate, requireAdmin, async (req, res: Response) => {
  try {
    await prisma.batch.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Lote no encontrado' })
  }
})

// ===== Operador: arrancar lote y operar flujos =====

router.post('/:id/start', authenticate, async (req: AuthRequest, res: Response) => {
  const batch = await prisma.batch.update({
    where: { id: req.params.id },
    data: { status: 'IN_PROGRESS', startedAt: new Date() }
  })
  res.json(batch)
})

router.post('/:id/complete', authenticate, async (req: AuthRequest, res: Response) => {
  const batch = await prisma.batch.update({
    where: { id: req.params.id },
    data: { status: 'COMPLETED', completedAt: new Date() }
  })
  res.json(batch)
})

// Cancelar lote
router.post('/:id/cancel', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const batch = await prisma.batch.update({
    where: { id: req.params.id },
    data: { status: 'CANCELLED', completedAt: new Date() }
  })
  res.json(batch)
})

// ===== BatchFlow endpoints =====

router.put('/flows/:flowId/start', authenticate, async (req: AuthRequest, res: Response) => {
  const { inputQtyActual } = req.body
  const bf = await prisma.batchFlow.update({
    where: { id: req.params.flowId },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      operatorId: req.user!.id,
      ...(inputQtyActual != null && { inputQtyActual: parseFloat(inputQtyActual) })
    }
  })
  res.json(bf)
})

router.put('/flows/:flowId/complete', authenticate, async (req: AuthRequest, res: Response) => {
  const { outputQtyActual, downtimeMin } = req.body
  if (outputQtyActual == null) {
    res.status(400).json({ error: 'outputQtyActual requerido' }); return
  }
  const bf = await prisma.batchFlow.update({
    where: { id: req.params.flowId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      outputQtyActual: parseFloat(outputQtyActual),
      ...(downtimeMin != null && { downtimeMin: parseInt(downtimeMin) })
    }
  })
  res.json(bf)
})

router.put('/flows/:flowId', authenticate, async (req: AuthRequest, res: Response) => {
  const { inputQtyActual, outputQtyActual, downtimeMin } = req.body
  const bf = await prisma.batchFlow.update({
    where: { id: req.params.flowId },
    data: {
      ...(inputQtyActual != null && { inputQtyActual: parseFloat(inputQtyActual) }),
      ...(outputQtyActual != null && { outputQtyActual: parseFloat(outputQtyActual) }),
      ...(downtimeMin != null && { downtimeMin: parseInt(downtimeMin) })
    }
  })
  res.json(bf)
})

// ===== BatchStep endpoints =====

router.put('/steps/:stepId/start', authenticate, async (req: AuthRequest, res: Response) => {
  const step = await prisma.batchStep.update({
    where: { id: req.params.stepId },
    data: { status: 'IN_PROGRESS', startedAt: new Date() }
  })
  res.json(step)
})

router.put('/steps/:stepId/complete', authenticate, async (req: AuthRequest, res: Response) => {
  const { observations } = req.body
  const existing = await prisma.batchStep.findUnique({ where: { id: req.params.stepId } })
  if (!existing) { res.status(404).json({ error: 'Paso no encontrado' }); return }
  const actualSec = existing.startedAt
    ? Math.round((Date.now() - existing.startedAt.getTime()) / 1000)
    : null
  const step = await prisma.batchStep.update({
    where: { id: req.params.stepId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      actualTimeSeconds: actualSec,
      observations
    }
  })
  res.json(step)
})

router.put('/checks/:checkId', authenticate, async (req: AuthRequest, res: Response) => {
  const { completed } = req.body
  const check = await prisma.batchStepCheck.update({
    where: { id: req.params.checkId },
    data: {
      completed: !!completed,
      completedAt: completed ? new Date() : null
    }
  })
  res.json(check)
})

export default router
