-- AlterTable
ALTER TABLE "SurgeryChecklistItem" ADD COLUMN     "patientChecked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "patientCheckedAt" TIMESTAMP(3);
