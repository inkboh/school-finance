import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ── Currencies ──────────────────────────────────────────────────────────────

  // Make GHS the base currency (Riverdale Academy operates in Ghana)
  await prisma.currency.upsert({
    where: { code: 'USD' },
    update: { isBaseCurrency: false },
    create: {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      isBaseCurrency: false,
      isActive: true,
    },
  })

  const ghs = await prisma.currency.upsert({
    where: { code: 'GHS' },
    update: { isBaseCurrency: true },
    create: {
      code: 'GHS',
      name: 'Ghanaian Cedi',
      symbol: '₵',
      isBaseCurrency: true,
      isActive: true,
    },
  })

  const ngn = await prisma.currency.upsert({
    where: { code: 'NGN' },
    update: {},
    create: {
      code: 'NGN',
      name: 'Nigerian Naira',
      symbol: '₦',
      isBaseCurrency: false,
      isActive: true,
    },
  })

  void ghs // used by import script

  // Seed an initial exchange rate for NGN (1 NGN = 0.00065 USD approx)
  await prisma.exchangeRate.upsert({
    where: {
      currencyId_effectiveDate: {
        currencyId: ngn.id,
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      },
    },
    update: {},
    create: {
      currencyId: ngn.id,
      rate: 0.00065,
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
    },
  })

  console.log('Currencies seeded.')

  // ── Fee Categories ──────────────────────────────────────────────────────────

  const feeCategories = [
    { name: 'Tuition', description: 'Term tuition fees' },
    { name: 'Registration Fee', description: 'New student registration fee' },
    { name: 'PTA Levy', description: 'Parent-Teacher Association levy' },
    { name: 'Exam Fee', description: 'Examination fees' },
    { name: 'Development Levy', description: 'School development fund contribution' },
    { name: 'Uniform', description: 'School uniform fees' },
    { name: 'Books & Stationery', description: 'Books and stationery fees' },
  ]

  for (const cat of feeCategories) {
    await prisma.feeCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name, description: cat.description, isActive: true },
    })
  }

  console.log('Fee categories seeded.')

  // ── Expense Categories ──────────────────────────────────────────────────────

  // Parent categories first
  const salaries = await prisma.expenseCategory.upsert({
    where: { name: 'Salaries' },
    update: {},
    create: {
      name: 'Salaries',
      description: 'Staff salary payments',
      isActive: true,
    },
  })

  const utilities = await prisma.expenseCategory.upsert({
    where: { name: 'Utilities' },
    update: {},
    create: {
      name: 'Utilities',
      description: 'Utility bills and subscriptions',
      isActive: true,
    },
  })

  const maintenance = await prisma.expenseCategory.upsert({
    where: { name: 'Maintenance' },
    update: {},
    create: {
      name: 'Maintenance',
      description: 'Maintenance and repair expenses',
      isActive: true,
    },
  })

  // Top-level categories with no parent
  const topLevelCategories = [
    { name: 'Office Supplies', description: 'Office and administrative supplies' },
    { name: 'Transport', description: 'Transportation and logistics expenses' },
    { name: 'Marketing & Outreach', description: 'Marketing and community outreach expenses' },
  ]

  for (const cat of topLevelCategories) {
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name, description: cat.description, isActive: true },
    })
  }

  // Children of Salaries
  const salaryChildren = [
    { name: 'Teaching Staff Salaries', description: 'Salaries for teaching staff', parentId: salaries.id },
    { name: 'Support Staff Salaries', description: 'Salaries for support and administrative staff', parentId: salaries.id },
  ]

  for (const cat of salaryChildren) {
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: { parentId: cat.parentId },
      create: { name: cat.name, description: cat.description, parentId: cat.parentId, isActive: true },
    })
  }

  // Children of Utilities
  const utilityChildren = [
    { name: 'Electricity', description: 'Electricity bills', parentId: utilities.id },
    { name: 'Water', description: 'Water bills', parentId: utilities.id },
    { name: 'Internet', description: 'Internet and connectivity bills', parentId: utilities.id },
  ]

  for (const cat of utilityChildren) {
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: { parentId: cat.parentId },
      create: { name: cat.name, description: cat.description, parentId: cat.parentId, isActive: true },
    })
  }

  // Children of Maintenance
  const maintenanceChildren = [
    { name: 'Building Repairs', description: 'Repairs and renovation of school buildings', parentId: maintenance.id },
    { name: 'Equipment Maintenance', description: 'Maintenance of school equipment and machinery', parentId: maintenance.id },
  ]

  for (const cat of maintenanceChildren) {
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: { parentId: cat.parentId },
      create: { name: cat.name, description: cat.description, parentId: cat.parentId, isActive: true },
    })
  }

  console.log('Expense categories seeded.')

  // ── Users ───────────────────────────────────────────────────────────────────

  const users = [
    {
      email: 'admin@school.edu',
      name: 'System Administrator',
      password: 'Admin@1234',
      role: 'SUPER_ADMIN' as const,
    },
    {
      email: 'finance@school.edu',
      name: 'Finance Manager',
      password: 'Finance@1234',
      role: 'FINANCE_MANAGER' as const,
    },
    {
      email: 'cashier@school.edu',
      name: 'Front Desk Cashier',
      password: 'Cashier@1234',
      role: 'CASHIER' as const,
    },
    {
      email: 'principal@school.edu',
      name: 'School Principal',
      password: 'Principal@1234',
      role: 'PRINCIPAL' as const,
    },
    {
      email: 'auditor@school.edu',
      name: 'Internal Auditor',
      password: 'Auditor@1234',
      role: 'AUDITOR' as const,
    },
  ]

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 12)
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        role: user.role,
        isActive: true,
      },
    })
    console.log(`  User seeded: ${user.email} (${user.role})`)
  }

  console.log('Users seeded.')
  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
