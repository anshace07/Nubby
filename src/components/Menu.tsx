import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export interface MenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  hint?: string;
  onClick: () => void;
}

/** A small comic-style popup menu, positioned at a point and kept on screen. */
export function Menu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // offsetWidth/Height ignore the pop-in scale animation
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="menu pop-in" role="menu" style={{ left: pos.x, top: pos.y }}>
      {items.map((it) => (
        <button
          key={it.label}
          role="menuitem"
          className={`menu__item ${it.danger ? "menu__item--danger" : ""}`}
          onClick={() => {
            onClose();
            it.onClick();
          }}
        >
          {it.icon ? <Icon name={it.icon} size={16} /> : <span style={{ width: 16 }} />}
          <span className="menu__label">{it.label}</span>
          {it.hint ? <span className="menu__hint">{it.hint}</span> : null}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/** A popover anchored above/below a button (used by the toolbar). */
export function Popover({
  anchor,
  onClose,
  children,
  place = "top",
  className = "",
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  place?: "top" | "bottom";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const r = { width: ref.current.offsetWidth, height: ref.current.offsetHeight };
    let left = a.left + a.width / 2 - r.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));
    let top = place === "top" ? a.top - r.height - 10 : a.bottom + 10;
    if (top < 8) top = a.bottom + 10;
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, a.top - r.height - 10);
    setPos({ left, top });
  }, [anchor, place]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      className={`popover pop-in ${className}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
      onMouseDown={(e) => {
        // keep the editor selection while clicking inside the popover
        if (!(e.target as HTMLElement).closest("input, textarea")) e.preventDefault();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
