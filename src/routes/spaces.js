
const router = require("express").Router();
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { auth, allow } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { parseDate, validRange } = require("../utils/dates");
const { normalizeLocation } = require("../utils/normalize");
const { uploadImage } = require("../lib/cloudinary");

const spaceSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  location: z.string().trim().min(2).max(180),
  pricePerNight: z.coerce.number().positive().max(1000000),
  wifi: z.coerce.boolean().optional().default(false),
  meetingRoom: z.coerce.boolean().optional().default(false),
  entirePlace: z.coerce.boolean().optional().default(false)
});

// Obtém a URL da foto no Cloudinary ou no armazenamento local.
async function getPhotoUrl(file) {
  if (file.buffer) {
    const result = await uploadImage(file.buffer);
    return result.secure_url;
  }

  return `/uploads/${file.filename}`;
}

// Listar espaços com filtros
router.get("/", async (req, res, next) => {
  try {
    const {
      location,
      wifi,
      meetingRoom,
      entirePlace,
      startDate,
      endDate,
      minPrice,
      maxPrice
    } = req.query;

    const where = {
      ...(location
        ? { locationNormalized: { contains: normalizeLocation(location) } }
        : {}),
      ...(wifi === "true" ? { wifi: true } : {}),
      ...(meetingRoom === "true" ? { meetingRoom: true } : {}),
      ...(entirePlace === "true" ? { entirePlace: true } : {}),
      ...(minPrice || maxPrice
        ? {
            pricePerNight: {
              ...(minPrice ? { gte: Number(minPrice) } : {}),
              ...(maxPrice ? { lte: Number(maxPrice) } : {})
            }
          }
        : {})
    };

    if (startDate || endDate) {
      const start = parseDate(String(startDate || ""));
      const end = parseDate(String(endDate || ""));

      if (!validRange(start, end)) {
        return res.status(400).json({
          error: "Informe datas válidas; a saída deve ser posterior à entrada."
        });
      }

      where.AND = [
        {
          bookings: {
            none: {
              status: "CONFIRMED",
              startDate: { lt: end },
              endDate: { gt: start }
            }
          }
        },
        {
          blocks: {
            none: {
              startDate: { lt: end },
              endDate: { gt: start }
            }
          }
        }
      ];
    }

    const spaces = await prisma.space.findMany({
      where,
      include: {
        photos: true,
        host: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(spaces);
  } catch (err) {
    next(err);
  }
});

// Listar espaços do anfitrião
router.get("/mine", auth, allow("HOST"), async (req, res, next) => {
  try {
    const spaces = await prisma.space.findMany({
      where: { hostId: req.user.id },
      include: { photos: true, bookings: true, blocks: true },
      orderBy: { createdAt: "desc" }
    });

    res.json(spaces);
  } catch (err) {
    next(err);
  }
});

// Buscar espaço por ID
router.get("/:id", async (req, res, next) => {
  try {
    const space = await prisma.space.findUnique({
      where: { id: req.params.id },
      include: {
        photos: true,
        host: { select: { id: true, name: true } }
      }
    });

    if (!space) {
      return res.status(404).json({ error: "Espaço não encontrado." });
    }

    res.json(space);
  } catch (err) {
    next(err);
  }
});

// Cadastrar espaço
router.post(
  "/",
  auth,
  allow("HOST"),
  upload.array("photos", 8),
  async (req, res, next) => {
    try {
      const data = spaceSchema.parse(req.body);

      if (!req.files?.length) {
        return res.status(400).json({
          error: "Envie pelo menos uma foto do espaço."
        });
      }

      const photoUrls = await Promise.all(
        req.files.map(file => getPhotoUrl(file))
      );

      const space = await prisma.space.create({
        data: {
          ...data,
          locationNormalized: normalizeLocation(data.location),
          hostId: req.user.id,
          photos: {
            create: photoUrls.map(url => ({ url }))
          }
        },
        include: { photos: true }
      });

      res.status(201).json(space);
    } catch (err) {
      next(err);
    }
  }
);

// Editar espaço
router.put(
  "/:id",
  auth,
  allow("HOST"),
  upload.array("photos", 8),
  async (req, res, next) => {
    try {
      const existing = await prisma.space.findUnique({
        where: { id: req.params.id }
      });

      if (!existing) {
        return res.status(404).json({
          error: "Espaço não encontrado."
        });
      }

      if (existing.hostId !== req.user.id) {
        return res.status(403).json({
          error: "Você só pode editar seus próprios anúncios."
        });
      }

      const data = spaceSchema.partial().parse(req.body);

      const photoUrls = req.files?.length
        ? await Promise.all(req.files.map(file => getPhotoUrl(file)))
        : [];

      const space = await prisma.space.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(data.location
            ? {
                locationNormalized: normalizeLocation(data.location)
              }
            : {}),
          ...(photoUrls.length
            ? {
                photos: {
                  create: photoUrls.map(url => ({ url }))
                }
              }
            : {})
        },
        include: { photos: true }
      });

      res.json(space);
    } catch (err) {
      next(err);
    }
  }
);

// Excluir espaço
router.delete("/:id", auth, allow("HOST"), async (req, res, next) => {
  try {
    const existing = await prisma.space.findUnique({
      where: { id: req.params.id }
    });

    if (!existing) {
      return res.status(404).json({
        error: "Espaço não encontrado."
      });
    }

    if (existing.hostId !== req.user.id) {
      return res.status(403).json({
        error: "Você só pode excluir seus próprios anúncios."
      });
    }

    await prisma.space.delete({
      where: { id: existing.id }
    });

    res.json({ message: "Anúncio excluído." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

module.exports = router;
