import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  Bluetooth,
  Building2,
  Camera,
  FileSearch,
  Globe2,
  Network,
  Radio,
  Server,
  ShieldCheck,
  Users,
  Wifi,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Target } from "./data";

type GraphNodeType =
  | "building"
  | "planning"
  | "company"
  | "domain"
  | "subdomain"
  | "infra"
  | "tech"
  | "wireless"
  | "wifi"
  | "bluetooth"
  | "cctv"
  | "person";

interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  detail: string;
  source: string;
  confidence?: number;
  live?: boolean;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
  live?: boolean;
}

interface IntelligenceGraphProps {
  selected: Target | null;
  corporateRecon: any;
  scannedDevices: any[];
  bluetoothDevices: any[];
  cameras: any[];
  cctvSubnet: string | null;
  scanning: boolean;
  reconLoading: boolean;
  cctvScanning: boolean;
  onClose: () => void;
  onRunRecon: () => void;
  onStartScan: () => void;
}

const NODE_STYLE: Record<GraphNodeType, string> = {
  building: "border-sky-300/40 bg-sky-300/10 text-sky-100",
  planning: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  company: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
  domain: "border-lime-300/30 bg-lime-300/10 text-lime-100",
  subdomain: "border-lime-300/25 bg-lime-300/[0.07] text-lime-100",
  infra: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  tech: "border-white/20 bg-white/[0.07] text-white/85",
  wireless: "border-orange-300/30 bg-orange-300/10 text-orange-100",
  wifi: "border-orange-300/30 bg-orange-300/[0.08] text-orange-100",
  bluetooth: "border-violet-300/30 bg-violet-300/10 text-violet-100",
  cctv: "border-red-300/40 bg-red-300/10 text-red-100",
  person: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-100",
};

const ICONS: Record<GraphNodeType, ReactNode> = {
  building: <Building2 className="size-3.5" />,
  planning: <FileSearch className="size-3.5" />,
  company: <Users className="size-3.5" />,
  domain: <Globe2 className="size-3.5" />,
  subdomain: <Globe2 className="size-3.5" />,
  infra: <Server className="size-3.5" />,
  tech: <ShieldCheck className="size-3.5" />,
  wireless: <Radio className="size-3.5" />,
  wifi: <Wifi className="size-3.5" />,
  bluetooth: <Bluetooth className="size-3.5" />,
  cctv: <Camera className="size-3.5" />,
  person: <Users className="size-3.5" />,
};

