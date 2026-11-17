// ======================================================
// Consultas del paciente a recepción (montadas en /api)
// El paciente escribe desde la app (POST /api/me/inquiries,
// en routes/me.ts) eligiendo la urgencia, que define el
// plazo de respuesta:
//   urgente → 24 h · normal → 48 h
// La recepción las atiende desde el panel:
//   GET  /inquiries               → bandeja (filtro ?status=)
//   POST /inquiries/:id/reply     → responder (email + push)
// ======================================================
import { Router } from "express";
import { z } from "zod";
import type { InquiryUrgency } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { emit } from "../lib/realtime.js";
import { sendInquiryReply } from "../lib/email.js";
import { notifyInquiryReply } from "../lib/notifications.js";

const router = Router();

/** Horas de plazo de respuesta según la urgencia. */
export const RESPONSE_HOURS: Record<InquiryUrgency, number> = {
  urgente: 24,
  normal: 48,
};

/** Vencimiento del plazo de respuesta a partir de ahora. */
export function computeDueAt(urgency: InquiryUrgency, from = new Date()): Date {
  return new Date(from.getTime() + RESPONSE_HOURS[urgency] * 60 * 60 * 1000);
}

/** Datos que envía el paciente desde la app. */
export const inquirySchema = z.object({
  subject: z.string().trim().min(3, "Escribí un asunto").max(120, "Máximo 120 caracteres"),
  body: z.string().trim().min(5, "Contanos tu consulta").max(2000, "Máximo 2000 caracteres"),
  urgency: z.enum(["normal", "urgente"]).default("normal"),
  surgeryId: z.string().uuid().nullish(),
});

const replySchema = z.object({
  reply: z.string().trim().min(1, "La respuesta está vacía").max(2000, "Máximo 2000 caracteres"),
});

/** Campos que se exponen junto a cada consulta. */
export const INQUIRY_INCLUDE = {
  surgery: { select: { id: true, procedure: true, publicCode: true, scheduledAt: true } },
  answeredBy: { select: { fullName: true } },
} as const;

/** Avisa en tiempo real al panel interno que llegó una consulta (sin datos sensibles). */
export function emitNewInquiry(id: string, urgency: InquiryUrgency) {
  emit("inquiry:new", { id, urgency });
}

router.use("/inquiries", requireAuth, requirePermission("consultas:responder"));

/**
 * Bandeja de recepción. Las pendientes se ordenan por vencimiento
 * (lo más urgente arriba); el resto, de la más reciente a la más vieja.
 */
router.get("/inquiries", async (req, res, next) => {
  try {
    const status = z.enum(["pendiente", "respondida"]).optional().parse(req.query.status);
    const list = await prisma.patientInquiry.findMany({
      where: status ? { status } : undefined,
      orderBy: status === "pendiente" ? { dueAt: "asc" } : { createdAt: "desc" },
      include: {
        ...INQUIRY_INCLUDE,
        patient: { select: { id: true, firstName: true, lastName: true, documentId: true, phone: true, email: true } },
      },
    });
    res.json(list);
  } catch (e) { next(e); }
});

/** Responde una consulta: se guarda, se envía por email y se avisa por push. */
router.post("/inquiries/:id/reply", async (req, res, next) => {
  try {
    const { reply } = replySchema.parse(req.body);
    const inquiry = await prisma.patientInquiry.findUnique({
      where: { id: req.params.id },
      include: { patient: true },
    });
    if (!inquiry) throw new HttpError(404, "Consulta no encontrada");
    if (inquiry.status === "respondida") throw new HttpError(409, "La consulta ya fue respondida");

    const saved = await prisma.patientInquiry.update({
      where: { id: inquiry.id },
      data: {
        reply,
        status: "respondida",
        answeredById: req.user!.sub,
        answeredAt: new Date(),
      },
      include: INQUIRY_INCLUDE,
    });

    void sendInquiryReply({
      patientId: inquiry.patientId,
      patientEmail: inquiry.patient.email,
      patientName: inquiry.patient.firstName,
      subject: inquiry.subject,
      reply,
    });
    void notifyInquiryReply(inquiry.patientId, inquiry.id, inquiry.subject);
    emit("inquiry:answered", { id: inquiry.id });

    res.json(saved);
  } catch (e) { next(e); }
});

export default router;
