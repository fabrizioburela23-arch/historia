import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

router.get('/metrics', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const [totalBatches, pendingBatches, inProgressBatches, completedBatches] = await Promise.all([
    prisma.batch.count(),
    prisma.batch.count({ where: { status: 'PENDING' } }),
    prisma.batch.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.batch.count({ where: { status: 'COMPLETED' } })
  ])

  // ===== Rendimiento por flujo (histórico) =====
  const flows = await prisma.processFlow.findMany({
    select: { id: true, name: true, expectedOutputQty: true, inputQty: true }
  })
  const completedFlows = await prisma.batchFlow.findMany({
    where: { status: 'COMPLETED', outputQtyActual: { not: null }, inputQtyActual: { not: null } },
    select: {
      flowId: true,
      inputQtyActual: true,
      outputQtyActual: true,
      outputQtyExpected: true,
      plannedTimeMin: true,
      downtimeMin: true,
      startedAt: true,
      completedAt: true,
      steps: { select: { actualTimeSeconds: true } }
    }
  })

  const flowYields = flows.map(f => {
    const runs = completedFlows.filter(r => r.flowId === f.id)
    const yields = runs.map(r => (r.inputQtyActual && r.inputQtyActual > 0
      ? (r.outputQtyActual! / r.inputQtyActual) * 100
      : 0))
    const avg = yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : null
    return {
      flowId: f.id,
      flowName: f.name,
      runs: runs.length,
      avgYield: avg !== null ? avg.toFixed(1) : null
    }
  })

  // ===== OEE (clásico) =====
  // Por cada BatchFlow completado:
  //   Availability = (plannedTime - downtime) / plannedTime
  //   Performance  = sum(targetStepTimes) / sum(actualStepTimes)
  //   Quality      = outputQtyActual / outputQtyExpected
  let oeeSum = 0, availSum = 0, perfSum = 0, qualSum = 0, oeeCount = 0
  for (const bf of completedFlows) {
    const planned = bf.plannedTimeMin || 0
    const downtime = bf.downtimeMin || 0
    const availability = planned > 0 ? Math.max(0, (planned - downtime) / planned) : 1

    const actualSec = bf.steps.reduce((s, st) => s + (st.actualTimeSeconds || 0), 0)
    const actualMin = actualSec / 60
    const operatingMin = Math.max(0.001, actualMin) // protege división
    const performance = planned > 0 ? Math.min(1, planned / operatingMin) : 1

    const quality = bf.outputQtyExpected > 0
      ? Math.min(1, (bf.outputQtyActual || 0) / bf.outputQtyExpected)
      : 1

    oeeSum += availability * performance * quality
    availSum += availability
    perfSum += performance
    qualSum += quality
    oeeCount += 1
  }

  const oee = oeeCount > 0 ? (oeeSum / oeeCount) * 100 : null
  const avgAvailability = oeeCount > 0 ? (availSum / oeeCount) * 100 : null
  const avgPerformance = oeeCount > 0 ? (perfSum / oeeCount) * 100 : null
  const avgQuality = oeeCount > 0 ? (qualSum / oeeCount) * 100 : null

  // ===== Lotes recientes =====
  const recentBatches = await prisma.batch.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      recipe: { select: { name: true } },
      flows: {
        select: {
          status: true,
          outputQtyActual: true,
          outputQtyExpected: true,
          inputQtyActual: true,
          flow: { select: { name: true } }
        }
      }
    }
  })

  // ===== Serie de rendimiento por lote (últimos 10) =====
  const yieldChart = recentBatches
    .filter(b => b.status === 'COMPLETED')
    .slice(0, 10)
    .map(b => {
      const totalIn = b.flows.reduce((s, f) => s + (f.inputQtyActual || 0), 0)
      const totalOut = b.flows.reduce((s, f) => s + (f.outputQtyActual || 0), 0)
      return {
        name: b.name,
        yield: totalIn > 0 ? +((totalOut / totalIn) * 100).toFixed(1) : 0
      }
    })

  res.json({
    counts: { totalBatches, pendingBatches, inProgressBatches, completedBatches },
    oee: oee !== null ? +oee.toFixed(1) : null,
    availability: avgAvailability !== null ? +avgAvailability.toFixed(1) : null,
    performance: avgPerformance !== null ? +avgPerformance.toFixed(1) : null,
    quality: avgQuality !== null ? +avgQuality.toFixed(1) : null,
    flowYields,
    recentBatches: recentBatches.map(b => ({
      id: b.id,
      name: b.name,
      status: b.status,
      mode: b.mode,
      createdAt: b.createdAt,
      recipeName: b.recipe?.name
    })),
    yieldChart
  })
})

export default router