function compactId(value: unknown): string {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

function compactLabel(value: unknown, fallback = "Unknown"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function rssiLabel(device: any): string {
  if (typeof device?.rssi === "number") return `${device.rssi} dBm`;
  if (typeof device?.signal_strength === "number") return `${Math.round(device.signal_strength)}% signal`;
  return "live signal";
}

function sourcePreview(devices: any[], fieldA: string, fieldB: string, fallback: string): string {
  const labels = devices
    .map((device) => compactLabel(device?.[fieldA] || device?.[fieldB], ""))
    .filter(Boolean)
    .slice(0, 3);
  if (!labels.length) return fallback;
  const remaining = devices.length - labels.length;
  return remaining > 0 ? `${labels.join(", ")} +${remaining}` : labels.join(", ");
}

function addNode(nodes: GraphNode[], seen: Set<string>, node: GraphNode) {
  if (seen.has(node.id)) return;
  seen.add(node.id);
  nodes.push(node);
}

function buildGraph(
  selected: Target | null,
  corporateRecon: any,
  scannedDevices: any[],
  bluetoothDevices: any[],
  cameras: any[],
  cctvSubnet: string | null,
): { nodes: GraphNode[]; edges: GraphEdge[]; evidence: string[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const evidence: string[] = [];
  const seen = new Set<string>();
  const companyName = compactLabel(corporateRecon?.company || selected?.name || null, "");
  const rootId = selected
    ? `building:${compactId(selected.id)}`
    : companyName
      ? `company:${compactId(companyName)}`
      : "surface:live";

  if (selected) {
    addNode(nodes, seen, {
      id: rootId,
      type: "building",
      label: selected.name,
      detail: selected.address,
      source: "Planning target",
      confidence: selected.confidence,
      x: 50,
      y: 35,
    });
    addNode(nodes, seen, {
      id: `planning:${compactId(selected.planning)}`,
      type: "planning",
      label: selected.planning,
      detail: `${selected.register.authority} · ${selected.documents.length} public document${selected.documents.length === 1 ? "" : "s"}`,
      source: selected.register.system,
      confidence: selected.confidence,
      x: 24,
      y: 24,
    });
    edges.push({
      from: rootId,
      to: `planning:${compactId(selected.planning)}`,
      label: "public record",
    });
    evidence.push(`${selected.documents.length} planning document${selected.documents.length === 1 ? "" : "s"} linked to ${selected.planning}`);
  }

  if (corporateRecon) {
    const companyId = `company:${compactId(corporateRecon.company || companyName || "company")}`;
    addNode(nodes, seen, {
      id: companyId,
      type: "company",
      label: compactLabel(corporateRecon.company || companyName, "Company"),
      detail: corporateRecon.osint_context?.building || selected?.address || "Corporate OSINT result",
      source: "Recon result",
      live: true,
      x: selected ? 50 : 28,
      y: selected ? 56 : 38,
    });
    if (selected) edges.push({ from: rootId, to: companyId, label: "investigated as tenant", live: true });

    const domain = corporateRecon.osint_context?.company_domain;
    if (domain) {
      const domainId = `domain:${compactId(domain)}`;
      addNode(nodes, seen, {
        id: domainId,
        type: "domain",
        label: domain,
        detail: "Inferred or supplied corporate domain",
        source: "OSINT engine",
        live: true,
        x: 76,
        y: 24,
      });
      edges.push({ from: companyId, to: domainId, label: "domain", live: true });
      evidence.push(`Corporate domain observed: ${domain}`);
    }

    (corporateRecon.osint_context?.subdomains || []).slice(0, 5).forEach((sub: string, index: number) => {
      const nodeId = `subdomain:${compactId(sub)}`;
      addNode(nodes, seen, {
        id: nodeId,
        type: "subdomain",
        label: sub,
        detail: "Passive subdomain discovery",
        source: "DNS enumeration",
        live: true,
        x: 78,
        y: 37 + index * 7,
      });
      edges.push({
        from: corporateRecon.osint_context?.company_domain
          ? `domain:${compactId(corporateRecon.osint_context.company_domain)}`
          : companyId,
        to: nodeId,
        label: "subdomain",
        live: true,
      });
    });

    (corporateRecon.osint_context?.exposed_devices || []).slice(0, 5).forEach((device: any, index: number) => {
      const label = `${device.ip || "unknown"}${device.port ? `:${device.port}` : ""}`;
      const nodeId = `infra:${compactId(label)}`;
      addNode(nodes, seen, {
        id: nodeId,
        type: "infra",
        label,
        detail: compactLabel(device.service, "Public service"),
        source: "Shodan/Censys",
        live: true,
        x: 76,
        y: 61 + index * 6,
      });
      edges.push({ from: companyId, to: nodeId, label: "public exposure", live: true });
    });

    (corporateRecon.osint_context?.tech_stack || [])
      .filter((tech: string) => tech && tech !== "Unknown / static site")
      .slice(0, 4)
      .forEach((tech: string, index: number) => {
        const nodeId = `tech:${compactId(tech)}`;
        addNode(nodes, seen, {
          id: nodeId,
          type: "tech",
          label: tech,
          detail: "Website fingerprint",
          source: "HTTP signature scan",
          live: true,
          x: 48 + index * 10,
          y: 14,
        });
        edges.push({ from: companyId, to: nodeId, label: "uses", live: true });
      });

    (corporateRecon.employees_present || []).slice(0, 4).forEach((person: any, index: number) => {
      const name = compactLabel(person.name || person.email, "Matched person");
      const nodeId = `person:${compactId(name)}`;
      const confidence =
        typeof person.probability === "number" ? Math.round(person.probability * 100) : undefined;
      addNode(nodes, seen, {
        id: nodeId,
        type: "person",
        label: name,
        detail: compactLabel(person.title || person.email, "Wireless correlation"),
        source: "Live device correlation",
        confidence,
        live: true,
        x: 24,
        y: 62 + index * 7,
      });
      edges.push({ from: companyId, to: nodeId, label: "possible presence", live: true });
    });

    evidence.push(`${corporateRecon.correlated_devices?.length || 0} wireless correlation${(corporateRecon.correlated_devices?.length || 0) === 1 ? "" : "s"}`);
  }

  if (scannedDevices.length || bluetoothDevices.length) {
    const wirelessId = "wireless:live";
    addNode(nodes, seen, {
      id: wirelessId,
      type: "wireless",
      label: "Live wireless scan",
      detail: `${scannedDevices.length} WiFi · ${bluetoothDevices.length} BLE`,
      source: "Local passive scan",
      live: true,
      x: 20,
      y: 82,
    });
    if (selected || corporateRecon) edges.push({ from: rootId, to: wirelessId, label: "observed nearby", live: true });

    if (scannedDevices.length) {
      const strongest = scannedDevices[0];
      const nodeId = "wifi:cluster";
      addNode(nodes, seen, {
        id: nodeId,
        type: "wifi",
        label: `${scannedDevices.length} WiFi networks`,
        detail: sourcePreview(scannedDevices, "ssid", "name", rssiLabel(strongest)),
        source: "WiFi scan",
        live: true,
        x: 22,
        y: 58,
      });
      edges.push({ from: wirelessId, to: nodeId, label: "SSIDs", live: true });
    }

    if (bluetoothDevices.length) {
      const strongest = bluetoothDevices[0];
      const nodeId = "ble:cluster";
      addNode(nodes, seen, {
        id: nodeId,
        type: "bluetooth",
        label: `${bluetoothDevices.length} BLE devices`,
        detail: sourcePreview(bluetoothDevices, "name", "ssid", rssiLabel(strongest)),
        source: "CoreBluetooth scan",
        live: true,
        x: 68,
        y: 78,
      });
      edges.push({ from: wirelessId, to: nodeId, label: "nearby BLE", live: true });
    }

    evidence.push(`${scannedDevices.length + bluetoothDevices.length} live radio device${scannedDevices.length + bluetoothDevices.length === 1 ? "" : "s"} currently observed`);
  }

  if (cameras.length) {
    const cctvRoot = "cctv:local-network";
    addNode(nodes, seen, {
      id: cctvRoot,
      type: "cctv",
      label: "Local CCTV surface",
      detail: cctvSubnet || "Current LAN",
      source: "LAN RTSP discovery",
      live: true,
      x: 62,
      y: 72,
    });
    if (selected || corporateRecon) edges.push({ from: rootId, to: cctvRoot, label: "same local network", live: true });
    cameras.slice(0, 4).forEach((camera, index) => {
      const label = `${camera.ip || "camera"}${camera.port ? `:${camera.port}` : ""}`;
      const nodeId = `camera:${compactId(label)}`;
      addNode(nodes, seen, {
        id: nodeId,
        type: "cctv",
        label,
        detail: `${compactLabel(camera.manufacturer, "Camera")} · ${compactLabel(camera.model, "model unknown")}`,
        source: "Live CCTV scan",
        live: true,
        x: 68 + index * 4,
        y: 84,
      });
      edges.push({ from: cctvRoot, to: nodeId, label: "stream", live: true });
    });
    evidence.push(`${cameras.length} CCTV endpoint${cameras.length === 1 ? "" : "s"} discovered on the current network`);
  }

  return { nodes, edges, evidence };
}

export function IntelligenceGraph({
  selected,
  corporateRecon,
  scannedDevices,
  bluetoothDevices,
  cameras,
  cctvSubnet,
  scanning,
  reconLoading,
  cctvScanning,
  onClose,
  onRunRecon,
  onStartScan,
}: IntelligenceGraphProps) {
  const graph = useMemo(
    () => buildGraph(selected, corporateRecon, scannedDevices, bluetoothDevices, cameras, cctvSubnet),
    [selected, corporateRecon, scannedDevices, bluetoothDevices, cameras, cctvSubnet],
  );
  const graphAreaRef = useRef<HTMLDivElement>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const positionedNodes = graph.nodes.map((node) => ({ ...node, ...(nodePositions[node.id] || {}) }));
  const byId = new Map(positionedNodes.map((node) => [node.id, node]));
  const live = scanning || reconLoading || cctvScanning;
  const hasEvidence = graph.nodes.length > 0;

  useEffect(() => {
    setNodePositions((current) => {
      const valid = new Set(graph.nodes.map((node) => node.id));
      let changed = false;
      const next: Record<string, { x: number; y: number }> = {};
      Object.entries(current).forEach(([id, pos]) => {
        if (valid.has(id)) next[id] = pos;
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [graph.nodes]);

  function pointerPercent(event: PointerEvent<HTMLDivElement>) {
    const rect = graphAreaRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function clampPosition(x: number, y: number) {
    return {
      x: Math.max(15, Math.min(85, x)),
      y: Math.max(12, Math.min(88, y)),
    };
  }

  function startDrag(event: PointerEvent<HTMLDivElement>, node: GraphNode) {
    const point = pointerPercent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging({
      id: node.id,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
    });
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const point = pointerPercent(event);
    if (!point) return;
    const next = clampPosition(point.x - dragging.offsetX, point.y - dragging.offsetY);
    setNodePositions((current) => ({
      ...current,
      [dragging.id]: next,
    }));
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragging) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // pointer capture may already be released
      }
    }
    setDragging(null);
  }

  return (
    <Card className="no-print flex w-full flex-col overflow-hidden border-0 bg-transparent text-white shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-3 p-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-cyan-300/15 text-cyan-100">
              <Network className="size-4" />
            </span>
            <div>
              <CardTitle>Building Intelligence Graph</CardTitle>
              <div className="text-[11px] text-white/45">
                Evidence-backed links from live scan, recon, planning, and CCTV.
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {live && (
            <Badge variant="emerald" className="text-[10px]">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
              LIVE
            </Badge>
          )}
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="size-8 text-white/50 hover:bg-white/10 hover:text-white">
            <X />
          </Button>
        </div>
      </CardHeader>
      <Separator className="bg-white/10" />

      {!hasEvidence ? (
        <CardContent className="flex flex-col gap-3 p-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-[12px] font-medium text-white/85">No graph evidence yet</div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/45">
              The graph does not fabricate tenants, domains, devices, or cameras. Select a planning target, start a live wireless scan, or run OSINT to populate it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={onStartScan}
              variant="outline"
              size="sm"
              className="border-orange-300/30 bg-orange-300/10 text-orange-100 hover:bg-orange-300/15"
            >
              Start WiFi/BLE scan
            </Button>
            <Button
              type="button"
              onClick={onRunRecon}
              variant="outline"
              size="sm"
              className="border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15"
            >
              Run OSINT
            </Button>
          </div>
        </CardContent>
      ) : (
        <CardContent className="flex min-h-0 flex-col gap-3 overflow-y-auto p-3">
          <div
            ref={graphAreaRef}
            className="relative h-[290px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(56,189,248,0.16),rgba(2,6,23,0.16)_45%,rgba(0,0,0,0.16)_80%)]"
          >
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {graph.edges.map((edge, index) => {
                const from = byId.get(edge.from);
                const to = byId.get(edge.to);
                if (!from || !to) return null;
                return (
                  <g key={`${edge.from}-${edge.to}-${index}`}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      className={cn(edge.live ? "stroke-emerald-300/40" : "stroke-white/20")}
                      strokeWidth="0.28"
                    />
                  </g>
                );
              })}
            </svg>
            {positionedNodes.map((node) => (
              <div
                key={node.id}
                className={cn(
                  "absolute w-36 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none rounded-xl border px-2.5 py-2 shadow-lg shadow-black/30 backdrop-blur-md active:cursor-grabbing",
                  dragging?.id === node.id && "z-10 ring-2 ring-cyan-300/40",
                  NODE_STYLE[node.type],
                )}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                title={`${node.source}: ${node.detail}`}
                onPointerDown={(event) => startDrag(event, node)}
                onPointerMove={moveDrag}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-current opacity-80">{ICONS[node.type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold leading-tight">{node.label}</span>
                    <span className="mt-0.5 block truncate text-[9px] leading-tight text-white/50">{node.detail}</span>
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[8.5px] uppercase tracking-wider text-white/40">
                  <span className="truncate">{node.source}</span>
                  {node.live ? <span className="text-emerald-200">live</span> : node.confidence ? <span>{node.confidence}%</span> : null}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="sky">{graph.nodes.length} nodes</Badge>
            <Badge variant="outline">{graph.edges.length} links</Badge>
            {scannedDevices.length > 0 && <Badge variant="amber">{scannedDevices.length} WiFi</Badge>}
            {bluetoothDevices.length > 0 && <Badge variant="outline">{bluetoothDevices.length} BLE</Badge>}
            {cameras.length > 0 && <Badge variant="red">{cameras.length} CCTV</Badge>}
            {Object.keys(nodePositions).length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setNodePositions({})}
                className="ml-auto h-6 px-2 text-[10px] text-white/45 hover:bg-white/10 hover:text-white/80"
              >
                Reset layout
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Evidence ledger</span>
              <span className="font-mono text-[10px] text-white/35">{cctvSubnet || "live surface"}</span>
            </div>
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
              {graph.evidence.map((item, index) => (
                <div key={index} className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2 text-[11px] leading-relaxed text-white/70">
                  {item}
                </div>
              ))}
              {graph.edges.slice(0, 10).map((edge, index) => {
                const from = byId.get(edge.from);
                const to = byId.get(edge.to);
                if (!from || !to) return null;
                return (
                  <div key={`${edge.from}-${edge.to}-ledger-${index}`} className="rounded-lg border border-white/10 bg-white/[0.025] px-2.5 py-2">
                    <div className="text-[11px] text-white/75">
                      <span className="font-medium text-white/90">{from.label}</span>
                      <span className="text-white/35"> → </span>
                      <span className="font-medium text-white/90">{to.label}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/40">{edge.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      )}

      <Separator className="bg-white/10" />
      <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-white/40">
        <span>No mock graph nodes. Empty means no source returned evidence.</span>
        <span className="hidden sm:inline">{cctvSubnet || "LAN auto"}</span>
      </div>
    </Card>
  );
}
