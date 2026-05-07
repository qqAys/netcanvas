import type { Viewport } from "reactflow";

export type Language = "en" | "zh-CN";
export type CommandMode = "persistent" | "temporary";
export type CommandTemplate = "systemd-networkd" | "iproute2-bridge" | "NetworkManager";
export type NodeKind = "linux-host" | "virtual-device" | "access-point";
export type NodeRole = "member" | "router";
export type SelectionKind = "none" | "node" | "multi-node" | "network";

export interface NodeInterface {
  networkId: string;
  name: string;
  address: string;
  gateway?: boolean;
  via?: string;
}

export interface TopologyNode {
  id: string;
  name: string;
  kind: NodeKind;
  os: string;
  role: NodeRole;
  x: number;
  y: number;
  interfaces: NodeInterface[];
}

export interface TopologyNetwork {
  id: string;
  name: string;
  type: "linux-bridge";
  cidr: string;
  gateway: string;
  routerNodeId: string | null;
  color: "teal" | "amber" | string;
}

export interface NetCanvasSettings {
  useSudo: boolean;
  language: Language;
}

export interface NetCanvasProject {
  id: string;
  name: string;
  description: string;
  version: number;
  commandMode: CommandMode;
  commandTemplate: CommandTemplate;
  settings: NetCanvasSettings;
  simulation: {
    from: string | null;
    to: string | null;
  };
  share: {
    enabled: boolean;
    shareId: string | null;
    readOnly: boolean;
    expiresAt: string | null;
  };
  nodes: TopologyNode[];
  networks: TopologyNetwork[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SelectionState {
  kind: SelectionKind;
  nodeIds: string[];
  networkId: string | null;
}

export interface DraftState {
  project: NetCanvasProject;
  selection: SelectionState;
  viewport: Viewport;
}

export interface CommandBlock {
  host: string;
  title: string;
  permission: string;
  commands: string[];
  rollback: string[];
  note: string;
  warning?: string;
}

export interface SafetyCheck {
  level: "good" | "warn" | "bad";
  title: string;
  body: string;
}

export interface RouteResult {
  ok: boolean;
  message: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: string;
}
