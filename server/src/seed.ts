import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Sembrando base de datos...')

  const adminPlain = 'admin123'
  const opPlain = 'op123'

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mes.com' },
    update: { passwordPlain: adminPlain, password: await bcrypt.hash(adminPlain, 10) },
    create: {
      name: 'Administrador',
      email: 'admin@mes.com',
      password: await bcrypt.hash(adminPlain, 10),
      passwordPlain: adminPlain,
      role: 'ADMIN'
    }
  })

  const operator = await prisma.user.upsert({
    where: { email: 'operario@mes.com' },
    update: { passwordPlain: opPlain, password: await bcrypt.hash(opPlain, 10) },
    create: {
      name: 'Carlos Operario',
      email: 'operario@mes.com',
      password: await bcrypt.hash(opPlain, 10),
      passwordPlain: opPlain,
      role: 'OPERATOR'
    }
  })

  console.log(`✅ Usuarios: ${admin.email} / ${adminPlain} | ${operator.email} / ${opPlain}`)

  // Productos
  const productData = [
    { code: 'MP-TOM', name: 'Tomate fresco', type: 'RAW', unit: 'kg' },
    { code: 'MP-AJI', name: 'Ají rocoto', type: 'RAW', unit: 'kg' },
    { code: 'MP-SAL', name: 'Sal', type: 'RAW', unit: 'kg' },
    { code: 'MP-GLU', name: 'Glutamato monosódico', type: 'RAW', unit: 'kg' },
    { code: 'INT-TOM-DES', name: 'Tomate deshidratado', type: 'INTERMEDIATE', unit: 'kg' },
    { code: 'INT-AJI-PROC', name: 'Ají procesado', type: 'INTERMEDIATE', unit: 'kg' },
    { code: 'FIN-LLAJUA', name: 'Llajua envasada', type: 'FINAL', unit: 'u' }
  ]
  for (const p of productData) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: { name: p.name, type: p.type, unit: p.unit },
      create: p
    })
  }
  console.log(`✅ Productos: ${productData.length}`)

  // Máquinas
  await prisma.machine.upsert({
    where: { code: 'DESHID-T1' },
    update: {},
    create: { name: 'Deshidratadora T1', code: 'DESHID-T1', machineType: 'Deshidratado' }
  })
  await prisma.machine.upsert({
    where: { code: 'MOLINO-A1' },
    update: {},
    create: { name: 'Molino Ají A1', code: 'MOLINO-A1', machineType: 'Molienda' }
  })
  await prisma.machine.upsert({
    where: { code: 'ENVA-L1' },
    update: {},
    create: { name: 'Envasadora L1', code: 'ENVA-L1', machineType: 'Envasado' }
  })
  console.log(`✅ Máquinas creadas`)

  console.log('\n🏭 Base de datos lista.\n')
  console.log(`  Admin:    admin@mes.com    / ${adminPlain}`)
  console.log(`  Operario: operario@mes.com / ${opPlain}\n`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
