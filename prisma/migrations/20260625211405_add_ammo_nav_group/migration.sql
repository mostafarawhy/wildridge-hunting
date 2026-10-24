-- AlterEnum
ALTER TYPE "NavGroup" ADD VALUE 'AMMO';

UPDATE "Category" SET "navGroup" = 'AMMO' WHERE "slug" = 'pellets-ammo';
