import type { CommandBlock, NetCanvasProject, TopologyNetwork, TopologyNode } from "../types";
import { translate } from "./i18n";

function withSudo(command: string, useSudo: boolean): string {
  if (!useSudo || command.startsWith("#") || command.trim() === "" || command.includes("<<'EOF'") || command === "EOF") {
    return command;
  }
  return command.startsWith("sudo ") ? command : `sudo ${command}`;
}

function formatCommands(commands: string[], useSudo: boolean): string[] {
  return commands.map((command) => withSudo(command, useSudo));
}

function permission(project: NetCanvasProject, suffix = ""): string {
  const base = project.settings.useSudo
    ? translate(project.settings.language, "sudoRoot")
    : translate(project.settings.language, "rootShell");
  return suffix ? `${base} + ${suffix}` : base;
}

function hostPlan(
  project: NetCanvasProject,
  host: string,
  title: string,
  commands: string[],
  rollback: string[],
  note: string,
  suffix = "",
  warning?: string
): CommandBlock {
  return {
    host,
    title,
    permission: permission(project, suffix),
    commands: formatCommands(commands, project.settings.useSudo),
    rollback: formatCommands(rollback, project.settings.useSudo),
    note,
    warning
  };
}

function routerFor(project: NetCanvasProject, network: TopologyNetwork): TopologyNode | undefined {
  return project.nodes.find((node) => node.id === network.routerNodeId);
}

function iprouteBridgePlan(project: NetCanvasProject, network: TopologyNetwork, router: TopologyNode, note: string, warning?: string): CommandBlock {
  return hostPlan(
    project,
    router.name,
    `iproute2 bridge ${network.name}`,
    [
      `ip link add name ${network.name} type bridge`,
      `ip addr add ${network.gateway}/24 dev ${network.name}`,
      `ip link set ${network.name} up`,
      "sysctl -w net.ipv4.ip_forward=1"
    ],
    [
      `ip link set ${network.name} down`,
      `ip link delete ${network.name} type bridge`
    ],
    note,
    "",
    warning
  );
}

function networkdMemberCommands(node: TopologyNode, network: TopologyNetwork, iface: TopologyNode["interfaces"][number]): string[] {
  return [
    `tee /etc/systemd/network/30-${node.name}-${iface.name}.network >/dev/null <<'EOF'`,
    "[Match]",
    `Name=${iface.name}`,
    "",
    "[Network]",
    `Address=${iface.address}`,
    iface.via ? `Gateway=${iface.via}` : `Gateway=${network.gateway}`,
    "EOF",
    "systemctl restart systemd-networkd"
  ];
}

function nmMemberCommands(network: TopologyNetwork, iface: TopologyNode["interfaces"][number], temporary: boolean): string[] {
  const connection = temporary ? `${iface.name}-temp` : iface.name;
  return [
    `nmcli connection add type ethernet ifname ${iface.name} con-name ${connection}`,
    `nmcli connection modify ${connection} ipv4.addresses ${iface.address} ipv4.gateway ${iface.via || network.gateway} ipv4.method manual${temporary ? " connection.autoconnect no" : ""}`,
    `nmcli connection up ${connection}`
  ];
}

function nmPlan(project: NetCanvasProject, network: TopologyNetwork, router: TopologyNode, temporary: boolean): CommandBlock {
  const commands = temporary
    ? [
        `nmcli connection add type bridge ifname ${network.name} con-name ${network.name}-temp`,
        `nmcli connection modify ${network.name}-temp ipv4.addresses ${network.gateway}/24 ipv4.method manual connection.autoconnect no`,
        `nmcli connection up ${network.name}-temp`
      ]
    : [
        `nmcli connection add type bridge ifname ${network.name} con-name ${network.name}`,
        `nmcli connection modify ${network.name} ipv4.addresses ${network.gateway}/24 ipv4.method manual`,
        `nmcli connection up ${network.name}`
      ];
  const connection = temporary ? `${network.name}-temp` : network.name;
  return hostPlan(
    project,
    router.name,
    `NetworkManager ${temporary ? "temporary" : "profile"} ${network.name}`,
    commands,
    [`nmcli connection down ${connection}`, `nmcli connection delete ${connection}`],
    translate(project.settings.language, "nmNote"),
    "NetworkManager"
  );
}

function networkdPlan(project: NetCanvasProject, network: TopologyNetwork, router: TopologyNode): CommandBlock {
  return hostPlan(
    project,
    router.name,
    `systemd-networkd bridge ${network.name}`,
    [
      `tee /etc/systemd/network/20-${network.name}.netdev >/dev/null <<'EOF'`,
      "[NetDev]",
      `Name=${network.name}`,
      "Kind=bridge",
      "EOF",
      `tee /etc/systemd/network/21-${network.name}.network >/dev/null <<'EOF'`,
      "[Match]",
      `Name=${network.name}`,
      "",
      "[Network]",
      `Address=${network.gateway}/24`,
      "IPForward=yes",
      "EOF",
      "systemctl restart systemd-networkd"
    ],
    [
      `rm /etc/systemd/network/20-${network.name}.netdev`,
      `rm /etc/systemd/network/21-${network.name}.network`,
      "systemctl restart systemd-networkd"
    ],
    translate(project.settings.language, "networkdNote"),
    "systemd-networkd"
  );
}

export function generateCommands(project: NetCanvasProject): CommandBlock[] {
  const blocks: CommandBlock[] = [];
  const temporary = project.commandMode === "temporary";
  const t = (key: string) => translate(project.settings.language, key);

  for (const network of project.networks) {
    const router = routerFor(project, network);
    if (!router) continue;

    if (temporary && project.commandTemplate === "systemd-networkd") {
      blocks.push(iprouteBridgePlan(project, network, router, t("tempNote"), t("networkdTemporaryWarning")));
    } else if (project.commandTemplate === "iproute2-bridge") {
      blocks.push(iprouteBridgePlan(project, network, router, t("tempNote")));
    } else if (project.commandTemplate === "NetworkManager") {
      blocks.push(nmPlan(project, network, router, temporary));
    } else {
      blocks.push(networkdPlan(project, network, router));
    }
  }

  for (const node of project.nodes.filter((candidate) => candidate.role !== "router")) {
    for (const iface of node.interfaces) {
      const network = project.networks.find((candidate) => candidate.id === iface.networkId);
      if (!network) continue;
      const temporaryCommands = project.commandTemplate === "NetworkManager"
        ? nmMemberCommands(network, iface, true)
        : [
            `ip addr add ${iface.address} dev ${iface.name}`,
            `ip link set ${iface.name} up`,
            iface.via ? `ip route add ${network.cidr} via ${iface.via}` : "# same subnet route is direct"
          ];
      const persistentCommands = project.commandTemplate === "NetworkManager"
        ? nmMemberCommands(network, iface, false)
        : networkdMemberCommands(node, network, iface);

      blocks.push(hostPlan(
        project,
        node.name,
        `join ${network.name}`,
        temporary ? temporaryCommands : persistentCommands,
        [
          `ip addr del ${iface.address} dev ${iface.name}`,
          iface.via ? `ip route del ${network.cidr} via ${iface.via}` : "# no route rollback needed"
        ],
        t("memberNote")
      ));
    }
  }

  return blocks;
}
