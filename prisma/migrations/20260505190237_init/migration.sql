-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ollama', 'openai', 'anthropic', 'custom');

-- CreateEnum
CREATE TYPE "FileStorage" AS ENUM ('local', 's3', 'gcs', 'azure');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('uploaded', 'processing', 'complete', 'error');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system', 'tool');

-- CreateEnum
CREATE TYPE "PromptPresetKind" AS ENUM ('default', 'manager', 'business', 'tech', 'analyst');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GUEST',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT NOT NULL DEFAULT '',
    "banned" TIMESTAMP(3),
    "tosAccepted" BOOLEAN NOT NULL DEFAULT false,
    "theme" JSONB NOT NULL DEFAULT '{"fontColor":"#2065D1","backgroundMode":"white","fontSize":3}',
    "geoData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID,
    "provider" "AiProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "baseUrl" TEXT,
    "models" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "storage" "FileStorage" NOT NULL DEFAULT 'local',
    "path" TEXT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'uploaded',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_chats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "creatorId" UUID NOT NULL,
    "apiKeyRef" UUID NOT NULL,
    "selectedModel" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "domainContext" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chatId" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "fileIds" UUID[] DEFAULT ARRAY[]::UUID[],
    "domainContext" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "agentPlan" JSONB,
    "toolCalls" JSONB NOT NULL DEFAULT '[]',
    "toolResults" JSONB NOT NULL DEFAULT '[]',
    "usage" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_presets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promptPreset" "PromptPresetKind" NOT NULL DEFAULT 'default',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_name_key" ON "users"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_tokens_token_key" ON "user_tokens"("token");

-- CreateIndex
CREATE INDEX "user_tokens_userId_idx" ON "user_tokens"("userId");

-- CreateIndex
CREATE INDEX "api_keys_ownerId_idx" ON "api_keys"("ownerId");

-- CreateIndex
CREATE INDEX "files_ownerId_idx" ON "files"("ownerId");

-- CreateIndex
CREATE INDEX "files_chatId_idx" ON "files"("chatId");

-- CreateIndex
CREATE INDEX "files_storage_idx" ON "files"("storage");

-- CreateIndex
CREATE INDEX "analysis_chats_creatorId_idx" ON "analysis_chats"("creatorId");

-- CreateIndex
CREATE INDEX "analysis_messages_chatId_idx" ON "analysis_messages"("chatId");

-- CreateIndex
CREATE INDEX "analysis_messages_role_idx" ON "analysis_messages"("role");

-- CreateIndex
CREATE INDEX "analysis_messages_chatId_createdAt_idx" ON "analysis_messages"("chatId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "analysis_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_chats" ADD CONSTRAINT "analysis_chats_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_chats" ADD CONSTRAINT "analysis_chats_apiKeyRef_fkey" FOREIGN KEY ("apiKeyRef") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_messages" ADD CONSTRAINT "analysis_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "analysis_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
