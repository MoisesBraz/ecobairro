const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const rows = await prisma.cidadaoEcopontoFavorito.findMany({
      include: { ecoponto: { include: { contentores: true } } }
    });
    console.log(JSON.stringify(rows, null, 2));
  } catch(e) {
    console.error("ERROR", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
