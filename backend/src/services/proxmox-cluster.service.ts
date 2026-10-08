import type { AxiosInstance } from 'axios';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { getConfig, setConfig } from './config.service.js';
import { buildClient, getNodes, getProxmoxCa, type ProxmoxConnection } from './proxmox.service.js';

const LEGACY_CLUSTER_ID = 'legacy-default';

let legacyMigrationDone = false;

export type ProxmoxClusterPublic = {
  id: string;
  name: string;
  host: string;
  tokenId: string;
  verifySsl: boolean;
  isDefault: boolean;
  enabled: boolean;
  hasSecret: boolean;
  defaultStorage: string | null;
  defaultBridge: string | null;
  isoStorage: string | null;
  backupStorage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toPublic(row: {
  id: string;
  name: string;
  host: string;
  tokenId: string;
  tokenSecret: string;
  verifySsl: boolean;
  isDefault: boolean;
  enabled: boolean;
  defaultStorage: string | null;
  defaultBridge: string | null;
  isoStorage: string | null;
  backupStorage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProxmoxClusterPublic {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    tokenId: row.tokenId,
    verifySsl: row.verifySsl,
    isDefault: row.isDefault,
    enabled: row.enabled,
    hasSecret: !!row.tokenSecret,
    defaultStorage: row.defaultStorage,
    defaultBridge: row.defaultBridge,
    isoStorage: row.isoStorage,
    backupStorage: row.backupStorage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Copy SystemConfig proxmox_* into the default cluster row (once). */
export async function ensureLegacyClusterMigrated(): Promise<void> {
  if (legacyMigrationDone) return;
  legacyMigrationDone = true;

  const [host, tokenId, tokenSecret, verifySslStr, storage, bridge, isoStorage, backupStorage] =
    await Promise.all([
      getConfig('proxmox_host'),
      getConfig('proxmox_token_id'),
      getConfig('proxmox_token_secret'),
      getConfig('proxmox_verify_ssl'),
      getConfig('default_storage'),
      getConfig('default_bridge'),
      getConfig('iso_storage'),
      getConfig('backup_storage'),
    ]);

  const existing = await prisma.proxmoxCluster.findUnique({ where: { id: LEGACY_CLUSTER_ID } });
  if (!existing) return;

  const hasLegacyCreds = !!(host && tokenId && tokenSecret);
  if (!hasLegacyCreds && existing.tokenSecret) return;

  await prisma.proxmoxCluster.update({
    where: { id: LEGACY_CLUSTER_ID },
    data: {
      name: existing.name === 'Default cluster' && host ? 'Primary cluster' : existing.name,
      host: host?.replace(/\/+$/, '') ?? existing.host,
      tokenId: tokenId ?? existing.tokenId,
      tokenSecret: tokenSecret ? encrypt(tokenSecret) : existing.tokenSecret,
      verifySsl: verifySslStr === 'true',
      isDefault: true,
      enabled: hasLegacyCreds,
      defaultStorage: storage ?? existing.defaultStorage,
      defaultBridge: bridge ?? existing.defaultBridge,
      isoStorage: isoStorage ?? existing.isoStorage,
      backupStorage: backupStorage ?? existing.backupStorage,
    },
  });
}

export async function listClusters(includeDisabled = true): Promise<ProxmoxClusterPublic[]> {
  await ensureLegacyClusterMigrated();
  const rows = await prisma.proxmoxCluster.findMany({
    where: includeDisabled ? undefined : { enabled: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  return rows.map(toPublic);
}

export async function getClusterById(id: string) {
  await ensureLegacyClusterMigrated();
  return prisma.proxmoxCluster.findUnique({ where: { id } });
}

export async function getDefaultClusterId(): Promise<string> {
  await ensureLegacyClusterMigrated();
  const row =
    (await prisma.proxmoxCluster.findFirst({ where: { isDefault: true, enabled: true } })) ??
    (await prisma.proxmoxCluster.findFirst({ where: { enabled: true }, orderBy: { createdAt: 'asc' } }));
  if (!row) throw new Error('No Proxmox cluster is configured. Add one in Admin → Settings.');
  return row.id;
}

export async function getConnectionConfigForCluster(clusterId: string): Promise<ProxmoxConnection & { clusterId: string }> {
  await ensureLegacyClusterMigrated();
  const row = await prisma.proxmoxCluster.findUnique({ where: { id: clusterId } });
  if (!row || !row.enabled) throw new Error('Proxmox cluster not found or disabled');
  if (!row.host || !row.tokenId || !row.tokenSecret) {
    throw new Error('Proxmox cluster connection is incomplete (host, token ID, or secret missing)');
  }
  let tokenSecret: string;
  try {
    tokenSecret = decrypt(row.tokenSecret);
  } catch {
    throw new Error('Could not decrypt the cluster API token secret');
  }
  return {
    clusterId: row.id,
    host: row.host,
    tokenId: row.tokenId,
    tokenSecret,
    verifySsl: row.verifySsl,
    ca: getProxmoxCa(),
  };
}

export async function getClientForCluster(clusterId?: string): Promise<AxiosInstance> {
  const id = clusterId ?? (await getDefaultClusterId());
  const c = await getConnectionConfigForCluster(id);
  return buildClient(c.host, c.tokenId, c.tokenSecret, c.verifySsl, c.ca);
}

export async function getClusterDefaults(clusterId: string): Promise<{
  storage: string | null;
  bridge: string | null;
  isoStorage: string | null;
  backupStorage: string | null;
}> {
  const row = await getClusterById(clusterId);
  if (!row) throw new Error('Cluster not found');
  const [gStorage, gBridge, gIso, gBackup] = await Promise.all([
    getConfig('default_storage'),
    getConfig('default_bridge'),
    getConfig('iso_storage'),
    getConfig('backup_storage'),
  ]);
  return {
    storage: row.defaultStorage ?? gStorage,
    bridge: row.defaultBridge ?? gBridge,
    isoStorage: row.isoStorage ?? gIso,
    backupStorage: row.backupStorage ?? gBackup,
  };
}

export async function listClusterNodes(clusterId: string) {
  const client = await getClientForCluster(clusterId);
  const nodes = await getNodes(client);
  return nodes.map((n) => ({
    name: n.node,
    status: n.status,
    cpu: n.cpu,
    maxcpu: n.maxcpu,
    mem: n.mem,
    maxmem: n.maxmem,
  }));
}

export async function upsertDefaultClusterFromConfig(data: {
  host: string;
  tokenId: string;
  tokenSecret?: string;
  verifySsl: boolean;
  name?: string;
}): Promise<void> {
  const host = data.host.trim().replace(/\/+$/, '');
  await ensureLegacyClusterMigrated();

  const defaults = await Promise.all([
    getConfig('default_storage'),
    getConfig('default_bridge'),
    getConfig('iso_storage'),
    getConfig('backup_storage'),
  ]);

  const existing =
    (await prisma.proxmoxCluster.findFirst({ where: { isDefault: true } })) ??
    (await prisma.proxmoxCluster.findUnique({ where: { id: LEGACY_CLUSTER_ID } }));

  const secret =
    data.tokenSecret && data.tokenSecret.trim().length > 0
      ? encrypt(data.tokenSecret)
      : existing?.tokenSecret ?? '';

  if (existing) {
    await prisma.proxmoxCluster.update({
      where: { id: existing.id },
      data: {
        name: data.name ?? existing.name,
        host,
        tokenId: data.tokenId,
        tokenSecret: secret,
        verifySsl: data.verifySsl,
        isDefault: true,
        enabled: true,
        defaultStorage: defaults[0],
        defaultBridge: defaults[1],
        isoStorage: defaults[2],
        backupStorage: defaults[3],
      },
    });
    return;
  }

  await prisma.proxmoxCluster.create({
    data: {
      name: data.name ?? 'Primary cluster',
      host,
      tokenId: data.tokenId,
      tokenSecret: secret,
      verifySsl: data.verifySsl,
      isDefault: true,
      enabled: true,
      defaultStorage: defaults[0],
      defaultBridge: defaults[1],
      isoStorage: defaults[2],
      backupStorage: defaults[3],
    },
  });
}

export async function createCluster(input: {
  name: string;
  host: string;
  tokenId: string;
  tokenSecret: string;
  verifySsl: boolean;
  isDefault?: boolean;
  defaultStorage?: string;
  defaultBridge?: string;
  isoStorage?: string;
  backupStorage?: string;
}) {
  await ensureLegacyClusterMigrated();
  const host = input.host.trim().replace(/\/+$/, '');
  if (input.isDefault) {
    await prisma.proxmoxCluster.updateMany({ data: { isDefault: false } });
  }
  const row = await prisma.proxmoxCluster.create({
    data: {
      name: input.name.trim(),
      host,
      tokenId: input.tokenId.trim(),
      tokenSecret: encrypt(input.tokenSecret),
      verifySsl: input.verifySsl,
      isDefault: !!input.isDefault,
      enabled: true,
      defaultStorage: input.defaultStorage ?? null,
      defaultBridge: input.defaultBridge ?? null,
      isoStorage: input.isoStorage ?? null,
      backupStorage: input.backupStorage ?? null,
    },
  });
  return toPublic(row);
}

export async function updateCluster(
  id: string,
  input: {
    name?: string;
    host?: string;
    tokenId?: string;
    tokenSecret?: string;
    verifySsl?: boolean;
    enabled?: boolean;
    isDefault?: boolean;
    defaultStorage?: string | null;
    defaultBridge?: string | null;
    isoStorage?: string | null;
    backupStorage?: string | null;
  },
) {
  const row = await getClusterById(id);
  if (!row) throw new Error('Cluster not found');

  if (input.isDefault) {
    await prisma.proxmoxCluster.updateMany({ data: { isDefault: false } });
  }

  const updated = await prisma.proxmoxCluster.update({
    where: { id },
    data: {
      name: input.name?.trim() ?? undefined,
      host: input.host ? input.host.trim().replace(/\/+$/, '') : undefined,
      tokenId: input.tokenId?.trim() ?? undefined,
      tokenSecret:
        input.tokenSecret && input.tokenSecret.trim().length > 0
          ? encrypt(input.tokenSecret)
          : undefined,
      verifySsl: input.verifySsl,
      enabled: input.enabled,
      isDefault: input.isDefault,
      defaultStorage: input.defaultStorage,
      defaultBridge: input.defaultBridge,
      isoStorage: input.isoStorage,
      backupStorage: input.backupStorage,
    },
  });
  return toPublic(updated);
}

export async function deleteCluster(id: string): Promise<void> {
  if (id === LEGACY_CLUSTER_ID) throw new Error('Cannot delete the built-in default cluster row');
  const vmCount = await prisma.virtualMachine.count({ where: { clusterId: id } });
  if (vmCount > 0) throw new Error('Cluster still has VMs — move or delete them first');
  const tplCount = await prisma.template.count({ where: { clusterId: id } });
  if (tplCount > 0) throw new Error('Cluster still has templates — remove them first');
  await prisma.proxmoxCluster.delete({ where: { id } });
}

/** Keep legacy SystemConfig in sync so older code paths keep working. */
export async function mirrorDefaultClusterToSystemConfig(clusterId: string): Promise<void> {
  const c = await getConnectionConfigForCluster(clusterId);
  await setConfig('proxmox_host', c.host);
  await setConfig('proxmox_token_id', c.tokenId);
  await setConfig('proxmox_token_secret', c.tokenSecret, true);
  await setConfig('proxmox_verify_ssl', String(c.verifySsl));
  const defs = await getClusterDefaults(clusterId);
  if (defs.storage) await setConfig('default_storage', defs.storage);
  if (defs.bridge) await setConfig('default_bridge', defs.bridge);
  if (defs.isoStorage) await setConfig('iso_storage', defs.isoStorage);
  if (defs.backupStorage) await setConfig('backup_storage', defs.backupStorage);
}
