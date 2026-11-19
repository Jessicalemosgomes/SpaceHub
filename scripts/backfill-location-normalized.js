
const prisma = require("../src/lib/prisma");
const { normalizeLocation } = require("../src/utils/normalize");

async function main() {
  const spaces = await prisma.space.findMany({
    select: {
      id: true,
      location: true
    }
  });

  for (const space of spaces) {
    await prisma.space.update({
      where: { id: space.id },
      data: {
        locationNormalized: normalizeLocation(space.location)
      }
    });
  }

  console.log(`${spaces.length} anúncio(s) atualizado(s) com sucesso!`);
}

main()
  .catch(error => {
    console.error("Erro ao atualizar localizações:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });