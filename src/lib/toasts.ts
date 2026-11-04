import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  text: string;
  kind: "ok" | "info" | "error";
  action?: { label: string; run: () => void };
  ms: number;
}

let toasts: Toast[] = [];
let seq = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function toast(t: Omit<Partial<Toast>, "id"> & { text: string }) {
  const item: Toast = { id: seq++, kind: "ok", ms: t.action ? 6500 : 2600, ...t };
  toasts = [...toasts.slice(-3), item];
  emit();
  setTimeout(() => dismiss(item.id), item.ms);
  return item.id;
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => toasts,
  );
}
