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

  // OEE: ratio of actual vs target time for completed executions
  const completedExecutions = await prisma.batchExecution.findMany({
    where: { status: 'COMPLETED' },
    include: {
      stepExecutions: { select: { actualTimeSeconds: true } },
      batch: { include: { recipe: { select: { targetTimeMinutes: true } } } }
    },
    orderBy: { completedAt: 'desc' },
    take: 20
  })

  let avgEfficiency = 0
  if (completedExecutions.length > 0) {
    const efficiencies = completedExecutions.map(exec => {
      const totalActual = exec.stepExecutions.reduce((sum, s) => sum + (s.actualTimeSeconds || 0), 0) / 60
      const target = exec.batch.recipe.targetTimeMinutes
      if (!target || totalActual === 0) return 100
      return Math.min(200, (target / totalActual) * 100)
    })
    avgEfficiency = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length
  }

  // Bottleneck: steps with highest avg time vs target
  const stepStats = await prisma.stepExecution.groupBy({
    by: ['recipeStepId'],
    _avg: { actualTimeSeconds: true },
    _count: { id: true },
    where: { status: 'COMPLETED', actualTimeSeconds: { not: null } }
  })

  const stepDetails = await Promise.all(
    stepStats.slice(0, 5).map(async s => {
      const step = await prisma.recipeStep.findUnique({
        where: { id: s.recipeStepId },
        select: { name: true, targetTimeMinutes: true, recipe: { select: { name: true } } }
      })
      return {
        stepId: s.recipeStepId,
        stepName: step?.name || 'Desconocido',
        recipeName: step?.recipe?.name || '',
        avgActualMinutes: ((s._avg.actualTimeSeconds || 0) / 60).toFixed(1),
        targetMinutes: step?.targetTimeMinutes || 0,
        count: s._count.id
      }
    })
  )

  // Recent executions
  const recentExecutions = await prisma.batchExecution.findMany({
    include: {
      batch: { include: { recipe: { select: { name: true } }, machine: { select: { name: true } } } },
      user: { select: { name: true } }
    },
    orderBy: { startedAt: 'desc' },
    take: 10
  })

  // Efficiency per recent execution for chart
  const efficiencyChart = completedExecutions.slice(0, 10).map(exec => {
    const totalActualMin = exec.stepExecutions.reduce((sum, s) => sum + (s.actualTimeSeconds || 0), 0) / 60
    return {
      batchId: exec.batchId,
      actualMinutes: totalActualMin.toFixed(1),
      targetMinutes: exec.batch.recipe.targetTimeMinutes,
      efficiency: totalActualMin > 0
        ? ((exec.batch.recipe.targetTimeMinutes / totalActualMin) * 100).toFixed(1)
        : '100'
    }
  })

  res.json({
    totalBatches,
    pendingBatches,
    inProgressBatches,
    completedBatches,
    avgEfficiency: avgEfficiency.toFixed(1),
    stepStats: stepDetails,
    recentExecutions,
    efficiencyChart
  })
})

export default router
