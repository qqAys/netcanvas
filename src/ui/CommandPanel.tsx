import * as Switch from "@radix-ui/react-switch";
import type { CommandBlock, CommandMode, CommandTemplate, Language, RouteResult, SafetyCheck, TopologyNode } from "../types";
import { translate } from "../lib/i18n";

interface Props {
  commands: CommandBlock[];
  checks: SafetyCheck[];
  route: RouteResult;
  nodes: TopologyNode[];
  simulation: {
    from: string | null;
    to: string | null;
  };
  commandMode: CommandMode;
  commandTemplate: CommandTemplate;
  useSudo: boolean;
  language: Language;
  onModeChange: (mode: CommandMode) => void;
  onCommandTemplateChange: (template: CommandTemplate) => void;
  onUseSudoChange: (value: boolean) => void;
  onSimulationChange: (key: "from" | "to", value: string | null) => void;
}

export function CommandPanel({
  commands,
  checks,
  route,
  nodes,
  simulation,
  commandMode,
  commandTemplate,
  useSudo,
  language,
  onModeChange,
  onCommandTemplateChange,
  onUseSudoChange,
  onSimulationChange
}: Props) {
  const t = (key: string) => translate(language, key);
  const commandTemplateOptions: Array<{ value: CommandTemplate; label: string }> = commandMode === "persistent"
    ? [
        { value: "systemd-networkd", label: "systemd-networkd" },
        { value: "NetworkManager", label: "NetworkManager" }
      ]
    : [
        { value: "iproute2-bridge", label: "iproute2-bridge" },
        { value: "NetworkManager", label: "NetworkManager" }
      ];
  const selectedCommandTemplate = commandTemplateOptions.some((option) => option.value === commandTemplate) ? commandTemplate : commandTemplateOptions[0].value;

  return (
    <aside className="inspector">
      <section className="panel command-panel">
        <div className="panel-title">
          <h2>{t("commandPlan")}</h2>
          <span className={`pill ${commandMode === "persistent" ? "good" : "warn"}`}>{t(commandMode)}</span>
        </div>
        <div className="field">
          <label>{t("commandMode")}</label>
          <div className="segmented">
            <button className={commandMode === "persistent" ? "active" : ""} onClick={() => onModeChange("persistent")}>{t("persistent")}</button>
            <button className={commandMode === "temporary" ? "active" : ""} onClick={() => onModeChange("temporary")}>{t("temporary")}</button>
          </div>
        </div>
        <div className="switch-row">
          <span>{t("useSudo")}</span>
          <Switch.Root className="switch-root" checked={useSudo} onCheckedChange={onUseSudoChange}>
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
        </div>
        <div className="field">
          <label>{t("commandTemplate")}</label>
          <select value={selectedCommandTemplate} onChange={(event) => onCommandTemplateChange(event.target.value as CommandTemplate)}>
            {commandTemplateOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="command-list">
          {commands.map((command, index) => (
            <article className="command" key={`${command.host}-${command.title}-${index}`}>
              <div className="command-head">
                <strong>{command.host} · {command.title}</strong>
                <span className="pill">{command.permission}</span>
              </div>
              <div className="command-body">
                {command.warning && <div className="warning">{command.warning}</div>}
                <pre>{command.commands.join("\n")}</pre>
                <div className="note">{command.note}</div>
                <details>
                  <summary className="subtle">{t("rollback")}</summary>
                  <pre>{command.rollback.join("\n")}</pre>
                </details>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>{t("safetyChecks")}</h2>
          <span className={`pill ${checks.some((check) => check.level === "bad") ? "bad" : checks.some((check) => check.level === "warn") ? "warn" : "good"}`}>{checks.length}</span>
        </div>
        <div className="check-list">
          {checks.map((check, index) => (
            <div className={`check ${check.level}`} key={`${check.title}-${index}`}>
              <span>{check.level === "good" ? "✓" : check.level === "warn" ? "!" : "×"}</span>
              <div><strong>{check.title}</strong><span>{check.body}</span></div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>{t("routeSimulation")}</h2>
          <span className={`pill ${route.ok ? "good" : "bad"}`}>{route.ok ? t("routeOk") : t("noRoute")}</span>
        </div>
        <div className="route-controls">
          <div className="field compact">
            <label>{t("routeFrom")}</label>
            <select value={simulation.from || ""} onChange={(event) => onSimulationChange("from", event.target.value || null)}>
              <option value="">-</option>
              {nodes.map((node) => <option value={node.id} key={node.id}>{node.name}</option>)}
            </select>
          </div>
          <div className="field compact">
            <label>{t("routeTo")}</label>
            <select value={simulation.to || ""} onChange={(event) => onSimulationChange("to", event.target.value || null)}>
              <option value="">-</option>
              {nodes.map((node) => <option value={node.id} key={node.id}>{node.name}</option>)}
            </select>
          </div>
        </div>
        <div className="route-result">{route.message}</div>
      </section>
    </aside>
  );
}
