-- CreateTable
CREATE TABLE "ProxmoxCluster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "tokenSecret" TEXT NOT NULL,
    "verifySsl" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultStorage" TEXT,
    "defaultBridge" TEXT,
    "isoStorage" TEXT,
    "backupStorage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "ProxmoxCluster_host_tokenId_key" ON "ProxmoxCluster"("host", "tokenId");
CREATE INDEX "ProxmoxCluster_isDefault_idx" ON "ProxmoxCluster"("isDefault");
CREATE INDEX "ProxmoxCluster_enabled_idx" ON "ProxmoxCluster"("enabled");

-- Placeholder cluster for existing rows; app migrates credentials from SystemConfig on boot.
INSERT INTO "ProxmoxCluster" (
    "id", "name", "host", "tokenId", "tokenSecret", "verifySsl", "isDefault", "enabled", "updatedAt"
) VALUES (
    'legacy-default', 'Default cluster', 'https://localhost:8006', 'unset@pam!unset', '', 0, 1, 1, CURRENT_TIMESTAMP
);

ALTER TABLE "VirtualMachine" ADD COLUMN "clusterId" TEXT NOT NULL DEFAULT 'legacy-default';
ALTER TABLE "Template" ADD COLUMN "clusterId" TEXT NOT NULL DEFAULT 'legacy-default';

CREATE INDEX "VirtualMachine_clusterId_idx" ON "VirtualMachine"("clusterId");
CREATE UNIQUE INDEX "VirtualMachine_clusterId_proxmoxVmId_key" ON "VirtualMachine"("clusterId", "proxmoxVmId");
CREATE INDEX "Template_clusterId_idx" ON "Template"("clusterId");
CREATE UNIQUE INDEX "Template_clusterId_proxmoxVmId_key" ON "Template"("clusterId", "proxmoxVmId");

-- Drop old global VMID uniqueness on Template (SQLite: recreate index)
DROP INDEX IF EXISTS "Template_proxmoxVmId_key";
