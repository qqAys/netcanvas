import type { NetCanvasProject, NodeInterface, TopologyNetwork, TopologyNode } from "../types";

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function iface(
  networkId: string,
  name: string,
  address: string,
  gateway = false,
  via?: string
): NodeInterface {
  return { networkId, name, address, gateway, via };
}

export function topologyNode(
  id: string,
  name: string,
  kind: TopologyNode["kind"],
  os: string,
  role: TopologyNode["role"],
  x: number,
  y: number,
  interfaces: NodeInterface[]
): TopologyNode {
  return { id, name, kind, os, role, x, y, interfaces };
}

export function topologyNetwork(
  id: string,
  name: string,
  cidr: string,
  gateway: string,
  routerNodeId: string | null,
  color: string
): TopologyNetwork {
  return { id, name, type: "linux-bridge", cidr, gateway, routerNodeId, color };
}

export function normalizeProject(project: Partial<NetCanvasProject>, fallback: NetCanvasProject): NetCanvasProject {
  return {
    ...clone(fallback),
    ...clone(project),
    commandTemplate: project.commandTemplate || fallback.commandTemplate,
    settings: {
      ...fallback.settings,
      ...(project.settings || {})
    },
    simulation: project.simulation || fallback.simulation,
    share: project.share || fallback.share,
    nodes: Array.isArray(project.nodes) ? project.nodes : [],
    networks: Array.isArray(project.networks) ? project.networks : []
  };
}

export function networkMembers(project: NetCanvasProject, networkId: string): TopologyNode[] {
  return project.nodes.filter((node) => node.interfaces.some((item) => item.networkId === networkId));
}

export function nodeNetworks(project: NetCanvasProject, node: TopologyNode): TopologyNetwork[] {
  return node.interfaces
    .map((item) => project.networks.find((network) => network.id === item.networkId))
    .filter(Boolean) as TopologyNetwork[];
}

export function networkPrefix(gateway: string): string {
  return gateway.split(".").slice(0, 3).join(".");
}
