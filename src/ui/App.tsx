import { useEffect, useMemo, useRef } from "react";
import ReactFlow, { Background, Controls, MiniMap, Panel, ReactFlowProvider, useReactFlow } from "reactflow";
import type { NodeTypes } from "reactflow";
import { Save, Upload, Download, Plus, Trash2, LayoutTemplate } from "lucide-react";
import { useWorkspaceStore, projectToFlow } from "../store/useWorkspaceStore";
import { translate } from "../lib/i18n";
import { generateCommands } from "../lib/commands";
import { simulateRoute, validateProject } from "../lib/analysis";
import { CreateDialog } from "./CreateDialog";
import { TemplateDialog } from "./TemplateDialog";
import { FloatingInspector } from "./FloatingInspector";
import { CommandPanel } from "./CommandPanel";
import { Sidebar } from "./Sidebar";
import { NetworkZoneNode, TopologyFlowNode } from "./FlowNodes";

const nodeTypes: NodeTypes = {
  topologyNode: TopologyFlowNode,
  networkZone: NetworkZoneNode
};

function Workspace() {
  const {
    project,
    selection,
    viewport,
    message,
    setViewport,
    setProjectName,
    newProject,
    openTemplateDialog,
    openCreateDialog,
    deleteSelected,
    setCommandMode,
    setCommandTemplate,
    setUseSudo,
    setLanguage,
    setSimulation,
    saveProject,
    refreshProjects,
    onNodesChange,
    setSelectionFromFlow
  } = useWorkspaceStore();
  const reactFlow = useReactFlow();
  const fileInput = useRef<HTMLInputElement>(null);
  const lastFittedKey = useRef<string | null>(null);
  const fitKey = `${project.id}:${project.nodes.length}:${project.networks.length}`;
  const t = (key: string, params?: Record<string, string | number>) => translate(project.settings.language, key, params);
  const flow = useMemo(() => projectToFlow(project, selection), [project, selection]);
  const commands = useMemo(() => generateCommands(project), [project]);
  const checks = useMemo(() => validateProject(project), [project]);
  const route = useMemo(() => simulateRoute(project), [project]);

  function changeCommandMode(mode: typeof project.commandMode) {
    if (mode === "persistent" && project.commandTemplate === "iproute2-bridge") {
      setCommandTemplate("systemd-networkd");
    }
    if (mode === "temporary" && project.commandTemplate === "systemd-networkd") {
      setCommandTemplate("iproute2-bridge");
    }
    setCommandMode(mode);
  }

  function changeCommandTemplate(template: typeof project.commandTemplate) {
    if (template === "iproute2-bridge" && project.commandMode === "persistent") {
      setCommandMode("temporary");
    }
    setCommandTemplate(template);
  }

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    document.documentElement.lang = project.settings.language;
  }, [project.settings.language]);

  useEffect(() => {
    if (project.commandMode === "persistent" && project.commandTemplate === "iproute2-bridge") {
      setCommandTemplate("systemd-networkd");
    }
    if (project.commandMode === "temporary" && project.commandTemplate === "systemd-networkd") {
      setCommandTemplate("iproute2-bridge");
    }
  }, [project.commandMode, project.commandTemplate, setCommandTemplate]);

  useEffect(() => {
    if (!project.nodes.length && !project.networks.length) return;
    if (lastFittedKey.current === fitKey) return;
    lastFittedKey.current = fitKey;
    let frame = 0;
    let nestedFrame = 0;
    let timeout = 0;
    const fit = () => void reactFlow.fitView({ padding: 0.18, duration: 0 });
    frame = window.requestAnimationFrame(() => {
      nestedFrame = window.requestAnimationFrame(fit);
    });
    timeout = window.setTimeout(fit, 120);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(nestedFrame);
      window.clearTimeout(timeout);
    };
  }, [fitKey, reactFlow, project.nodes.length, project.networks.length]);

  function onImportFile(file: File | undefined) {
    if (!file) return;
    file
      .text()
      .then((text) => useWorkspaceStore.getState().importProject(JSON.parse(text)))
      .catch((error) => console.error("Import failed", error));
  }

  function exportProject() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">NC</div>
          <div>
            <div className="brand-title">NetCanvas</div>
            <div className="brand-subtitle">{t("appSubtitle")}</div>
          </div>
        </div>
        <div className="project-title">
          <input value={project.name} onChange={(event) => setProjectName(event.target.value)} aria-label="Project name" />
        </div>
        <div className="top-actions">
          <button className="btn" onClick={openTemplateDialog}><LayoutTemplate size={15} />{t("templates")}</button>
          <button className="btn" onClick={newProject}><Plus size={15} />{t("new")}</button>
          <button className="btn" onClick={() => void saveProject()}><Save size={15} />{t("save")}</button>
          <button className="btn" onClick={exportProject}><Download size={15} />{t("export")}</button>
          <button className="btn" onClick={() => fileInput.current?.click()}><Upload size={15} />{t("import")}</button>
          <select value={project.settings.language} onChange={(event) => setLanguage(event.target.value as "en" | "zh-CN")}>
            <option value="en">EN</option>
            <option value="zh-CN">简体中文</option>
          </select>
        </div>
      </header>

      <main className="workspace">
        <Sidebar />
        <section className="canvas-wrap">
          <div className="canvas-toolbar">
            <div>
              <h1>{t("virtualTopology")}</h1>
              <div className="subtle">
                {selection.kind === "network" ? project.networks.find((item) => item.id === selection.networkId)?.name : `${selection.nodeIds.length} selected`}
              </div>
            </div>
            <div className="button-row">
              <button className="btn small" onClick={() => openCreateDialog("linux-host")}>{t("host")}</button>
              <button className="btn small" onClick={() => openCreateDialog("router")}>{t("router")}</button>
              <button className="btn small" onClick={() => openCreateDialog("access-point")}>{t("accessPoint")}</button>
              <button className="btn small" onClick={() => openCreateDialog("network")}>{t("network")}</button>
              <button className="btn small danger" onClick={deleteSelected}><Trash2 size={14} />{t("deleteSelected")}</button>
            </div>
          </div>

          <div className="flow-shell">
            <ReactFlow
              nodes={flow.nodes}
              edges={flow.edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onSelectionChange={({ nodes }) => setSelectionFromFlow(nodes)}
              onMoveEnd={(_, nextViewport) => setViewport(nextViewport)}
              defaultViewport={viewport}
              minZoom={0.25}
              maxZoom={3}
              selectNodesOnDrag={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#d9e1e7" gap={28} />
              <Controls position="bottom-left" />
              <MiniMap position="bottom-right" pannable zoomable />
              <Panel position="top-left" className="status-panel">{message || t("ready")}</Panel>
              <FloatingInspector />
              {!project.nodes.length && !project.networks.length && (
                <Panel position="top-center" className="empty-canvas-panel">
                  <strong>{t("emptyStateTitle")}</strong>
                  <span>{t("emptyStateBody")}</span>
                </Panel>
              )}
            </ReactFlow>
          </div>
        </section>
        <CommandPanel
          commands={commands}
          checks={checks}
          route={route}
          nodes={project.nodes}
          simulation={project.simulation}
          commandMode={project.commandMode}
          commandTemplate={project.commandTemplate}
          useSudo={project.settings.useSudo}
          language={project.settings.language}
          onModeChange={changeCommandMode}
          onCommandTemplateChange={changeCommandTemplate}
          onUseSudoChange={setUseSudo}
          onSimulationChange={setSimulation}
        />
      </main>
      <TemplateDialog />
      <CreateDialog />
      <input ref={fileInput} className="hidden-file" type="file" accept="application/json" onChange={(event) => onImportFile(event.target.files?.[0])} />
    </div>
  );
}

export function App() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  );
}
