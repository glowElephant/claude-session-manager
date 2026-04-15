import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ipc } from "@/lib/ipc";
import type { Locale } from "@/i18n";
import type { Settings } from "@/types";

interface Props {
  open: boolean;
  current: Settings;
  locale: Locale;
  t: (k: string, p?: Record<string, string | number>) => string;
  onClose: () => void;
  onSaved: () => void;
}

export function SettingsDialog({ open, current, locale, t, onClose, onSaved }: Props) {
  const [chosenLocale, setChosenLocale] = useState<string>(locale);
  const [cloudPath, setCloudPath] = useState<string>(current.cloudPath || "");
  const [apiKey, setApiKey] = useState<string>(current.anthropicApiKey || "");

  useEffect(() => {
    if (open) {
      setChosenLocale(current.locale || locale);
      setCloudPath(current.cloudPath || "");
      setApiKey(current.anthropicApiKey || "");
    }
  }, [open, current, locale]);

  async function pickFolder() {
    const result = await openDialog({ directory: true, multiple: false });
    if (typeof result === "string") {
      const saved = await ipc.setCloudFolder(result);
      setCloudPath(saved);
    }
  }

  async function save() {
    await ipc.saveSettings({
      locale: chosenLocale,
      cloudPath: cloudPath || null,
      anthropicApiKey: apiKey || null,
    });
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("settings.title") !== "settings.title" ? t("settings.title") : "Settings"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>{t("settings.language") !== "settings.language" ? t("settings.language") : "Language"}</Label>
            <div className="flex gap-2">
              {(["en", "ko"] as const).map((l) => (
                <Button
                  key={l}
                  variant={chosenLocale === l ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChosenLocale(l)}
                >
                  {l.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("gdrive.setupTitle") !== "gdrive.setupTitle" ? t("gdrive.setupTitle") : "Cloud folder"}</Label>
            <div className="flex gap-2">
              <Input
                value={cloudPath}
                onChange={(e) => setCloudPath(e.target.value)}
                placeholder="G:/My Drive/Claude Sessions"
                readOnly
              />
              <Button variant="outline" onClick={pickFolder}>Browse</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Any cloud-synced folder (Google Drive, OneDrive, Dropbox…)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Anthropic API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
            <p className="text-xs text-muted-foreground">
              Used to generate one-line session summaries via Claude Haiku.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
