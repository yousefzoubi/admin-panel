-- Nullable keeps existing conversation rows valid while all new conversations
-- use a deterministic, unique participant-pair key.
ALTER TABLE "Conversation" ADD COLUMN "conversationKey" TEXT;

CREATE UNIQUE INDEX "Conversation_conversationKey_key"
ON "Conversation"("conversationKey");
