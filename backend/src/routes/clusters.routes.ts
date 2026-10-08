import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import type { AuthRequest } from '../types/index.js';
import {
  createCluster,
  deleteCluster,
  listClusterNodes,
  listClusters,
  updateCluster,
} from '../services/proxmox-cluster.service.js';
import { testProxmoxConnection } from '../services/setup.service.js';
import { pveMessage } from '../services/proxmox.service.js';
import { syncExistingProxmoxInfrastructure } from '../services/vm.service.js';
import { recordAudit } from '../services/audit.service.js';

const router = Router();

router.use(requireAuth, requireAdmin);

function paramId(req: Request): string {
  const raw = req.params['id'];
  return Array.isArray(raw) ? raw[0]! : String(raw ?? '');
}

router.get('/', async (_req: Request, res: Response) => {
  const clusters = await listClusters(true);
  res.json({ clusters });
});

router.get('/:id/nodes', async (req: Request, res: Response) => {
  try {
    const nodes = await listClusterNodes(paramId(req));
    res.json({ nodes });
  } catch (err) {
    res.status(502).json({ error: pveMessage(err) });
  }
});

const ClusterSchema = z.object({
  name: z.string().min(1).max(120),
  host: z.string().url(),
  tokenId: z.string().min(1),
  tokenSecret: z.string().min(1),
  verifySsl: z.boolean().default(true),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
  defaultStorage: z.string().optional().nullable(),
  defaultBridge: z.string().optional().nullable(),
  isoStorage: z.string().optional().nullable(),
  backupStorage: z.string().optional().nullable(),
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = ClusterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const cluster = await createCluster({
      ...parsed.data,
      defaultStorage: parsed.data.defaultStorage ?? undefined,
      defaultBridge: parsed.data.defaultBridge ?? undefined,
      isoStorage: parsed.data.isoStorage ?? undefined,
      backupStorage: parsed.data.backupStorage ?? undefined,
    });
    await recordAudit({
      action: 'cluster.create',
      actor: (req as AuthRequest).user,
      targetType: 'cluster',
      targetId: cluster.id,
      detail: cluster.name,
      req,
    });
    res.status(201).json({ cluster });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not create cluster' });
  }
});

const ClusterUpdateSchema = ClusterSchema.partial().extend({
  tokenSecret: z.string().optional(),
});

router.put('/:id', async (req: Request, res: Response) => {
  const parsed = ClusterUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const cluster = await updateCluster(paramId(req), parsed.data);
    await recordAudit({
      action: 'cluster.update',
      actor: (req as AuthRequest).user,
      targetType: 'cluster',
      targetId: cluster.id,
      detail: cluster.name,
      req,
    });
    res.json({ cluster });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not update cluster' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = paramId(req);
    await deleteCluster(id);
    await recordAudit({
      action: 'cluster.delete',
      actor: (req as AuthRequest).user,
      targetType: 'cluster',
      targetId: id,
      req,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not delete cluster' });
  }
});

router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const result = await testProxmoxConnection(paramId(req));
    res.json(result);
  } catch (err) {
    res.status(502).json({ connected: false, error: pveMessage(err) });
  }
});

router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const result = await syncExistingProxmoxInfrastructure((req as AuthRequest).user.id, paramId(req));
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(502).json({ error: pveMessage(err) });
  }
});

export default router;
