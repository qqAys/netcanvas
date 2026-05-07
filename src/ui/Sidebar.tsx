import { Trash2 } from "lucide-react";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { translate } from "../lib/i18n";
import { networkMembers } from "../lib/utils";

export function Sidebar() {
  const {
    project,
    projects,
    selection,
    selectNetwork,
    selectNode,
    refreshProjects,
    loadProject,
    deleteProject
  } = useWorkspaceStore();
  const t = (key: string) => translate(project.settings.language, key);
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <section className="panel">
          <div className="panel-title">
            <h2>{t("networks")}</h2>
            <span className="pill">{project.networks.length}</span>
          </div>
          <div className="list">
            {project.networks.map((network) => (
              <button className={`list-item ${selection.networkId === network.id ? "active" : ""}`} key={network.id} onClick={() => selectNetwork(network.id)}>
                <span>
                  <strong>{network.name}</strong>
                  <span>{network.cidr} · router {network.routerNodeId || "unset"}</span>
                </span>
                <span className="pill">{networkMembers(project, network.id).length}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <h2>{t("nodes")}</h2>
            <span className="pill">{project.nodes.length}</span>
          </div>
          <div className="list">
            {project.nodes.map((node) => (
              <button className={`list-item ${selection.nodeIds.includes(node.id) ? "active" : ""}`} key={node.id} onClick={() => selectNode(node.id)}>
                <span>
                  <strong>{node.name}</strong>
                  <span>{node.os} · {node.role}</span>
                </span>
                <span className="pill">{node.interfaces.length}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="panel saved-projects-panel">
        <div className="panel-title">
          <h2>{t("savedProjects")}</h2>
          <button className="btn small" onClick={() => void refreshProjects()}>{t("refresh")}</button>
        </div>
        <div className="list saved-project-list">
          {projects.length ? projects.map((item) => (
            <div className={`list-item project-list-item ${item.id === project.id ? "active" : ""}`} key={item.id}>
              <button className="project-load" onClick={() => loadProject(item.id)}>
                <strong>{item.name}</strong>
                <span>{formatTime(item.updatedAt)}</span>
              </button>
              <button className="btn icon small danger" aria-label={`${t("deleteProject")} ${item.name}`} onClick={() => deleteProject(item.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          )) : <div className="subtle">{t("noSavedProjects")}</div>}
        </div>
      </section>
    </aside>
  );
}

function formatTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
