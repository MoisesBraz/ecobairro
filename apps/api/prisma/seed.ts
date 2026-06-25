import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Require env to populate variables if missing (using the project's config logic if available)
// But to keep it simple, let's just read process.env.DATABASE_URL
import { config } from 'dotenv'
config({ path: '../../.env' })

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || 'postgresql://ecobairro:ecobairro@localhost:5433/ecobairro?schema=public',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding Ecopontos em Aveiro...')
  
  // Clean existing
  await prisma.contentor.deleteMany()
  await prisma.ecoponto.deleteMany()
  
  const ecopontos = [
    {
      nome: 'Ecoponto Rossio',
      codigo: 'EP-001',
      morada: 'Rua Domingos Carrancho, Aveiro',
      codigoPostal: '3800-145',
      zona: 'Centro',
      lat: 40.6420,
      lng: -8.6540,
      distanciaLabel: '',
      contentores: {
        create: [
          { tipo: 'Papel', ocupacao: 45, sensorEstado: 'online' },
          { tipo: 'Plastico', ocupacao: 60, sensorEstado: 'online' },
          { tipo: 'Vidro', ocupacao: 20, sensorEstado: 'online' },
        ]
      }
    },
    {
      nome: 'Ecoponto Mercado',
      codigo: 'EP-002',
      morada: 'Praça do Mercado, Aveiro',
      codigoPostal: '3800-225',
      zona: 'Centro',
      lat: 40.6406,
      lng: -8.6534,
      distanciaLabel: '',
      contentores: {
        create: [
          { tipo: 'Papel', ocupacao: 75, sensorEstado: 'online' },
          { tipo: 'Plastico', ocupacao: 85, sensorEstado: 'online' },
          { tipo: 'Vidro', ocupacao: 40, sensorEstado: 'online' },
          { tipo: 'Organico', ocupacao: 30, sensorEstado: 'online' },
        ]
      }
    },
    {
      nome: 'Ecoponto Universidade',
      codigo: 'EP-003',
      morada: 'Campus Universitário de Santiago, Aveiro',
      codigoPostal: '3810-193',
      zona: 'Universidade',
      lat: 40.6300,
      lng: -8.6575,
      distanciaLabel: '',
      contentores: {
        create: [
          { tipo: 'Papel', ocupacao: 95, sensorEstado: 'online' },
          { tipo: 'Plastico', ocupacao: 65, sensorEstado: 'online' },
          { tipo: 'Vidro', ocupacao: 20, sensorEstado: 'online' },
          { tipo: 'Organico', ocupacao: 45, sensorEstado: 'online' },
        ]
      }
    },
    {
      nome: 'Ecoponto Glória',
      codigo: 'EP-004',
      morada: 'Rua de São Martinho, Aveiro',
      codigoPostal: '3810-184',
      zona: 'Glória',
      lat: 40.6350,
      lng: -8.6500,
      distanciaLabel: '',
      contentores: {
        create: [
          { tipo: 'Plastico', ocupacao: 30, sensorEstado: 'online' },
          { tipo: 'Vidro', ocupacao: 10, sensorEstado: 'online' },
          { tipo: 'Indiferenciado', ocupacao: 80, sensorEstado: 'online' },
        ]
      }
    },
    {
      nome: 'Ecoponto Beira-Mar',
      codigo: 'EP-005',
      morada: 'Rua do Sal, Aveiro',
      codigoPostal: '3800-258',
      zona: 'Beira Mar',
      lat: 40.6441,
      lng: -8.6565,
      distanciaLabel: '',
      contentores: {
        create: [
          { tipo: 'Papel', ocupacao: 100, sensorEstado: 'alerta' },
          { tipo: 'Plastico', ocupacao: 100, sensorEstado: 'alerta' },
          { tipo: 'Vidro', ocupacao: 80, sensorEstado: 'online' },
          { tipo: 'Organico', ocupacao: 95, sensorEstado: 'alerta' },
        ]
      }
    },
    {
      nome: 'Ecoponto Vera Cruz',
      codigo: 'EP-006',
      morada: 'Rua Direita, Aveiro',
      codigoPostal: '3800-150',
      zona: 'Vera Cruz',
      lat: 40.6445,
      lng: -8.6520,
      distanciaLabel: '',
      contentores: {
        create: [
          { tipo: 'Papel', ocupacao: 25, sensorEstado: 'online' },
          { tipo: 'Plastico', ocupacao: 40, sensorEstado: 'online' },
          { tipo: 'Indiferenciado', ocupacao: 65, sensorEstado: 'online' },
        ]
      }
    },
    {
      nome: 'Ecoponto São Bernardo',
      codigo: 'EP-007',
      morada: 'Avenida de São Bernardo, Aveiro',
      codigoPostal: '3810-001',
      zona: 'São Bernardo',
      lat: 40.6250,
      lng: -8.6350,
      distanciaLabel: '',
      contentores: {
        create: [
          { tipo: 'Papel', ocupacao: 50, sensorEstado: 'online' },
          { tipo: 'Vidro', ocupacao: 15, sensorEstado: 'offline' },
          { tipo: 'Indiferenciado', ocupacao: 35, sensorEstado: 'online' },
        ]
      }
    },
    {
      nome: 'Ecoponto Aradas',
      codigo: 'EP-008',
      morada: 'Rua de Aradas, Aveiro',
      codigoPostal: '3810-500',
      zona: 'Aradas',
      lat: 40.6200,
      lng: -8.6450,
      distanciaLabel: '',
      contentores: {
        create: [
          { tipo: 'Plastico', ocupacao: 85, sensorEstado: 'online' },
          { tipo: 'Organico', ocupacao: 60, sensorEstado: 'online' },
        ]
      }
    },
    {
      nome: 'Ecoponto Esgueira',
      codigo: 'EP-009',
      morada: 'Rua de Esgueira, Aveiro',
      codigoPostal: '3800-100',
      zona: 'Esgueira',
      lat: 40.6450,
      lng: -8.6300,
      distanciaLabel: '',
      contentores: {
        create: [
          { tipo: 'Papel', ocupacao: 10, sensorEstado: 'online' },
          { tipo: 'Plastico', ocupacao: 20, sensorEstado: 'online' },
          { tipo: 'Vidro', ocupacao: 5, sensorEstado: 'online' },
          { tipo: 'Indiferenciado', ocupacao: 15, sensorEstado: 'online' },
        ]
      }
    }
  ]
  
  for (const ep of ecopontos) {
    const res = await prisma.ecoponto.create({
      data: ep
    })
    console.log(`Created ${res.nome}`)
  }
  
  console.log('Seed completo!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
