import type { NodeProps } from "reactflow";
import { Wifi, Server, Router, Monitor } from "lucide-react";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import type { TopologyNetwork, TopologyNode } from "../types";
import { nodeNetworks } from "../lib/utils";

export function TopologyFlowNode({ data }: NodeProps<{ node: TopologyNode; selected: boolean }>) {
  const project = useWorkspaceStore((state) => state.project);
  const selectNode = useWorkspaceStore((state) => state.selectNode);
  const { node, selected } = data;
  const networks = nodeNetworks(project, node).map((network) => network.name).join(", ") || "unassigned";
  const Icon = node.kind === "access-point" ? Wifi : node.role === "router" ? Router : node.kind === "virtual-device" ? Monitor : Server;

  return (
    <button className={`flow-node ${node.role === "router" ? "router" : ""} ${selected ? "selected" : ""}`} onClick={(event) => {
      event.stopPropagation();
      selectNode(node.id, event.shiftKey);
    }}>
      <Icon className="flow-node-icon" size={25} />
      <span className="flow-node-title" title={node.name}>{node.name}</span>
      <span className="flow-node-meta" title={`${node.os} · ${node.role}`}>{node.os} · {node.role}</span>
      <span className="flow-node-meta" title={networks}>{networks}</span>
    </button>
  );
}

export function NetworkZoneNode({ data }: NodeProps<{ network: TopologyNetwork; width: number; height: number; selected: boolean }>) {
  const selectNetwork = useWorkspaceStore((state) => state.selectNetwork);
  const { network, width, height, selected } = data;
  return (
    <button
      className={`network-zone-node ${selected ? "selected" : ""}`}
      style={{ width, height }}
      onClick={(event) => {
        event.stopPropagation();
        selectNetwork(network.id);
      }}
    >
      <span>{network.name} · {network.cidr}</span>
    </button>
  );
}
