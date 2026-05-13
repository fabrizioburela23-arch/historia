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

  // Eficiencia: ratio tiempo real vs objetivo de ejecuciones completadas
  const completedExecutions = await prisma.batchExecution.findMany({
    where: { status: 'COMPLETED' },
    include: {
      processExecutions: { select: { manHours: true, machineHours: true, startedAt: true, completedAt: true } },
      batch: {
        include: {
          recipe: {
            include: {
              routing: { include: { steps: { select: { targetDurationMin: true } } } }
            }
          }
        }
      }
    },
    orderBy: { completedAt: 'desc' },
    take: 20
  })

  let avgEfficiency = 0
  if (completedExecutions.length > 0) {
    const efficiencies = completedExecutions.map(exec => {
      const totalTarget = exec.batch.recipe.routing.steps.reduce((s, step) => s + step.targetDurationMin, 0)
      const totalActual = exec.processExecutions.reduce((s, p) => {
        if (p.startedAt && p.completedAt) {
          return s + (p.completedAt.getTime() - p.startedAt.getTime()) / 60000
        }
        return s
      }, 0)
      if (!totalTarget || totalActual === 0) return 100
      return Math.min(200, (totalTarget / totalActual) * 100)
    })
    avgEfficiency = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length
  }

  // Operaciones con mayor tiempo promedio (cuellos de botella)
  const opStats = await prisma.processExecution.groupBy({
    by: ['routingStepId'],
    _avg: { manHours: true },
    _count: { id: true },
    where: { status: 'COMPLETED', manHours: { not: null } }
  })

  const opDetails = await Promise.all(
    opStats.slice(0, 5).map(async s => {
      const step = await prisma.routingStep.findUnique({
        where: { id: s.routingStepId },
        select: { targetDurationMin: true, operation: { select: { name: true } }, routing: { select: { name: true } } }
      })
      return {
        stepId: s.routingStepId,
        stepName: step?.operation?.name || 'Desconocido',
        routingName: step?.routing?.name || '',
        avgManHours: (s._avg.manHours || 0).toFixed(2),
        targetMin: step?.targetDurationMin || 0,
        count: s._count.id
      }
    })
  )

  // Ejecuciones recientes
  const recentExecutions = await prisma.batchExecution.findMany({
    include: {
      batch: { include: { recipe: { select: { name: true } } } },
      user: { select: { name: true } }
    },
    orderBy: { startedAt: 'desc' },
    take: 10
  })

  // Gráfico eficiencia
  const efficiencyChart = completedExecutions.slice(0, 10).map(exec => {
    const totalTarget = exec.batch.recipe.routing.steps.reduce((s, step) => s + step.targetDurationMin, 0)
    const totalActual = exec.processExecutions.reduce((s, p) => {
      if (p.startedAt && p.completedAt) {
        return s + (p.completedAt.getTime() - p.startedAt.getTime()) / 60000
      }
      return s
    }, 0)
    return {
      batchId: exec.batchId,
      actualMinutes: totalActual.toFixed(1),
      targetMinutes: totalTarget,
      efficiency: totalActual > 0 ? ((totalTarget / totalActual) * 100).toFixed(1) : '100'
    }
  })

  // Costos acumulados del período
  const materialCosts = await prisma.materialConsumption.findMany({
    include: { rawMaterial: { select: { unitCost: true } } }
  })
  const totalMaterialCost = materialCosts.reduce((acc, mc) => acc + mc.actualQty * mc.rawMaterial.unitCost, 0)

  res.json({
    totalBatches, pendingBatches, inProgressBatches, completedBatches,
    avgEfficiency: avgEfficiency.toFixed(1),
    opStats: opDetails,
    recentExecutions,
    efficiencyChart,
    totalMaterialCost: +totalMaterialCost.toFixed(2)
  })
})

export default router
