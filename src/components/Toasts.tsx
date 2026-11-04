import { dismiss, useToasts } from "../lib/toasts";
import { Icon } from "./Icon";

export function Toasts() {
  const list = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <span className="toast__icon">
            <Icon name={t.kind === "error" ? "x" : t.kind === "info" ? "help" : "check"} size={15} stroke={3} />
          </span>
          <span className="toast__text">{t.text}</span>
          {t.action && (
            <button
              className="toast__action"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
