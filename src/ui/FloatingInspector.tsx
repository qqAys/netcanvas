import { Panel } from "reactflow";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { translate } from "../lib/i18n";

export function FloatingInspector() {
  const {
    project,
    selection,
    inspectorCollapsed,
    toggleInspector,
    updateNode,
    updateNetwork,
    joinSelectedToNetwork,
    createNetworkAndJoin,
    setRouterForSelection
  } = useWorkspaceStore();
  const t = (key: string, params?: Record<string, string | number>) => translate(project.settings.language, key, params);
  const selectedNode = project.nodes.find((node) => node.id === selection.nodeIds[0]);
  const selectedNetwork = project.networks.find((network) => network.id === selection.networkId);
  const title = selection.kind === "network"
    ? selectedNetwork?.name || t("network")
    : selection.kind === "multi-node"
      ? t("multiNodeSelection", { count: selection.nodeIds.length })
      : selectedNode?.name || t("nodes");

  if (selection.kind === "none") return null;

  return (
    <Panel position="top-right" className="floating-inspector">
      <div className="floating-head">
        <div>
          <strong>{t("inspector")}</strong>
          <span>{title}</span>
        </div>
        <button className="btn icon small" onClick={toggleInspector}>{inspectorCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
      </div>
      {!inspectorCollapsed && (
        <div className="floating-body">
          {selection.kind === "multi-node" && (
            <section className="inspector-section">
              <div className="subtle">{t("multiNodeSelection", { count: selection.nodeIds.length })}</div>
              <JoinControls />
            </section>
          )}
          {selection.kind === "node" && selectedNode && (
            <>
              <section className="inspector-section">
                <div className="section-label">{t("details")}</div>
                <div className="field">
                  <label>{t("nodeName")}</label>
                  <input value={selectedNode.name} onChange={(event) => updateNode(selectedNode.id, { name: event.target.value })} />
                </div>
                <div className="field">
                  <label>{t("os")}</label>
                  <input value={selectedNode.os} onChange={(event) => updateNode(selectedNode.id, { os: event.target.value })} />
                </div>
                <div className="field">
                  <label>{t("role")}</label>
                  <select value={selectedNode.role} onChange={(event) => updateNode(selectedNode.id, { role: event.target.value as "member" | "router" })}>
                    <option value="member">member</option>
                    <option value="router">router</option>
                  </select>
                </div>
              </section>
              <section className="inspector-section">
                <div className="section-label">{t("networkMembership")}</div>
                <JoinControls />
                <button className="btn small" onClick={setRouterForSelection}>{t("setRouter")}</button>
              </section>
            </>
          )}
          {selection.kind === "network" && selectedNetwork && (
            <section className="inspector-section">
                <div className="section-label">{t("details")}</div>
                <div className="field">
                  <label>{t("networkName")}</label>
                  <input value={selectedNetwork.name} onChange={(event) => updateNetwork(selectedNetwork.id, { name: event.target.value })} />
                </div>
                <div className="field">
                  <label>{t("cidr")}</label>
                  <input value={selectedNetwork.cidr} onChange={(event) => updateNetwork(selectedNetwork.id, { cidr: event.target.value })} />
                </div>
                <div className="field">
                  <label>{t("gateway")}</label>
                  <input value={selectedNetwork.gateway} onChange={(event) => updateNetwork(selectedNetwork.id, { gateway: event.target.value })} />
                </div>
                <div className="field">
                  <label>{t("routerHost")}</label>
                  <select value={selectedNetwork.routerNodeId || ""} onChange={(event) => updateNetwork(selectedNetwork.id, { routerNodeId: event.target.value || null })}>
                    <option value="">-</option>
                    {project.nodes.map((node) => <option value={node.id} key={node.id}>{node.name}</option>)}
                  </select>
                </div>
              </section>
          )}
        </div>
      )}
    </Panel>
  );

  function JoinControls() {
    const defaultNetwork = selection.networkId || project.networks[0]?.id || "";
    const [networkId, setNetworkId] = useState(defaultNetwork);
    if (!project.networks.length) return <div className="subtle">{t("noNetworks")}</div>;
    return (
      <div className="join-controls">
        <select value={networkId} onChange={(event) => setNetworkId(event.target.value)}>
          {project.networks.map((network) => <option value={network.id} key={network.id}>{network.name}</option>)}
        </select>
        <button className="btn small" onClick={() => joinSelectedToNetwork(networkId)}>{t("joinSelectedNetwork")}</button>
        <button className="btn small" onClick={createNetworkAndJoin}>{t("newNetworkAndJoin")}</button>
      </div>
    );
  }
}
