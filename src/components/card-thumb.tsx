import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler,
} from "react";
import CircularProgress from "@mui/material/CircularProgress";
import Popper from "@mui/material/Popper";

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

/** Hover preview size — large enough to read the card outside clipped cells. */
export const CARD_THUMB_HOVER_PREVIEW = CARD_THUMB_SIZES.xl;

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
  /**
   * Show a larger preview on hover, portaled to `document.body`
   * so DataGrid / overflow parents do not clip it.
   */
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
  const [hoverOpen, setHoverOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setImgLoaded(false);
    setHoverOpen(false);
  }, [trimmed]);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  const waitingImage = trimmed.length > 0 && !imgLoaded;
  const showSpinner = pending || waitingImage;
  const canPreview = enlargeOnHover && trimmed.length > 0;

  const cancelLeave = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const openPreview = () => {
    if (!canPreview) return;
    cancelLeave();
    setHoverOpen(true);
  };

  const scheduleClosePreview = () => {
    cancelLeave();
    leaveTimerRef.current = setTimeout(() => setHoverOpen(false), 80);
  };

  useEffect(() => {
    if (!hoverOpen) return;
    const close = () => setHoverOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [hoverOpen]);

  return (
    <>
      <span
        ref={anchorRef}
        className={[
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-100",
          canPreview || onClick ? "cursor-zoom-in" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ width, height, minWidth: width, ...style }}
        onClick={onClick}
        onMouseEnter={canPreview ? openPreview : undefined}
        onMouseLeave={canPreview ? scheduleClosePreview : undefined}
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
      {canPreview ? (
        <Popper
          open={hoverOpen}
          anchorEl={anchorRef.current}
          placement="right"
          modifiers={[
            { name: "offset", options: { offset: [0, 8] } },
            { name: "preventOverflow", options: { padding: 8 } },
          ]}
          sx={{ zIndex: (theme) => theme.zIndex.tooltip }}
          onMouseEnter={openPreview}
          onMouseLeave={scheduleClosePreview}
        >
          <img
            data-testid="card-thumb-preview"
            src={trimmed}
            alt=""
            width={CARD_THUMB_HOVER_PREVIEW.width}
            height={CARD_THUMB_HOVER_PREVIEW.height}
            className="block rounded-md border border-gray-200 bg-white object-contain shadow-xl"
            draggable={false}
            aria-hidden
          />
        </Popper>
      ) : null}
    </>
  );
}
