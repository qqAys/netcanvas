import { create } from "zustand";
import type { Connection, Edge, Node, NodeChange, OnNodesChange, Viewport } from "reactflow";
import { applyNodeChanges } from "reactflow";
import type {
  CommandMode,
  CommandTemplate,
  Language,
  NetCanvasProject,
  NodeKind,
  NodeRole,
  ProjectListItem,
  SelectionState,
  TopologyNetwork,
  TopologyNode
} from "../types";
import { emptyProject, newProjectFromTemplate } from "../lib/templates";
import { clone, iface, networkMembers, networkPrefix, normalizeProject, topologyNetwork, topologyNode, uid } from "../lib/utils";

const STORAGE_KEY = "netcanvas.react.workspace.v1";
const PROJECTS_KEY = "netcanvas.react.projects.v1";
const initialViewport: Viewport = { x: 0, y: 0, zoom: 1 };
const FLOW_NODE_WIDTH = 142;
const FLOW_NODE_HEIGHT = 68;
const NETWORK_MIN_WIDTH = 260;
const NETWORK_MIN_HEIGHT = 170;
const NETWORK_PADDING_X = 52;
const NETWORK_PADDING_Y = 58;

interface CreateNodeInput {
  kind: NodeKind;
  role: NodeRole;
  name: string;
  os: string;
}

interface CreateNetworkInput {
  name: string;
  cidr: string;
  gateway: string;
  routerNodeId: string | null;
}

interface WorkspaceStore {
  project: NetCanvasProject;
  selection: SelectionState;
  viewport: Viewport;
  projects: ProjectListItem[];
  message: string;
  showTemplateDialog: boolean;
  createDialogType: NodeKind | "router" | "network" | null;
  inspectorCollapsed: boolean;
  setViewport: (viewport: Viewport) => void;
  setProjectName: (name: string) => void;
  newProject: () => void;
  loadTemplate: (templateId: string) => void;
  openTemplateDialog: () => void;
  closeTemplateDialog: () => void;
  openCreateDialog: (type: WorkspaceStore["createDialogType"]) => void;
  closeCreateDialog: () => void;
  createNode: (input: CreateNodeInput) => void;
  createNetwork: (input: CreateNetworkInput) => void;
  updateNode: (id: string, patch: Partial<TopologyNode>) => void;
  updateNetwork: (id: string, patch: Partial<TopologyNetwork>) => void;
  joinSelectedToNetwork: (networkId: string) => void;
  createNetworkAndJoin: () => void;
  setRouterForSelection: () => void;
  deleteSelected: () => void;
  selectNode: (id: string, additive?: boolean) => void;
  selectNetwork: (id: string) => void;
  setSelectionFromFlow: (nodes: Node[]) => void;
  onNodesChange: OnNodesChange;
  setCommandMode: (mode: CommandMode) => void;
  setCommandTemplate: (template: CommandTemplate) => void;
  setUseSudo: (value: boolean) => void;
  setLanguage: (language: Language) => void;
  setSimulation: (key: "from" | "to", value: string | null) => void;
  refreshProjects: () => void;
  loadProject: (id: string) => void;
  deleteProject: (id: string) => void;
  saveProject: () => void;
  importProject: (project: Partial<NetCanvasProject>) => void;
  toggleInspector: () => void;
}

function createInitialState(): Pick<WorkspaceStore, "project" | "selection" | "viewport" | "showTemplateDialog" | "message"> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      project: { ...newProjectFromTemplate("empty"), settings: { ...emptyProject.settings, language: "en", useSudo: true } },
      selection: { kind: "none", nodeIds: [], networkId: null },
      viewport: initialViewport,
      showTemplateDialog: true,
      message: "Ready"
    };
  }
  try {
    const draft = JSON.parse(raw) as { project?: Partial<NetCanvasProject>; selection?: SelectionState; viewport?: Viewport };
    const project = normalizeProject(draft.project || {}, emptyProject);
    return {
      project,
      selection: draft.selection || { kind: "none", nodeIds: [], networkId: null },
      viewport: draft.viewport || initialViewport,
      showTemplateDialog: false,
      message: "Ready"
    };
  } catch {
    return {
      project: newProjectFromTemplate("empty"),
      selection: { kind: "none", nodeIds: [], networkId: null },
      viewport: initialViewport,
      showTemplateDialog: true,
      message: "Ready"
    };
  }
}

function persist(project: NetCanvasProject, selection: SelectionState, viewport: Viewport): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ project, selection, viewport }));
}

