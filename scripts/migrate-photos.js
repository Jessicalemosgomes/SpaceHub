
require("dotenv").config();

process.env.DATABASE_URL = process.env.DIRECT_URL;

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { uploadImage } = require("../src/lib/cloudinary");

const prisma = new PrismaClient();

async function migratePhotos() {
  try {
    const photos = await prisma.photo.findMany({
      where: {
        url: {
          startsWith: "/uploads/"
        }
      },
      include: {
        space: {
          select: {
            title: true
          }
        }
      }
    });

    console.log(`Fotos encontradas: ${photos.length}`);

    for (const photo of photos) {
      const filename = path.basename(photo.url);
      const filePath = path.join(
        __dirname,
        "../backups/uploads",
        filename
      );

      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filename}`);
      }

      const buffer = fs.readFileSync(filePath);

      console.log(`Enviando foto: ${filename}`);

      const result = await uploadImage(buffer, "spacehub");

      await prisma.photo.update({
        where: { id: photo.id },
        data: { url: result.secure_url }
      });

      console.log(`Atualizada: ${photo.space.title}`);
      console.log(result.secure_url);
    }

    console.log("Migração das fotos concluída!");
  } catch (error) {
    console.error("Erro na migração:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

migratePhotos();
