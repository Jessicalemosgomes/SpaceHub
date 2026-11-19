
const router = require("express").Router();
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { auth, allow } = require("../middleware/auth");
const { parseDate, validRange } = require("../utils/dates");

// Consultar reservas e bloqueios de um espaço
router.get("/:spaceId", async (req, res, next) => {
  try {
    const space = await prisma.space.findUnique({
      where: { id: req.params.spaceId },
      select: { id: true }
    });

    if (!space) {
      return res.status(404).json({ error: "Espaço não encontrado." });
    }

    const [bookings, blocks] = await Promise.all([
      prisma.booking.findMany({
        where: { spaceId: space.id, status: "CONFIRMED" },
        select: { startDate: true, endDate: true }
      }),
      prisma.availabilityBlock.findMany({
        where: { spaceId: space.id },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          reason: true
        }
      })
    ]);

    res.json({ bookings, blocks });
  } catch (err) {
    next(err);
  }
});

// Bloquear datas de um espaço
router.post("/:spaceId/blocks", auth, allow("HOST"), async (req, res, next) => {
  try {
    const body = z.object({
      startDate: z.string(),
      endDate: z.string(),
      reason: z.string().max(180).optional()
    }).parse(req.body);

    const start = parseDate(body.startDate);
    const end = parseDate(body.endDate);

    if (!validRange(start, end)) {
      return res.status(400).json({ error: "Período inválido." });
    }

    const space = await prisma.space.findUnique({
      where: { id: req.params.spaceId }
    });

    if (!space) {
      return res.status(404).json({ error: "Espaço não encontrado." });
    }

    if (space.hostId !== req.user.id) {
      return res.status(403).json({
        error: "Você não é proprietário deste espaço."
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        WITH lock AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(hashtext(${space.id}))
        )
        SELECT 1::int AS locked FROM lock
      `;

      const [conflict, existingBlock] = await Promise.all([
        tx.booking.findFirst({
          where: {
            spaceId: space.id,
            status: "CONFIRMED",
            startDate: { lt: end },
            endDate: { gt: start }
          }
        }),
        tx.availabilityBlock.findFirst({
          where: {
            spaceId: space.id,
            startDate: { lt: end },
            endDate: { gt: start }
          }
        })
      ]);

      if (conflict) {
        throw Object.assign(
          new Error("Já existe uma reserva nesse período."),
          { status: 409 }
        );
      }

      if (existingBlock) {
        throw Object.assign(
          new Error("Já existe um bloqueio nesse período."),
          { status: 409 }
        );
      }

      return tx.availabilityBlock.create({
        data: {
          spaceId: space.id,
          startDate: start,
          endDate: end,
          reason: body.reason
        }
      });
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// Remover um bloqueio
router.delete("/blocks/:blockId", auth, allow("HOST"), async (req, res, next) => {
  try {
    const block = await prisma.availabilityBlock.findUnique({
      where: { id: req.params.blockId },
      include: { space: true }
    });

    if (!block) {
      return res.status(404).json({ error: "Bloqueio não encontrado." });
    }

    if (block.space.hostId !== req.user.id) {
      return res.status(403).json({ error: "Sem permissão." });
    }

    await prisma.availabilityBlock.delete({
      where: { id: block.id }
    });

    res.json({ message: "Bloqueio removido." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
