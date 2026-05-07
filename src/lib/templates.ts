import type { NetCanvasProject } from "../types";
import { iface, topologyNetwork, topologyNode, uid } from "./utils";

export const emptyProject: NetCanvasProject = {
  id: "untitled",
  name: "Untitled NetCanvas Project",
  description: "Empty virtual network planning workspace",
  version: 1,
  commandMode: "persistent",
  commandTemplate: "systemd-networkd",
  settings: {
    useSudo: true,
    language: "en"
  },
  simulation: { from: null, to: null },
  share: { enabled: false, shareId: null, readOnly: true, expiresAt: null },
  nodes: [],
  networks: []
};

export const templates: Record<string, NetCanvasProject> = {
  empty: emptyProject,
  bridge: {
    ...emptyProject,
    id: "netcanvas-lab",
    name: "Linux Bridge Lab",
    description: "Linux bridge planning workspace",
    simulation: { from: "host-debian-01", to: "vm-build-01" },
    nodes: [
      topologyNode("host-router-01", "host-router-01", "linux-host", "Debian 12", "router", 420, 200, [
        iface("net-lab", "br-lab", "10.20.0.1/24", true),
        iface("net-build", "br-build", "10.30.0.1/24", true)
      ]),
      topologyNode("host-debian-01", "host-debian-01", "linux-host", "Debian 12", "member", 190, 250, [
        iface("net-lab", "eth1", "10.20.0.11/24", false, "10.20.0.1")
      ]),
      topologyNode("vm-build-01", "vm-build-01", "virtual-device", "Ubuntu VM", "member", 650, 335, [
        iface("net-build", "eth1", "10.30.0.21/24", false, "10.30.0.1")
      ]),
      topologyNode("ap-test-01", "ap-test-01", "access-point", "AP", "member", 180, 440, [
        iface("net-lab", "wlan0", "10.20.0.31/24", false, "10.20.0.1")
      ])
    ],
    networks: [
      topologyNetwork("net-lab", "br-lab", "10.20.0.0/24", "10.20.0.1", "host-router-01", "teal"),
      topologyNetwork("net-build", "br-build", "10.30.0.0/24", "10.30.0.1", "host-router-01", "amber")
    ]
  },
  routed: {
    ...emptyProject,
    id: "routed-dual-network",
    name: "Routed Dual Network",
    description: "Two bridge networks connected through a router host",
    simulation: { from: "client-a", to: "server-b" },
    nodes: [
      topologyNode("router-core", "router-core", "linux-host", "Debian 12", "router", 430, 240, [
        iface("net-a", "br-a", "172.18.10.1/24", true),
        iface("net-b", "br-b", "172.18.20.1/24", true)
      ]),
      topologyNode("client-a", "client-a", "linux-host", "Ubuntu 24.04", "member", 180, 210, [
        iface("net-a", "eth1", "172.18.10.21/24", false, "172.18.10.1")
      ]),
      topologyNode("server-b", "server-b", "linux-host", "Debian 12", "member", 690, 330, [
        iface("net-b", "eth1", "172.18.20.41/24", false, "172.18.20.1")
      ])
    ],
    networks: [
      topologyNetwork("net-a", "br-a", "172.18.10.0/24", "172.18.10.1", "router-core", "teal"),
      topologyNetwork("net-b", "br-b", "172.18.20.0/24", "172.18.20.1", "router-core", "amber")
    ]
  }
};

export function newProjectFromTemplate(templateId: string): NetCanvasProject {
  const template = templates[templateId] || templates.empty;
  const project = structuredClone(template);
  if (templateId === "empty") {
    project.id = uid("project");
    project.name = "Untitled NetCanvas Project";
  }
  return project;
}
