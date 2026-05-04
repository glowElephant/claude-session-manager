import { memo } from "react";
import { Cloud, HardDrive, MoreHorizontal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatBytes, formatRelativeTime } from "@/lib/utils";
import type { Session } from "@/types";
import type { Locale } from "@/i18n";

interface Props {
  sessions: Session[];
  selectedId: string | null;
  locale: Locale;
  t: (k: string, p?: Record<string, string | number>) => string;
  onSelect: (s: Session) => void;
  onResume: (s: Session) => void;
  onRename: (s: Session) => void;
  onDescribe: (s: Session) => void;
  onDelete: (s: Session) => void;
  onToggleCloud: (s: Session) => void;
  onGenerateSummary: (s: Session) => void;
}

function SessionTableInner({
  sessions,
  selectedId,
  locale,
  t,
  onSelect,
  onResume,
  onRename,
  onDescribe,
  onDelete,
  onToggleCloud,
  onGenerateSummary,
}: Props) {
  if (sessions.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
        {t("list.noSessions")}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">{t("list.name")}</TableHead>
          <TableHead>{t("list.description")}</TableHead>
          <TableHead className="w-[220px]">{t("list.project")}</TableHead>
          <TableHead className="w-[120px]">{t("list.lastActive")}</TableHead>
          <TableHead className="w-[90px] text-right">{t("list.size")}</TableHead>
          <TableHead className="w-[70px]">{t("list.type")}</TableHead>
          <TableHead className="w-[44px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((s) => {
          const selected = selectedId === s.sessionId;
          const label =
            s.name || s.sessionId.slice(0, 8);
          const desc = s.description || s.autoSummary || s.firstUserMessage || "";
          return (
            <TableRow
              key={s.sessionId}
              data-state={selected ? "selected" : undefined}
              onClick={() => onSelect(s)}
              onDoubleClick={() => onResume(s)}
              className="cursor-pointer"
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className={cn("font-medium", !s.name && "text-muted-foreground font-mono text-xs")}>
                    {label}
                  </span>
                  {s.name && (
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                      {s.sessionId.slice(0, 8)}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="max-w-[360px]">
                <span className="line-clamp-1 text-sm text-foreground/80">{desc || "—"}</span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs text-muted-foreground line-clamp-1">
                  {s.project}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {s.lastTimestamp ? formatRelativeTime(s.lastTimestamp, locale) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                {formatBytes(s.size)}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {s.storageType === "cloud" ? (
                    <>
                      <Cloud className="h-3 w-3 text-sky-400" />
                      {t("list.cloud") !== "list.cloud" ? t("list.cloud") : "cloud"}
                    </>
                  ) : (
                    <>
                      <HardDrive className="h-3 w-3 text-emerald-400" />
                      {t("list.local") !== "list.local" ? t("list.local") : "local"}
                    </>
                  )}
                </span>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onResume(s)}>
                      {t("action.resumeNew")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onRename(s)}>
                      {t("action.rename")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onDescribe(s)}>
                      {t("action.describe")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onGenerateSummary(s)}>
                      {t("action.generateSummary")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onToggleCloud(s)}>
                      {s.storageType === "cloud" ? t("action.syncFromCloud") : t("action.syncToCloud")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => onDelete(s)}>
                      {t("action.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export const SessionTable = memo(SessionTableInner);
