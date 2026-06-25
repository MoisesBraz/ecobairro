import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'

config({ path: '../../.env' })

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || 'postgresql://ecobairro:ecobairro@localhost:5433/ecobairro?schema=public',
})
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    const res = await prisma.$queryRaw`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'ecopontos';`
    console.log(JSON.stringify(res, null, 2))
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}
main()
