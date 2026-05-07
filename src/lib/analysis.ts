import type { NetCanvasProject, RouteResult, SafetyCheck } from "../types";
import { nodeNetworks } from "./utils";
import { translate } from "./i18n";

export function validateProject(project: NetCanvasProject): SafetyCheck[] {
  const t = (key: string) => translate(project.settings.language, key);
  const checks: SafetyCheck[] = [];
  const cidrs = new Map<string, string>();

  for (const network of project.networks) {
    if (cidrs.has(network.cidr)) {
      checks.push({ level: "bad", title: t("cidrDuplicated"), body: `${network.name} overlaps with ${cidrs.get(network.cidr)}.` });
    } else {
      cidrs.set(network.cidr, network.name);
    }
    if (!network.routerNodeId || !project.nodes.some((node) => node.id === network.routerNodeId)) {
      checks.push({ level: "bad", title: t("routerMissing"), body: `${network.name} has no router host assigned.` });
    }
    if (!network.gateway) {
      checks.push({ level: "warn", title: t("gatewayMissing"), body: `${network.name} should define a gateway address.` });
    }
  }

  for (const node of project.nodes) {
    const names = new Set<string>();
    for (const iface of node.interfaces) {
      if (names.has(iface.name)) {
        checks.push({ level: "warn", title: t("ifaceDuplicated"), body: `${node.name} uses ${iface.name} more than once.` });
      }
      names.add(iface.name);
      if (!project.networks.some((network) => network.id === iface.networkId)) {
        checks.push({ level: "bad", title: t("unknownNetwork"), body: `${node.name} references ${iface.networkId}.` });
      }
    }
  }

  if (!checks.length) {
    checks.push({ level: "good", title: t("checksPassed"), body: t("checksPassedBody") });
  }
  return checks;
}

export function simulateRoute(project: NetCanvasProject): RouteResult {
  const tr = (key: string, params?: Record<string, string>) => translate(project.settings.language, key, params);
  const fromId = project.simulation.from;
  const toId = project.simulation.to;
  if (!fromId || !toId) return { ok: false, message: tr("chooseEndpoints") };
  if (fromId === toId) return { ok: true, message: tr("sameNode") };

  const from = project.nodes.find((node) => node.id === fromId);
  const to = project.nodes.find((node) => node.id === toId);
  if (!from || !to) return { ok: false, message: tr("chooseEndpoints") };

  const connectedNetworks = (node: typeof from) => {
    const networks = nodeNetworks(project, node);
    for (const network of project.networks) {
      if (network.routerNodeId === node.id && !networks.some((item) => item.id === network.id)) {
        networks.push(network);
      }
    }
    return networks;
  };

  const fromNetworks = connectedNetworks(from);
  const toNetworks = connectedNetworks(to);
  const direct = fromNetworks.find((network) => toNetworks.some((candidate) => candidate.id === network.id));
  if (direct) {
    return { ok: true, message: tr("directRoute", { from: from.name, to: to.name, network: direct.name }) };
  }

  for (const router of project.nodes.filter((node) => node.role === "router")) {
    const routerNetworkIds = new Set(connectedNetworks(router).map((network) => network.id));
    if (routerNetworkIds.size < 2) continue;
    const entry = fromNetworks.find((network) => routerNetworkIds.has(network.id));
    const exit = toNetworks.find((network) => routerNetworkIds.has(network.id));
    if (entry && exit) {
      return { ok: true, message: tr("routedRoute", { from: from.name, to: to.name, router: router.name, entry: entry.name, exit: exit.name }) };
    }
  }

  return { ok: false, message: tr("noRouteMessage", { from: from.name, to: to.name }) };
}
