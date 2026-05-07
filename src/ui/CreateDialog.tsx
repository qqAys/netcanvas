import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { translate } from "../lib/i18n";
import type { NodeKind, NodeRole } from "../types";

export function CreateDialog() {
  const { createDialogType, closeCreateDialog, createNode, createNetwork, project } = useWorkspaceStore();
  const t = (key: string, params?: Record<string, string>) => translate(project.settings.language, key, params);
  const [name, setName] = useState("");
  const [os, setOs] = useState("Debian 12");
  const [cidr, setCidr] = useState("10.40.0.0/24");
  const [gateway, setGateway] = useState("10.40.0.1");
  const [routerNodeId, setRouterNodeId] = useState<string>("none");

  useEffect(() => {
    if (!createDialogType) return;
    const count = project.nodes.length + project.networks.length + 1;
    if (createDialogType === "network") {
      setName(`br-net-${project.networks.length + 1}`);
      setCidr(`10.${40 + project.networks.length}.0.0/24`);
      setGateway(`10.${40 + project.networks.length}.0.1`);
      setRouterNodeId("none");
    } else {
      setName(createDialogType === "router" ? `router-${count}` : createDialogType === "access-point" ? `ap-${count}` : `host-${count}`);
      setOs(createDialogType === "access-point" ? "AP" : "Debian 12");
    }
  }, [createDialogType, project.networks.length, project.nodes.length]);

  const isNetwork = createDialogType === "network";
  const typeLabel = isNetwork ? t("network") : createDialogType === "router" ? t("router") : createDialogType === "access-point" ? t("accessPoint") : t("host");

  function submit() {
    if (!createDialogType || !name.trim()) return;
    if (isNetwork) {
      createNetwork({ name: name.trim(), cidr: cidr.trim(), gateway: gateway.trim(), routerNodeId: routerNodeId === "none" ? null : routerNodeId });
      return;
    }
    const kind: NodeKind = createDialogType === "access-point" ? "access-point" : "linux-host";
    const role: NodeRole = createDialogType === "router" ? "router" : "member";
    createNode({ kind, role, name: name.trim(), os: os.trim() || "Debian 12" });
  }

  return (
    <Dialog.Root open={Boolean(createDialogType)} onOpenChange={(open) => !open && closeCreateDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title>{t("createItem", { type: typeLabel })}</Dialog.Title>
          <Dialog.Description className="dialog-copy">Configure the object before adding it to the topology.</Dialog.Description>
          <div className="field">
            <label>{isNetwork ? t("networkName") : t("nodeName")}</label>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          {isNetwork ? (
            <>
              <div className="field">
                <label>{t("cidr")}</label>
                <input value={cidr} onChange={(event) => setCidr(event.target.value)} />
              </div>
              <div className="field">
                <label>{t("gateway")}</label>
                <input value={gateway} onChange={(event) => setGateway(event.target.value)} />
              </div>
              <div className="field">
                <label>{t("routerHost")}</label>
                <Select.Root value={routerNodeId} onValueChange={setRouterNodeId}>
                  <Select.Trigger className="select-trigger"><Select.Value /></Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="select-content">
                      <Select.Item className="select-item" value="none">-</Select.Item>
                      {project.nodes.map((node) => <Select.Item className="select-item" value={node.id} key={node.id}>{node.name}</Select.Item>)}
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
            </>
          ) : (
            <div className="field">
              <label>{t("os")}</label>
              <input value={os} onChange={(event) => setOs(event.target.value)} />
            </div>
          )}
          <div className="dialog-actions">
            <Dialog.Close asChild><button className="btn">Cancel</button></Dialog.Close>
            <button className="btn primary" onClick={submit}>{t("create")}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
