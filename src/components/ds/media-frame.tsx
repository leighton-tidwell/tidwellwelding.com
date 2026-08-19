import type { CSSProperties, ReactNode } from "react";

export type MediaFrameProps = {
  /** Image source. Omit (with label/kicker) for the labelled placeholder. */
  src?: string;
  alt?: string;
  /** CSS aspect-ratio, e.g. "4 / 3", "16 / 9", "1 / 1". */
  ratio?: string;
  /** Placeholder body text describing the shot needed. */
  label?: string;
  /** Placeholder mono kicker, e.g. "Photo needed". */
  kicker?: string;
  /** Bottom-weighted readability scrim over the media. */
  scrim?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Custom media (e.g. a <video>); rendered instead of the img/placeholder. */
  children?: ReactNode;
};

export default function MediaFrame({
  src,
  alt = "",
  ratio,
  label,
  kicker,
  scrim = false,
  className,
  style,
  children,
}: MediaFrameProps) {
  const classes = ["tsws-media", className].filter(Boolean).join(" ");
  const frameStyle: CSSProperties = ratio
    ? { aspectRatio: ratio, ...style }
    : { ...style };

  let media: ReactNode;
  if (children) {
    media = children;
  } else if (src) {
    // Plain img by design; next.config sets images.unoptimized.
     
    media = <img className="tsws-media__img" src={src} alt={alt} />;
  } else {
    media = (
      <div className="tsws-media__ph">
        {kicker ? <div className="tsws-media__ph-kicker">{kicker}</div> : null}
        {label ? <div className="tsws-media__ph-label">{label}</div> : null}
      </div>
    );
  }

  return (
    <div className={classes} style={frameStyle}>
      {media}
      {scrim ? <div className="tsws-media__scrim" aria-hidden="true" /> : null}
    </div>
  );
}

export { MediaFrame };
