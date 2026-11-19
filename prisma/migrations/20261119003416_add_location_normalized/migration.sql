-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "locationNormalized" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Space_locationNormalized_idx" ON "Space"("locationNormalized");
