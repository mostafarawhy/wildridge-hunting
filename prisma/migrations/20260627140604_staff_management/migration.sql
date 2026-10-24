-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'STAFF_ADMIN';

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
