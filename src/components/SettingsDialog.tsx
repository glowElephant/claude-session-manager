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
import type { EnvironmentReport, Settings, TerminalKind } from "@/types";

interface Props {
  open: boolean;
  current: Settings;
  locale: Locale;
  t: (k: string, p?: Record<string, string | number>) => string;
  onClose: () => void;
  onSaved: () => void;
}

const ALL_TERMINAL_OPTIONS: Array<{ value: "auto" | TerminalKind; labelKey: string; defaultLabel: string }> = [
  { value: "auto", labelKey: "settings.auto", defaultLabel: "Auto" },
  { value: "git-bash", labelKey: "", defaultLabel: "Git Bash" },
  { value: "wt", labelKey: "", defaultLabel: "Windows Terminal" },
  { value: "powershell", labelKey: "", defaultLabel: "PowerShell" },
  { value: "cmd", labelKey: "", defaultLabel: "Command Prompt" },
  { value: "terminal", labelKey: "", defaultLabel: "Terminal.app" },
];

function tx(t: Props["t"], key: string, fallback: string) {
  const v = t(key);
  return v === key ? fallback : v;
}

export function SettingsDialog({ open, current, locale, t, onClose, onSaved }: Props) {
  const [chosenLocale, setChosenLocale] = useState<string>(locale);
  const [cloudPath, setCloudPath] = useState<string>(current.cloudPath || "");
  const [apiKey, setApiKey] = useState<string>(current.anthropicApiKey || "");
  const [terminal, setTerminal] = useState<string>(current.preferredTerminal || "auto");
  const [report, setReport] = useState<EnvironmentReport | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setChosenLocale(current.locale || locale);
      setCloudPath(current.cloudPath || "");
      setApiKey(current.anthropicApiKey || "");
      setTerminal(current.preferredTerminal || "auto");
      setReport(null);
    }
  }, [open, current, locale]);

  async function pickFolder() {
    const result = await openDialog({ directory: true, multiple: false });
    if (typeof result === "string") {
      const saved = await ipc.setCloudFolder(result);
      setCloudPath(saved);
    }
  }

  async function runDiagnostics() {
    setDiagLoading(true);
    try {
      const r = await ipc.checkEnvironment();
      setReport(r);
    } catch (err) {
      console.error(err);
      alert(String(err));
    } finally {
      setDiagLoading(false);
    }
  }

  async function save() {
    await ipc.saveSettings({
      locale: chosenLocale,
      cloudPath: cloudPath || null,
      anthropicApiKey: apiKey || null,
      preferredTerminal: terminal,
    });
    onSaved();
    onClose();
  }

  // Filter terminal options to ones plausible for current OS, if known
  const availableOptions = report
    ? ALL_TERMINAL_OPTIONS.filter(
        (opt) =>
          opt.value === "auto" ||
          report.terminals.some((d) => d.kind === opt.value),
      )
    : ALL_TERMINAL_OPTIONS;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tx(t, "settings.title", "Settings")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>{tx(t, "settings.language", "Language")}</Label>
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
            <Label>{tx(t, "settings.preferredTerminal", "Preferred terminal")}</Label>
            <select
              value={terminal}
              onChange={(e) => setTerminal(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {availableOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value === "auto"
                    ? tx(t, "settings.auto", "Auto")
                    : opt.defaultLabel}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {tx(t, "settings.preferredTerminalHelp", "Auto picks the first available terminal.")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{tx(t, "gdrive.setupTitle", "Cloud folder")}</Label>
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

          <div className="space-y-2 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between">
              <Label>{tx(t, "settings.diagnostics", "Environment diagnostics")}</Label>
              <Button variant="outline" size="sm" onClick={runDiagnostics} disabled={diagLoading}>
                {diagLoading
                  ? tx(t, "settings.running", "Running...")
                  : tx(t, "settings.runDiagnostics", "Run diagnostics")}
              </Button>
            </div>
            {report && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs space-y-2">
                <div>
                  {report.claudeCliFound ? (
                    <div className="space-y-0.5">
                      <div className="text-green-500">
                        ✓ {tx(t, "settings.claudeCliFound", "Claude CLI: {path}").replace(
                          "{path}",
                          report.claudeCliPath || "",
                        )}
                      </div>
                      {report.claudeCliVersion && (
                        <div className="text-muted-foreground">
                          {tx(t, "settings.claudeCliVersion", "version {version}").replace(
                            "{version}",
                            report.claudeCliVersion,
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-red-500">
                      ✗ {tx(t, "settings.claudeCliMissing", "Claude CLI not found on PATH")}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium mb-1">
                    {tx(t, "settings.detectedTerminals", "Detected terminals")} ({report.terminals.length})
                  </div>
                  {report.terminals.length === 0 ? (
                    <div className="text-muted-foreground">
                      {tx(t, "settings.noTerminalsFound", "No terminals detected")}
                    </div>
                  ) : (
                    <ul className="space-y-0.5">
                      {report.terminals.map((d) => (
                        <li key={d.kind} className="font-mono">
                          <span className="text-foreground">{d.displayName}</span>
                          <span className="text-muted-foreground"> — {d.program}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {tx(t, "settings.cancel", "Cancel")}
          </Button>
          <Button onClick={save}>{tx(t, "settings.save", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
