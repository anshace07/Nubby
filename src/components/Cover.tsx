import type { CSSProperties } from "react";
import { coverById } from "../lib/catalog";
import type { CoverId } from "../lib/types";

/**
 * A physical-looking notebook cover. Everything inside is sized in `em`,
 * so one `width` prop scales the whole cover (shelf, preview, mini swatch).
 */
export function Cover({
  cover,
  title,
  subtitle,
  width = 146,
  className = "",
  style,
}: {
  cover: CoverId;
  title: string;
  subtitle?: string;
  width?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const def = coverById(cover);
  const fontSize = (width / 146) * 16;
  const t = title.trim() || "Untitled";
  return (
    <div
      className={`nb-cover nb-cover--${def.label} nb-cover--${def.id} ${className}`}
      style={{ ...def.style, width, height: width * 1.33, fontSize, ...style }}
    >
      <div className="nb-cover__spine" style={{ background: def.spine }} />
      {def.label === "card" && (
        <div className="nb-cover__card">
          <div className="nb-cover__title">{t}</div>
          {subtitle ? <div className="nb-cover__sub">{subtitle}</div> : null}
        </div>
      )}
      {def.label === "tape" && (
        <>
          <div className="nb-cover__tape" />
          <div className="nb-cover__hand">{t}</div>
          {subtitle ? <div className="nb-cover__hand-sub">{subtitle}</div> : null}
        </>
      )}
      {def.label === "leather" && (
        <>
          <div className="nb-cover__stitch" />
          <div className="nb-cover__band" />
          <div className="nb-cover__emboss">{t}</div>
          {subtitle ? <div className="nb-cover__emboss-sub">{subtitle}</div> : null}
        </>
      )}
      {def.label === "round" && (
        <div className="nb-cover__round">
          <span className="nb-cover__title">{t}</span>
          {subtitle ? <span className="nb-cover__sub">{subtitle}</span> : null}
        </div>
      )}
      {def.label === "tilted" && (
        <div className="nb-cover__tilted">
          <div className="nb-cover__title">{t}</div>
          {subtitle ? <div className="nb-cover__sub">{subtitle}</div> : null}
        </div>
      )}
    </div>
  );
}
