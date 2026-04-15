import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SessionTable } from "@/components/SessionTable";
import { SessionDetail } from "@/components/SessionDetail";
import { EditDialog } from "@/components/EditDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ipc } from "@/lib/ipc";
import { createT, detectLocale, type Locale } from "@/i18n";
import type { AppConfig, Session } from "@/types";

type EditMode = "rename" | "describe" | null;

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AppConfig>({ sessions: {}, settings: {} });
  const [locale, setLocale] = useState<Locale>(detectLocale());
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editTarget, setEditTarget] = useState<Session | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const t = useMemo(() => createT(locale), [locale]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, cfg] = await Promise.all([ipc.listSessions(), ipc.getConfig()]);
      setSessions(list);
      setConfig(cfg);
      const savedLocale = cfg.settings.locale;
      if (savedLocale === "en" || savedLocale === "ko") setLocale(savedLocale);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const hay = [
        s.name,
        s.description,
        s.autoSummary,
        s.project,
        s.sessionId,
        s.firstUserMessage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, query]);

  const selected = useMemo(
    () => sessions.find((s) => s.sessionId === selectedId) || null,
    [sessions, selectedId],
  );

  async function handleResume(s: Session) {
    try {
      if (s.storageType === "cloud") {
        await ipc.checkoutSession(s);
      }
      await ipc.resumeSession(s.sessionId, s.cwd);
    } catch (err) {
      console.error(err);
      alert(String(err));
    }
  }

  async function handleDelete(s: Session) {
    const ok = confirm(t("prompt.confirmDelete"));
    if (!ok) return;
    try {
      await ipc.deleteSession(s.sessionId, s.projectDir);
      setSelectedId((cur) => (cur === s.sessionId ? null : cur));
      await refresh();
    } catch (err) {
      console.error(err);
      alert(String(err));
    }
  }

  async function handleToggleCloud(s: Session) {
    try {
      if (s.storageType === "cloud") {
        await ipc.checkoutSession(s);
        await ipc.saveSessionMeta(s.sessionId, { storageType: "local" });
      } else {
        await ipc.uploadToCloud(s);
      }
      await refresh();
    } catch (err) {
      console.error(err);
      alert(String(err));
    }
  }

  async function handleGenerateSummary(s: Session) {
    try {
      await ipc.generateSummary(s.sessionId, s.filePath);
      await refresh();
    } catch (err) {
      alert(String(err));
    }
  }

  function openEdit(mode: EditMode, s: Session) {
    setEditMode(mode);
    setEditTarget(s);
  }

  async function submitEdit(value: string) {
    if (!editTarget || !editMode) return;
    const patch = editMode === "rename" ? { name: value || null } : { description: value || null };
    await ipc.saveSessionMeta(editTarget.sessionId, patch);
    setEditMode(null);
    setEditTarget(null);
    await refresh();
  }

  const total = sessions.length;
  const localCount = sessions.filter((s) => s.storageType !== "cloud").length;
  const cloudCount = sessions.filter((s) => s.storageType === "cloud").length;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border/60 px-5 py-3">
        <div className="flex flex-col">
          <h1 className="text-base font-semibold leading-tight">{t("app.title")}</h1>
          <p className="text-[11px] text-muted-foreground">
            {t("list.total", { count: total })} · local {localCount} / cloud {cloudCount}
          </p>
        </div>
        <div className="relative ml-6 flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <SettingsIcon />
          </Button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <section className="flex-1 overflow-auto">
          <SessionTable
            sessions={filtered}
            selectedId={selectedId}
            locale={locale}
            t={t}
            onSelect={(s) => setSelectedId(s.sessionId)}
            onResume={handleResume}
            onRename={(s) => openEdit("rename", s)}
            onDescribe={(s) => openEdit("describe", s)}
            onDelete={handleDelete}
            onToggleCloud={handleToggleCloud}
            onGenerateSummary={handleGenerateSummary}
          />
        </section>
        <aside className="w-[380px] shrink-0 border-l border-border/60 bg-card/30">
          <SessionDetail session={selected} locale={locale} t={t} onResume={handleResume} />
        </aside>
      </main>

      <EditDialog
        open={editMode !== null}
        title={editMode === "rename" ? t("action.rename") : t("action.describe")}
        label={editMode === "rename" ? t("prompt.enterName") : t("prompt.enterDescription")}
        initialValue={
          editTarget
            ? editMode === "rename"
              ? editTarget.name || ""
              : editTarget.description || ""
            : ""
        }
        onSubmit={submitEdit}
        onClose={() => {
          setEditMode(null);
          setEditTarget(null);
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        current={config.settings}
        locale={locale}
        t={t}
        onClose={() => setSettingsOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}

export default App;
