import * as Dialog from "@radix-ui/react-dialog";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { translate } from "../lib/i18n";

const templateCards = [
  ["empty", "emptyCanvas"],
  ["bridge", "linuxBridgeLab"],
  ["routed", "routedDualNetwork"]
] as const;

export function TemplateDialog() {
  const { showTemplateDialog, closeTemplateDialog, loadTemplate, project } = useWorkspaceStore();
  const t = (key: string) => translate(project.settings.language, key);
  return (
    <Dialog.Root open={showTemplateDialog} onOpenChange={(open) => !open && closeTemplateDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content wide">
          <Dialog.Title>{t("chooseTemplate")}</Dialog.Title>
          <Dialog.Description className="dialog-copy">{t("chooseTemplateBody")}</Dialog.Description>
          <div className="template-grid">
            {templateCards.map(([id, label]) => (
              <button className="template-card" key={id} onClick={() => loadTemplate(id)}>
                <strong>{t(label)}</strong>
                <span>{id === "empty" ? t("emptyStateBody") : id === "bridge" ? "Linux bridge with router host and two networks." : "Two routed bridge networks."}</span>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
