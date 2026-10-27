-- CreateEnum
CREATE TYPE "ProviderCapability" AS ENUM ('AI', 'VOICE');

-- CreateTable
CREATE TABLE "workspace_provider_keys" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "capability" "ProviderCapability" NOT NULL,
    "provider" TEXT NOT NULL,
    "key_enc" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspace_provider_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_provider_keys_workspace_id_capability_key" ON "workspace_provider_keys"("workspace_id", "capability");

-- AddForeignKey
ALTER TABLE "workspace_provider_keys" ADD CONSTRAINT "workspace_provider_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

