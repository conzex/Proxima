"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Plug, RefreshCw, Server, Trash2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import type { ProxmoxCluster } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";

type ClusterNode = { name: string; status: string };

export function ProxmoxClustersCard() {
  const [clusters, setClusters] = useState<ProxmoxCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodesByCluster, setNodesByCluster] = useState<Record<string, ClusterNode[]>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    host: "",
    tokenId: "",
    tokenSecret: "",
    verifySsl: false,
    isDefault: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ clusters: ProxmoxCluster[] }>("/admin/clusters");
      setClusters(res.data.clusters);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadNodes(clusterId: string) {
    try {
      const res = await api.get<{ nodes: ClusterNode[] }>(`/admin/clusters/${clusterId}/nodes`);
      setNodesByCluster((prev) => ({ ...prev, [clusterId]: res.data.nodes }));
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  async function testCluster(id: string) {
    try {
      const res = await api.post<{ connected: boolean; version?: string; nodeCount?: number; error?: string }>(
        `/admin/clusters/${id}/test`,
      );
      if (res.data.connected) {
        toast.success(`Connected — Proxmox VE ${res.data.version} (${res.data.nodeCount} nodes)`);
        await loadNodes(id);
      } else {
        toast.error(res.data.error ?? "Connection failed");
      }
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  async function syncCluster(id: string) {
    try {
      const res = await api.post<{ imported: number; totalDiscovered: number }>(`/admin/clusters/${id}/sync`);
      toast.success(`Sync complete — ${res.data.imported} new of ${res.data.totalDiscovered} guests`);
      await loadNodes(id);
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  async function createCluster() {
    setSaving(true);
    try {
      await api.post("/admin/clusters", form);
      toast.success("Cluster added");
      setShowAdd(false);
      setForm({ name: "", host: "", tokenId: "", tokenSecret: "", verifySsl: false, isDefault: false });
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeCluster(id: string) {
    if (!confirm("Remove this cluster registration? VMs must be moved or deleted first.")) return;
    try {
      await api.delete(`/admin/clusters/${id}`);
      toast.success("Cluster removed");
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-5" />
            Proxmox clusters
          </CardTitle>
          <CardDescription>
            Register multiple Proxmox clusters or standalone nodes. Sync discovers guests on every enabled cluster.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd((v) => !v)}>
          <Plus />
          {showAdd ? "Cancel" : "Add cluster"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <div className="rounded-lg border bg-muted/30 p-4 grid gap-3">
            <FormField label="Display name" htmlFor="c-name">
              <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField label="API URL" htmlFor="c-host" hint="Usually https://host:8006">
              <Input id="c-host" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
            </FormField>
            <FormField label="Token ID" htmlFor="c-tid">
              <Input id="c-tid" value={form.tokenId} onChange={(e) => setForm({ ...form, tokenId: e.target.value })} />
            </FormField>
            <FormField label="Token secret" htmlFor="c-sec">
              <Input
                id="c-sec"
                type="password"
                value={form.tokenSecret}
                onChange={(e) => setForm({ ...form, tokenSecret: e.target.value })}
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.verifySsl}
                onChange={(e) => setForm({ ...form, verifySsl: e.target.checked })}
              />
              Verify TLS certificate
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />
              Set as default for new VMs
            </label>
            <Button onClick={createCluster} disabled={saving} className="w-fit">
              {saving ? <Loader2 className="animate-spin" /> : "Save cluster"}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading clusters…
          </div>
        ) : clusters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clusters registered yet.</p>
        ) : (
          clusters.map((c) => (
            <div key={c.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {c.name}
                    {c.isDefault && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(default)</span>
                    )}
                    {!c.enabled && (
                      <span className="ml-2 text-xs font-normal text-destructive">disabled</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate max-w-xl">{c.host}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => testCluster(c.id)}>
                    <Plug />
                    Test
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => syncCluster(c.id)}>
                    <RefreshCw />
                    Sync now
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => loadNodes(c.id)}>
                    Nodes
                  </Button>
                  {c.id !== "legacy-default" && (
                    <Button size="sm" variant="ghost" onClick={() => removeCluster(c.id)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </div>
              {nodesByCluster[c.id]?.length ? (
                <ul className="text-sm text-muted-foreground grid gap-1 sm:grid-cols-2">
                  {nodesByCluster[c.id].map((n) => (
                    <li key={n.name}>
                      <span className="font-medium text-foreground">{n.name}</span> — {n.status}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
