import { useEffect, useState, type CSSProperties, type MouseEventHandler } from "react";
import CircularProgress from "@mui/material/CircularProgress";

export type CardThumbSize = "sm" | "md" | "lg" | "xl";

/** Approximate Pokémon card ratio (~5:7). */
export const CARD_THUMB_SIZES: Record<
  CardThumbSize,
  { width: number; height: number }
> = {
  sm: { width: 56, height: 78 },
  md: { width: 64, height: 90 },
  lg: { width: 80, height: 112 },
  xl: { width: 180, height: 252 },
};

type CardThumbProps = {
  src?: string | null;
  alt?: string;
  /** Default `md` (64×90) — usable in lists and DataGrids. */
  size?: CardThumbSize;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
  /** Datos de carta aún en tránsito (API / enriquecimiento). */
  pending?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  /** Show a larger preview on hover (CSS scale). */
  enlargeOnHover?: boolean;
};

/**
 * Shared Pokémon card thumbnail: fixed aspect, contain fit, readable size.
 */
export function CardThumb({
  src,
  alt = "Carta",
  size = "md",
  width: widthProp,
  height: heightProp,
  className = "",
  style,
  loading = "lazy",
  pending = false,
  onClick,
  enlargeOnHover = false,
}: CardThumbProps) {
  const preset = CARD_THUMB_SIZES[size];
  const width = widthProp ?? preset.width;
  const height = heightProp ?? preset.height;
  const trimmed = typeof src === "string" ? src.trim() : "";
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    setImgLoaded(false);
  }, [trimmed]);

  const waitingImage = trimmed.length > 0 && !imgLoaded;
  const showSpinner = pending || waitingImage;

  return (
    <span
      className={[
        "relative inline-flex shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-100",
        enlargeOnHover && !showSpinner
          ? "overflow-visible transition-transform hover:z-30 hover:scale-[1.75] hover:shadow-xl"
          : "overflow-hidden",
        onClick ? "cursor-zoom-in" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width, height, minWidth: width, ...style }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                (e.currentTarget as HTMLElement).click();
              }
            }
          : undefined
      }
      aria-busy={showSpinner ? true : undefined}
      aria-label={showSpinner ? "Cargando carta" : undefined}
    >
      {trimmed ? (
        <>
          <img
            src={trimmed}
            alt={alt}
            loading={loading}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
            className={[
              "block h-full w-full bg-white object-contain transition-opacity duration-200",
              enlargeOnHover && imgLoaded ? "rounded-md" : "",
              showSpinner ? "opacity-0" : "opacity-100",
            ]
              .filter(Boolean)
              .join(" ")}
            draggable={false}
          />
          {showSpinner ? (
            <CircularProgress
              size={Math.max(20, Math.round(Math.min(width, height) * 0.32))}
              aria-hidden
              sx={{
                position: "absolute",
                color: "primary.main",
              }}
            />
          ) : null}
        </>
      ) : pending ? (
        <CircularProgress
          size={Math.max(20, Math.round(Math.min(width, height) * 0.32))}
          aria-hidden
          sx={{ color: "primary.main" }}
        />
      ) : (
        <span className="px-1 text-center text-[10px] leading-tight text-gray-400">
          Sin imagen
        </span>
      )}
    </span>
  );
}
