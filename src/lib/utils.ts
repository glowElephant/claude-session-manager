import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function formatRelativeTime(iso: string, locale: "en" | "ko" = "ko"): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const labels = locale === "ko"
    ? { now: "방금", min: "분 전", hr: "시간 전", day: "일 전" }
    : { now: "just now", min: "m ago", hr: "h ago", day: "d ago" };
  if (sec < 60) return labels.now;
  if (min < 60) return `${min}${locale === "ko" ? labels.min : labels.min}`;
  if (hr < 24) return `${hr}${labels.hr}`;
  return `${day}${labels.day}`;
}
