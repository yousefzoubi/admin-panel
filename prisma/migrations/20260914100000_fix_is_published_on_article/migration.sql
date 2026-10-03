-- Correct the previously applied migration without rewriting migration history.
-- isPublished belongs to Article, not AuditLog.
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "isPublished";
