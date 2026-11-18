const router = require("express").Router();
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { auth, allow } = require("../middleware/auth");
const { parseDate, validRange } = require("../utils/dates");

router.post("/", auth, allow("GUEST"), async (req, res, next) => {
  try {
    const body = z.object({
      spaceId: z.string().min(1),
      startDate: z.string(),
      endDate: z.string()
    }).parse(req.body);
    const start = parseDate(body.startDate);
    const end = parseDate(body.endDate);
    if (!validRange(start, end)) return res.status(400).json({ error: "Período inválido. A saída deve ser posterior à entrada." });
    if (start < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z")) {
      return res.status(400).json({ error: "Não é possível reservar datas passadas." });
    }

    // Serializa operações por espaço no PostgreSQL: duas requisições concorrentes
    // para o mesmo espaço aguardam uma à outra antes de verificar o intervalo.
    const booking = await prisma.$transaction(async tx => {
      await tx.$queryRaw`
  WITH lock AS MATERIALIZED (
    SELECT pg_advisory_xact_lock(hashtext(${body.spaceId}))
  )
  SELECT 1::int AS locked FROM lock`;
      const space = await tx.space.findUnique({ where: { id: body.spaceId } });
      if (!space) throw Object.assign(new Error("Espaço não encontrado."), { status: 404 });

      const [overlap, blocked] = await Promise.all([
        tx.booking.findFirst({
          where: { spaceId: body.spaceId, status: "CONFIRMED", startDate: { lt: end }, endDate: { gt: start } }
        }),
        tx.availabilityBlock.findFirst({
          where: { spaceId: body.spaceId, startDate: { lt: end }, endDate: { gt: start } }
        })
      ]);
      if (overlap || blocked) throw Object.assign(new Error("Este espaço não está disponível nesse período."), { status: 409 });

      const nights = Math.round((end - start) / 86400000);
      return tx.booking.create({
        data: {
          spaceId: body.spaceId, guestId: req.user.id, startDate: start, endDate: end,
          total: Number(space.pricePerNight) * nights
        },
        include: { space: { include: { photos: true } } }
      });
    }, { isolationLevel: "Serializable" });
    res.status(201).json(booking);
  } catch (err) { next(err); }
});

router.get("/mine", auth, allow("GUEST"), async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { guestId: req.user.id },
      include: { space: { include: { photos: true } } },
      orderBy: { startDate: "desc" }
    });
    res.json(bookings);
  } catch (err) { next(err); }
});

router.get("/host", auth, allow("HOST"), async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { space: { hostId: req.user.id } },
      include: { guest: { select: { id: true, name: true, email: true } }, space: true },
      orderBy: { startDate: "asc" }
    });
    res.json(bookings);
  } catch (err) { next(err); }
});

router.patch("/:id/cancel", auth, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { space: true } });
    if (!booking) return res.status(404).json({ error: "Reserva não encontrada." });
    const allowed = booking.guestId === req.user.id || booking.space.hostId === req.user.id;
    if (!allowed) return res.status(403).json({ error: "Sem permissão para cancelar esta reserva." });
    if (booking.status === "CANCELLED") return res.status(400).json({ error: "Esta reserva já foi cancelada." });
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
