-- CreateEnum
CREATE TYPE "InquiryUrgency" AS ENUM ('normal', 'urgente');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('pendiente', 'respondida');

-- CreateTable
CREATE TABLE "PatientInquiry" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "surgeryId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "urgency" "InquiryUrgency" NOT NULL DEFAULT 'normal',
    "status" "InquiryStatus" NOT NULL DEFAULT 'pendiente',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "reply" TEXT,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientInquiry_patientId_createdAt_idx" ON "PatientInquiry"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "PatientInquiry_status_dueAt_idx" ON "PatientInquiry"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "PatientInquiry" ADD CONSTRAINT "PatientInquiry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInquiry" ADD CONSTRAINT "PatientInquiry_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInquiry" ADD CONSTRAINT "PatientInquiry_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
