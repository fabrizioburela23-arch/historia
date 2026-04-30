import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Sembrando base de datos...')

  // Users
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

  // Machines
  const machine1 = await prisma.machine.upsert({
    where: { code: 'PROC-TOM-L1' },
    update: {},
    create: {
      name: 'Procesadora de Tomate Línea 1',
      description: 'Procesadora industrial para tomate fresco',
      code: 'PROC-TOM-L1'
    }
  })

  const machine2 = await prisma.machine.upsert({
    where: { code: 'MEZC-L2' },
    update: {},
    create: {
      name: 'Mezcladora Línea 2',
      description: 'Mezcladora para salsas y purés',
      code: 'MEZC-L2'
    }
  })

  const machine3 = await prisma.machine.upsert({
    where: { code: 'ENVA-L3' },
    update: {},
    create: {
      name: 'Envasadora Automática L3',
      description: 'Línea de envasado aséptico',
      code: 'ENVA-L3'
    }
  })

  console.log(`✅ Máquinas: ${machine1.code}, ${machine2.code}, ${machine3.code}`)

  // Recipe: Procesado de Tomate
  const existingRecipe = await prisma.recipe.findFirst({ where: { name: 'Procesado de Tomate' } })
  let recipe
  if (!existingRecipe) {
    recipe = await prisma.recipe.create({
      data: {
        name: 'Procesado de Tomate',
        description: 'Receta estándar para el procesado de tomate fresco a salsa',
        targetTimeMinutes: 75,
        steps: {
          create: [
            {
              order: 1,
              name: 'Preparación y Limpieza',
              description: 'Limpieza y saneamiento del equipo antes de iniciar',
              targetTimeMinutes: 10,
              checklistItems: {
                create: [
                  { label: 'Limpiar tolva de entrada', required: true, order: 0 },
                  { label: 'Verificar temperatura de proceso (60-65°C)', required: true, order: 1 },
                  { label: 'Revisar filtros de salida', required: true, order: 2 },
                  { label: 'Comprobar presión hidráulica', required: false, order: 3 }
                ]
              }
            },
            {
              order: 2,
              name: 'Carga de Materia Prima',
              description: 'Pesaje y carga del tomate fresco',
              targetTimeMinutes: 15,
              checklistItems: {
                create: [
                  { label: 'Pesar tomates (min 500 kg)', required: true, order: 0 },
                  { label: 'Verificar calidad visual (sin moho)', required: true, order: 1 },
                  { label: 'Registrar lote de proveedor', required: true, order: 2 },
                  { label: 'Añadir aditivos según especificación', required: false, order: 3 }
                ]
              }
            },
            {
              order: 3,
              name: 'Procesado Principal',
              description: 'Ciclo principal de procesado y pasteurización',
              targetTimeMinutes: 30,
              checklistItems: {
                create: [
                  { label: 'Monitorear temperatura cada 5 min', required: true, order: 0 },
                  { label: 'Verificar velocidad de tornillo (RPM)', required: true, order: 1 },
                  { label: 'Control de Brix (°Brix = 12-14)', required: true, order: 2 },
                  { label: 'Tomar muestra para laboratorio', required: false, order: 3 }
                ]
              }
            },
            {
              order: 4,
              name: 'Descarga y Limpieza Final',
              description: 'Descarga del producto, registro de mermas y limpieza CIP',
              targetTimeMinutes: 20,
              checklistItems: {
                create: [
                  { label: 'Registrar merma de proceso (%)', required: true, order: 0 },
                  { label: 'Limpiar tolva de salida', required: true, order: 1 },
                  { label: 'Ejecutar ciclo CIP (15 min)', required: true, order: 2 },
                  { label: 'Registrar volumen de producto final', required: true, order: 3 }
                ]
              }
            }
          ]
        }
      }
    })
    console.log(`✅ Receta creada: ${recipe.name}`)
  } else {
    recipe = existingRecipe
    console.log(`ℹ️  Receta ya existe: ${recipe.name}`)
  }

  // Recipe 2
  const existingRecipe2 = await prisma.recipe.findFirst({ where: { name: 'Mezclado de Salsa Base' } })
  if (!existingRecipe2) {
    await prisma.recipe.create({
      data: {
        name: 'Mezclado de Salsa Base',
        description: 'Preparación de salsa base para múltiples productos',
        targetTimeMinutes: 45,
        steps: {
          create: [
            {
              order: 1,
              name: 'Preparación de ingredientes',
              description: 'Medir y preparar todos los ingredientes',
              targetTimeMinutes: 10,
              checklistItems: {
                create: [
                  { label: 'Pesar puré de tomate (200 kg)', required: true, order: 0 },
                  { label: 'Medir especias según fórmula', required: true, order: 1 }
                ]
              }
            },
            {
              order: 2,
              name: 'Mezclado y homogenización',
              description: 'Mezcla a velocidad controlada',
              targetTimeMinutes: 25,
              checklistItems: {
                create: [
                  { label: 'Verificar homogeneidad visual', required: true, order: 0 },
                  { label: 'Control de pH (4.0-4.5)', required: true, order: 1 },
                  { label: 'Ajuste de sal si necesario', required: false, order: 2 }
                ]
              }
            },
            {
              order: 3,
              name: 'Aprobación y transferencia',
              description: 'Revisión final y transferencia a envasado',
              targetTimeMinutes: 10,
              checklistItems: {
                create: [
                  { label: 'Aprobación de calidad firmada', required: true, order: 0 },
                  { label: 'Registrar batch number', required: true, order: 1 }
                ]
              }
            }
          ]
        }
      }
    })
    console.log('✅ Receta 2 creada: Mezclado de Salsa Base')
  }

  // Batches
  const existingBatch = await prisma.batch.findFirst({ where: { name: 'LOTE-2024-001' } })
  if (!existingBatch) {
    await prisma.batch.create({
      data: {
        name: 'LOTE-2024-001',
        recipeId: recipe.id,
        machineId: machine1.id,
        status: 'PENDING',
        notes: 'Primer lote de prueba - tomate variedad Río Grande'
      }
    })
    console.log('✅ Lote creado: LOTE-2024-001')
  }

  const existingBatch2 = await prisma.batch.findFirst({ where: { name: 'LOTE-2024-002' } })
  if (!existingBatch2) {
    await prisma.batch.create({
      data: {
        name: 'LOTE-2024-002',
        recipeId: recipe.id,
        machineId: machine1.id,
        status: 'PENDING',
        notes: 'Lote 2 - tomate cherry procesado'
      }
    })
    console.log('✅ Lote creado: LOTE-2024-002')
  }

  console.log('\n🏭 Base de datos lista.\n')
  console.log('  Admin:    admin@mes.com   / admin123')
  console.log('  Operario: operario@mes.com / op123\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
