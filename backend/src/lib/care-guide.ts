// ======================================================
// Guía de cuidados del paciente (lib/care-guide.ts)
// Arma las indicaciones que ve el paciente en la app:
//   - Indicaciones PREOPERATORIAS generales (mismas que el
//     email "indicaciones_preoperatorias").
//   - Indicaciones POSTOPERATORIAS y cuidados en casa.
//   - Signos de alarma (cuándo ir a la guardia).
//   - Datos PERSONALIZADOS: próxima cirugía y las últimas
//     indicaciones (medicación/observaciones) que cargó su
//     equipo médico en los controles postoperatorios.
// ======================================================
import { prisma } from "./prisma.js";

export const PREOP_INSTRUCTIONS = [
  "Ayuno de 8 horas previas a la cirugía (sin comida ni bebida, incluida el agua).",
  "Traer DNI, orden médica y los estudios prequirúrgicos.",
  "Firmar el consentimiento informado antes de ingresar.",
  "Suspender la medicación que te indicó tu médico (por ejemplo, anticoagulantes).",
  "Bañarte la noche anterior o la mañana de la cirugía; no usar maquillaje, cremas ni esmalte.",
  "No llevar joyas, relojes ni objetos de valor.",
  "Concurrir con un acompañante mayor de edad.",
  "Presentarte 1 hora antes del horario programado.",
];

export const POSTOP_INSTRUCTIONS = [
  "Cumplir la medicación exactamente como fue indicada, en dosis y horarios.",
  "Hacer reposo relativo las primeras 48 horas.",
  "No manejar ni operar maquinaria durante las primeras 24 horas.",
  "Asistir a todos los controles postoperatorios programados.",
  "Registrar tus síntomas todos los días desde la pestaña \"Síntomas\".",
];

export const HOME_CARE = [
  "Mantener la zona operada limpia y seca; lavarte las manos antes de tocarla.",
  "No hacer esfuerzos físicos ni levantar peso hasta que tu médico lo autorice.",
  "Hidratarte bien y llevar una alimentación liviana los primeros días.",
  "No frotar ni rascar la zona operada.",
  "Evitar ambientes con polvo, humo o piletas hasta el alta.",
];

export const WARNING_SIGNS = [
  "Fiebre de 38 °C o más.",
  "Dolor intenso que no cede con la medicación indicada.",
  "Sangrado abundante o secreción con mal olor en la herida.",
  "Pérdida brusca de la visión, falta de aire o dolor en el pecho.",
];

export const EMERGENCY_NOTE =
  "Ante cualquiera de estos signos NO esperes la respuesta de recepción: acudí a la guardia o llamá al 107.";

/** Guía completa del paciente (general + personalizada). */
export async function buildCareGuide(patientId: string) {
  const [nextSurgery, latestPostop] = await Promise.all([
    // Sin filtro de fecha: mientras siga "programada" (aunque se haya
    // demorado) las indicaciones preoperatorias siguen vigentes.
    prisma.surgery.findFirst({
      where: { patientId, status: "programada" },
      orderBy: { scheduledAt: "asc" },
      select: { id: true, procedure: true, scheduledAt: true, surgeonName: true },
    }),
    prisma.postopRecord.findFirst({
      where: { surgery: { patientId } },
      orderBy: { createdAt: "desc" },
      select: {
        medication: true,
        observations: true,
        createdAt: true,
        surgery: { select: { procedure: true } },
      },
    }),
  ]);

  return {
    preop: PREOP_INSTRUCTIONS,
    postop: POSTOP_INSTRUCTIONS,
    homeCare: HOME_CARE,
    warningSigns: WARNING_SIGNS,
    emergencyNote: EMERGENCY_NOTE,
    nextSurgery,
    latestIndications: latestPostop,
  };
}
