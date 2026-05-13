import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Sembrando base de datos...')

  const adminPwd = await bcrypt.hash('admin123', 10)
  const opPwd = await bcrypt.hash('op123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mes.com' },
    update: {},
    create: { name: 'Administrador', email: 'admin@mes.com', password: adminPwd, role: 'ADMIN' }
  })

  const operator = await prisma.user.upsert({
    where: { email: 'operario@mes.com' },
    update: {},
    create: { name: 'Carlos Operario', email: 'operario@mes.com', password: opPwd, role: 'OPERATOR' }
  })

  console.log(`✅ Usuarios: ${admin.email} (admin123) | ${operator.email} (op123)`)

  const machine1 = await prisma.machine.upsert({
    where: { code: 'DESH-01' },
    update: {},
    create: {
      name: 'Deshidratadora Nro 1',
      code: 'DESH-01',
      machineType: 'Deshidratadora',
      status: 'ACTIVE',
      hourlyOperatingCost: 5.0
    }
  })

  const machine2 = await prisma.machine.upsert({
    where: { code: 'MOLI-01' },
    update: {},
    create: {
      name: 'Molino de Especias',
      code: 'MOLI-01',
      machineType: 'Cortadora',
      status: 'ACTIVE',
      hourlyOperatingCost: 3.5
    }
  })

  console.log(`✅ Máquinas: ${machine1.code}, ${machine2.code}`)

  const mat1 = await prisma.rawMaterial.upsert({
    where: { code: 'MP-LOCOTO' },
    update: {},
    create: { name: 'Locoto fresco', code: 'MP-LOCOTO', unit: 'kg', unitCost: 2.5, stockQty: 100 }
  })

  const mat2 = await prisma.rawMaterial.upsert({
    where: { code: 'MP-SAL' },
    update: {},
    create: { name: 'Sal fina', code: 'MP-SAL', unit: 'kg', unitCost: 0.8, stockQty: 50 }
  })

  console.log(`✅ Materias primas: ${mat1.code}, ${mat2.code}`)

  const op1 = await prisma.operation.upsert({
    where: { code: 'OP-LIMPIEZA' },
    update: {},
    create: {
      name: 'Limpieza y Preparación',
      code: 'OP-LIMPIEZA',
      defaultDurationMin: 15,
      checklistItems: {
        create: [
          { label: 'Limpiar equipo', required: true, order: 0 },
          { label: 'Verificar temperatura', required: true, order: 1 }
        ]
      }
    }
  })

  const op2 = await prisma.operation.upsert({
    where: { code: 'OP-DESH' },
    update: {},
    create: {
      name: 'Deshidratación',
      code: 'OP-DESH',
      defaultDurationMin: 120,
      checklistItems: {
        create: [
          { label: 'Controlar temperatura (60-70°C)', required: true, order: 0 },
          { label: 'Registrar % humedad final', required: true, order: 1 }
        ]
      }
    }
  })

  console.log(`✅ Operaciones: ${op1.code}, ${op2.code}`)

  const existingRouting = await prisma.routing.findFirst({ where: { name: 'Línea Deshidratados' } })
  let routing
  if (!existingRouting) {
    routing = await prisma.routing.create({
      data: {
        name: 'Línea Deshidratados',
        version: '1.0',
        description: 'Flujo estándar para productos deshidratados',
        steps: {
          create: [
            { order: 1, operationId: op1.id, targetDurationMin: 15, preferredMachineId: machine1.id },
            { order: 2, operationId: op2.id, targetDurationMin: 120, preferredMachineId: machine1.id }
          ]
        }
      }
    })
    console.log(`✅ Flujo creado: ${routing.name}`)
  } else {
    routing = existingRouting
    console.log(`ℹ️  Flujo ya existe: ${routing.name}`)
  }

  const existingRecipe = await prisma.recipe.findFirst({ where: { name: 'Locoto Deshidratado Premium' } })
  let recipe
  if (!existingRecipe) {
    recipe = await prisma.recipe.create({
      data: {
        name: 'Locoto Deshidratado Premium',
        version: '1.0',
        routingId: routing.id,
        yieldQty: 10,
        yieldUnit: 'kg',
        salePrice: 120.0,
        taxRate: 0.19,
        bom: {
          create: [
            { rawMaterialId: mat1.id, quantity: 80, unit: 'kg' },
            { rawMaterialId: mat2.id, quantity: 0.5, unit: 'kg' }
          ]
        }
      }
    })
    console.log(`✅ Receta creada: ${recipe.name}`)
  } else {
    recipe = existingRecipe
    console.log(`ℹ️  Receta ya existe: ${recipe.name}`)
  }

  const existingBatch = await prisma.batch.findFirst({ where: { name: 'LOTE-2025-001' } })
  if (!existingBatch) {
    await prisma.batch.create({
      data: {
        name: 'LOTE-2025-001',
        recipeId: recipe.id,
        status: 'PENDING',
        priority: 'NORMAL',
        plannedQty: 10,
        unit: 'kg',
        supervisorName: 'Carlos Operario'
      }
    })
    console.log('✅ Lote creado: LOTE-2025-001')
  }

  console.log('\n🏭 Base de datos lista.\n')
  console.log('  Admin:    admin@mes.com    / admin123')
  console.log('  Operario: operario@mes.com / op123\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