function readLocalProjects(): Record<string, NetCanvasProject> {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<NetCanvasProject>>;
    return Object.fromEntries(Object.entries(parsed).map(([id, project]) => [id, normalizeProject(project, emptyProject)]));
  } catch {
    return {};
  }
}

function writeLocalProjects(projects: Record<string, NetCanvasProject>): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function localProjectList(): ProjectListItem[] {
  return Object.values(readLocalProjects())
    .map((project) => ({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt || project.createdAt || ""
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function selectedNetworkId(project: NetCanvasProject, selection: SelectionState): string | null {
  return selection.networkId || project.networks[0]?.id || null;
}

function nodeToFlow(node: TopologyNode, selected: boolean): Node {
  return {
    id: node.id,
    type: "topologyNode",
    position: { x: node.x, y: node.y },
    style: { width: FLOW_NODE_WIDTH, height: FLOW_NODE_HEIGHT },
    zIndex: selected ? 12 : 10,
    data: { node, selected }
  };
}

export function projectToFlow(project: NetCanvasProject, selection: SelectionState): { nodes: Node[]; edges: Edge[] } {
  const flowNodes: Node[] = [
    ...project.networks.map((network) => {
      const members = networkMembers(project, network.id);
      const minX = members.length ? Math.min(...members.map((node) => node.x)) - NETWORK_PADDING_X : 80;
      const minY = members.length ? Math.min(...members.map((node) => node.y)) - NETWORK_PADDING_Y : 120;
      const maxX = members.length ? Math.max(...members.map((node) => node.x + FLOW_NODE_WIDTH)) + NETWORK_PADDING_X : 400;
      const maxY = members.length ? Math.max(...members.map((node) => node.y + FLOW_NODE_HEIGHT)) + NETWORK_PADDING_Y : 310;
      const width = Math.max(NETWORK_MIN_WIDTH, maxX - minX);
      const height = Math.max(NETWORK_MIN_HEIGHT, maxY - minY);
      return {
        id: network.id,
        type: "networkZone",
        position: { x: minX, y: minY },
        draggable: false,
        selectable: true,
        data: { network, width, height, selected: selection.kind === "network" && selection.networkId === network.id },
        style: { width, height },
        zIndex: selection.kind === "network" && selection.networkId === network.id ? 2 : 1
      };
    }),
    ...project.nodes.map((node) => nodeToFlow(node, selection.nodeIds.includes(node.id)))
  ];

  const edges: Edge[] = [];
  for (const network of project.networks) {
    const router = project.nodes.find((node) => node.id === network.routerNodeId);
    if (!router) continue;
    for (const member of networkMembers(project, network.id).filter((node) => node.id !== router.id)) {
      edges.push({
        id: `${network.id}-${router.id}-${member.id}`,
        source: router.id,
        target: member.id,
        type: "smoothstep",
        style: { stroke: "#9eb0bd", strokeWidth: 1.8 }
      });
    }
  }
  return { nodes: flowNodes, edges };
}

const initial = createInitialState();

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  ...initial,
  projects: localProjectList(),
  createDialogType: null,
  inspectorCollapsed: false,

  setViewport: (viewport) => {
    const current = get().viewport;
    if (current.x === viewport.x && current.y === viewport.y && current.zoom === viewport.zoom) return;
    set({ viewport });
    persist(get().project, get().selection, viewport);
  },
  setProjectName: (name) => set((state) => {
    const project = { ...state.project, name };
    persist(project, state.selection, state.viewport);
    return { project };
  }),
  newProject: () => set((state) => {
    const project = {
      ...newProjectFromTemplate("empty"),
      settings: { ...state.project.settings }
    };
    const selection: SelectionState = { kind: "none", nodeIds: [], networkId: null };
    persist(project, selection, initialViewport);
    return {
      project,
      selection,
      viewport: initialViewport,
      showTemplateDialog: false,
      inspectorCollapsed: false,
      message: `New canvas: ${project.name}`
    };
  }),
  loadTemplate: (templateId) => set((state) => {
    const project = newProjectFromTemplate(templateId);
    const selection: SelectionState = { kind: "none", nodeIds: [], networkId: project.networks[0]?.id || null };
    persist(project, selection, initialViewport);
    return { project, selection, viewport: initialViewport, showTemplateDialog: false, message: `Load template: ${project.name}` };
  }),
  openTemplateDialog: () => set({ showTemplateDialog: true }),
  closeTemplateDialog: () => set({ showTemplateDialog: false }),
  openCreateDialog: (type) => set({ createDialogType: type }),
  closeCreateDialog: () => set({ createDialogType: null }),
  createNode: (input) => set((state) => {
    const id = uid(input.role === "router" ? "router" : input.kind === "access-point" ? "ap" : "host");
    const visibleBase = state.project.nodes.length
      ? {
          x: Math.min(...state.project.nodes.map((node) => node.x)) + 40,
          y: Math.min(...state.project.nodes.map((node) => node.y)) + 40
        }
      : { x: 180, y: 180 };
    const node = topologyNode(id, input.name, input.kind, input.os, input.role, visibleBase.x, visibleBase.y, []);
    const project = { ...state.project, nodes: [...state.project.nodes, node] };
    const selection: SelectionState = { kind: "node", nodeIds: [id], networkId: state.selection.networkId };
    persist(project, selection, state.viewport);
    return { project, selection, createDialogType: null, inspectorCollapsed: false, message: `Added ${input.name}` };
  }),
  createNetwork: (input) => set((state) => {
    const id = uid("net");
    const network = topologyNetwork(id, input.name, input.cidr, input.gateway, input.routerNodeId, state.project.networks.length % 2 ? "amber" : "teal");
    const nodes = state.project.nodes.map((node) => {
      if (node.id !== input.routerNodeId || node.interfaces.some((item) => item.networkId === id)) return node;
      return {
        ...node,
        role: "router" as const,
        interfaces: [...node.interfaces, iface(id, input.name, `${input.gateway}/24`, true)]
      };
    });
    const project = { ...state.project, nodes, networks: [...state.project.networks, network] };
    const selection: SelectionState = { kind: "network", nodeIds: [], networkId: id };
    persist(project, selection, state.viewport);
    return { project, selection, createDialogType: null, inspectorCollapsed: false, message: `Created ${input.name}` };
  }),
  updateNode: (id, patch) => set((state) => {
    const project = { ...state.project, nodes: state.project.nodes.map((node) => node.id === id ? { ...node, ...patch } : node) };
    persist(project, state.selection, state.viewport);
    return { project };
  }),
  updateNetwork: (id, patch) => set((state) => {
    const currentNetwork = state.project.networks.find((network) => network.id === id);
    const networks = state.project.networks.map((network) => network.id === id ? { ...network, ...patch } : network);
    const nextNetwork = networks.find((network) => network.id === id);
    const nodes = patch.routerNodeId && nextNetwork
      ? state.project.nodes.map((node) => {
          if (node.id !== patch.routerNodeId || node.interfaces.some((item) => item.networkId === id)) return node;
          return {
            ...node,
            role: "router" as const,
            interfaces: [...node.interfaces, iface(id, nextNetwork.name, `${nextNetwork.gateway}/24`, true)]
          };
        })
      : state.project.nodes;
    const project = { ...state.project, nodes, networks };
    if (currentNetwork && nextNetwork && (patch.gateway || patch.name)) {
      project.nodes = project.nodes.map((node) => ({
        ...node,
        interfaces: node.interfaces.map((item) => {
          if (item.networkId !== id || !item.gateway) return item;
          return {
            ...item,
            name: patch.name || item.name,
            address: patch.gateway ? `${nextNetwork.gateway}/24` : item.address
          };
        })
      }));
    }
    persist(project, state.selection, state.viewport);
    return { project };
  }),
  joinSelectedToNetwork: (networkId) => set((state) => {
    const network = state.project.networks.find((item) => item.id === networkId);
    if (!network || !state.selection.nodeIds.length) return {};
    const prefix = networkPrefix(network.gateway);
    const nodes = state.project.nodes.map((node) => {
      if (!state.selection.nodeIds.includes(node.id) || node.interfaces.some((item) => item.networkId === networkId)) return node;
      const hostNumber = state.project.nodes.findIndex((candidate) => candidate.id === node.id) + 10;
      return {
        ...node,
        interfaces: [...node.interfaces, iface(networkId, node.role === "router" ? network.name : `eth${node.interfaces.length + 1}`, node.role === "router" ? `${network.gateway}/24` : `${prefix}.${hostNumber}/24`, node.role === "router", node.role === "router" ? undefined : network.gateway)]
      };
    });
    const networks = state.project.networks.map((item) => {
      if (item.id !== networkId) return item;
      const router = nodes.find((node) => state.selection.nodeIds.includes(node.id) && node.role === "router");
      return router ? { ...item, routerNodeId: router.id } : item;
    });
    const project = { ...state.project, nodes, networks };
    persist(project, state.selection, state.viewport);
    return { project, message: `Joined selected nodes to ${network.name}` };
  }),
  createNetworkAndJoin: () => {
    set((state) => {
      const selectedIds = state.selection.nodeIds;
      if (!selectedIds.length) return {};
      const count = state.project.networks.length + 1;
      const id = uid("net");
      const gateway = `10.${20 + count}.0.1`;
      const network = topologyNetwork(id, `br-net-${count}`, `10.${20 + count}.0.0/24`, gateway, null, state.project.networks.length % 2 ? "amber" : "teal");
      const prefix = networkPrefix(gateway);
      const nodes = state.project.nodes.map((node) => {
        if (!selectedIds.includes(node.id)) return node;
        const hostNumber = state.project.nodes.findIndex((candidate) => candidate.id === node.id) + 10;
        return {
          ...node,
          interfaces: [...node.interfaces, iface(id, node.role === "router" ? network.name : `eth${node.interfaces.length + 1}`, `${prefix}.${node.role === "router" ? 1 : hostNumber}/24`, node.role === "router", node.role === "router" ? undefined : gateway)]
        };
      });
      const router = nodes.find((node) => selectedIds.includes(node.id) && node.role === "router");
      const project = { ...state.project, nodes, networks: [...state.project.networks, router ? { ...network, routerNodeId: router.id } : network] };
      const selection: SelectionState = { ...state.selection, networkId: id };
      persist(project, selection, state.viewport);
      return { project, selection, message: `Created ${network.name}` };
    });
  },
  setRouterForSelection: () => set((state) => {
    const nodeId = state.selection.nodeIds[0];
    const networkId = selectedNetworkId(state.project, state.selection);
    if (!nodeId || !networkId) return {};
    const network = state.project.networks.find((item) => item.id === networkId);
    if (!network) return {};
    const nodes = state.project.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const hasNetwork = node.interfaces.some((item) => item.networkId === networkId);
      return {
        ...node,
        role: "router" as const,
        interfaces: hasNetwork ? node.interfaces : [...node.interfaces, iface(networkId, network.name, `${network.gateway}/24`, true)]
      };
    });
    const project = { ...state.project, nodes, networks: state.project.networks.map((item) => item.id === networkId ? { ...item, routerNodeId: nodeId } : item) };
    persist(project, state.selection, state.viewport);
    return { project };
  }),
  deleteSelected: () => set((state) => {
    let project = clone(state.project);
    if (state.selection.kind === "network" && state.selection.networkId) {
      const networkId = state.selection.networkId;
      project.networks = project.networks.filter((network) => network.id !== networkId);
      project.nodes = project.nodes.map((node) => ({ ...node, interfaces: node.interfaces.filter((item) => item.networkId !== networkId) }));
    } else if (state.selection.nodeIds.length) {
      const deleting = new Set(state.selection.nodeIds);
      project.nodes = project.nodes.filter((node) => !deleting.has(node.id));
      project.networks = project.networks.map((network) => deleting.has(network.routerNodeId || "") ? { ...network, routerNodeId: null } : network);
      if (project.simulation.from && deleting.has(project.simulation.from)) project.simulation.from = null;
      if (project.simulation.to && deleting.has(project.simulation.to)) project.simulation.to = null;
    }
    const selection: SelectionState = { kind: "none", nodeIds: [], networkId: project.networks[0]?.id || null };
    persist(project, selection, state.viewport);
    return { project, selection, message: "Deleted selected item" };
  }),
  selectNode: (id, additive = false) => set((state) => {
    const nodeIds = additive
      ? Array.from(new Set([...state.selection.nodeIds, id]))
      : [id];
    const selection: SelectionState = { kind: nodeIds.length > 1 ? "multi-node" : "node", nodeIds, networkId: state.selection.networkId };
    persist(state.project, selection, state.viewport);
    return { selection, inspectorCollapsed: false };
  }),
  selectNetwork: (id) => set((state) => {
    const selection: SelectionState = { kind: "network", nodeIds: [], networkId: id };
    persist(state.project, selection, state.viewport);
    return { selection, inspectorCollapsed: false };
  }),
  setSelectionFromFlow: (nodes) => {
    const state = get();
    const selectedNetwork = nodes.find((node) => node.type === "networkZone");
    if (selectedNetwork) {
      const same = state.selection.kind === "network" && state.selection.networkId === selectedNetwork.id;
      if (same) return;
      const selection: SelectionState = { kind: "network", nodeIds: [], networkId: selectedNetwork.id };
      persist(state.project, selection, state.viewport);
      set({ selection, inspectorCollapsed: false });
      return;
    }

    const selected = nodes.filter((node) => node.type === "topologyNode").map((node) => node.id);
    if (selected.length) {
      const same = state.selection.kind !== "network"
        && selected.length === state.selection.nodeIds.length
        && selected.every((id) => state.selection.nodeIds.includes(id));
      if (same) return;
      const selection: SelectionState = { kind: selected.length > 1 ? "multi-node" : "node", nodeIds: selected, networkId: state.selection.networkId };
      persist(state.project, selection, state.viewport);
      set({ selection, inspectorCollapsed: false });
      return;
    }
    // Ignore empty React Flow selection events. They also fire when external UI
    // updates our business selection, and clearing here causes selection loops.
  },
  onNodesChange: (changes: NodeChange[]) => {
    const positionChanges = changes.filter((change) => change.type === "position" && change.position);
    if (!positionChanges.length) return;

    set((state) => {
      const flow = projectToFlow(state.project, state.selection).nodes;
      const changed = applyNodeChanges(positionChanges, flow);
      const nodePositions = new Map(changed.filter((node) => node.type === "topologyNode").map((node) => [node.id, node.position]));
      let moved = false;
      const project = {
        ...state.project,
        nodes: state.project.nodes.map((node) => {
          const position = nodePositions.get(node.id);
          if (!position || (position.x === node.x && position.y === node.y)) return node;
          moved = true;
          return { ...node, x: position.x, y: position.y };
        })
      };
      if (!moved) return {};
      persist(project, state.selection, state.viewport);
      return { project };
    });
  },
  setCommandMode: (mode) => set((state) => {
    const project = { ...state.project, commandMode: mode };
    persist(project, state.selection, state.viewport);
    return { project };
  }),
  setCommandTemplate: (template) => set((state) => {
    const project = { ...state.project, commandTemplate: template };
    persist(project, state.selection, state.viewport);
    return { project };
  }),
  setUseSudo: (value) => set((state) => {
    const project = { ...state.project, settings: { ...state.project.settings, useSudo: value } };
    persist(project, state.selection, state.viewport);
    return { project };
  }),
  setLanguage: (language) => set((state) => {
    const project = { ...state.project, settings: { ...state.project.settings, language } };
    persist(project, state.selection, state.viewport);
    return { project };
  }),
  setSimulation: (key, value) => set((state) => {
    const project = { ...state.project, simulation: { ...state.project.simulation, [key]: value } };
    persist(project, state.selection, state.viewport);
    return { project };
  }),
  refreshProjects: () => set({ projects: localProjectList(), message: "Local projects refreshed" }),
  loadProject: (id) => {
    const project = readLocalProjects()[id];
    if (!project) {
      set({ projects: localProjectList(), message: "Project not found in this browser" });
      return;
    }
    const selection: SelectionState = { kind: "none", nodeIds: [], networkId: project.networks[0]?.id || null };
    persist(project, selection, initialViewport);
    set({ project, selection, viewport: initialViewport, message: `Loaded ${project.name}` });
  },
  deleteProject: (id) => set((state) => {
    const projects = readLocalProjects();
    const deleted = projects[id];
    delete projects[id];
    writeLocalProjects(projects);
    const list = localProjectList();
    if (state.project.id !== id) {
      return { projects: list, message: deleted ? `Deleted ${deleted.name}` : "Project deleted" };
    }
    const next = list[0] ? projects[list[0].id] : { ...newProjectFromTemplate("empty"), settings: { ...state.project.settings } };
    const selection: SelectionState = { kind: "none", nodeIds: [], networkId: next.networks[0]?.id || null };
    persist(next, selection, initialViewport);
    return { project: next, selection, viewport: initialViewport, projects: list, message: deleted ? `Deleted ${deleted.name}` : "Project deleted" };
  }),
  saveProject: () => {
    const now = new Date().toISOString();
    const current = get().project;
    const project = {
      ...current,
      id: current.id || uid("project"),
      createdAt: current.createdAt || now,
      updatedAt: now
    };
    const projects = readLocalProjects();
    projects[project.id] = project;
    writeLocalProjects(projects);
    persist(project, get().selection, get().viewport);
    set({ project, projects: localProjectList(), message: `Saved ${project.name}` });
  },
  importProject: (projectInput) => set((state) => {
    const project = normalizeProject(projectInput, emptyProject);
    const selection: SelectionState = { kind: "none", nodeIds: [], networkId: project.networks[0]?.id || null };
    persist(project, selection, initialViewport);
    return { project, selection, viewport: initialViewport };
  }),
  toggleInspector: () => set((state) => ({ inspectorCollapsed: !state.inspectorCollapsed }))
}));

// Keep TS happy for future connection handling extension.
void (undefined as Connection | undefined);
