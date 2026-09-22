import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler,
  type SVGProps,
} from "react";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Popper from "@mui/material/Popper";
import { alpha } from "@mui/material/styles";

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
   * Click opens a near-fullscreen lightbox.
   */
  enlargeOnHover?: boolean;
};

function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

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
  const [readySrc, setReadySrc] = useState("");
  const [hoverOpen, setHoverOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markImageReady = () => {
    if (trimmed) setReadySrc(trimmed);
  };

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (trimmed && img?.complete) {
      setReadySrc(trimmed);
    }
  }, [trimmed]);

  useEffect(() => {
    setHoverOpen(false);
    setLightboxOpen(false);
  }, [trimmed]);

  useEffect(() => {
    if (!trimmed || readySrc === trimmed) return;
    const id = window.setTimeout(() => setReadySrc(trimmed), 8000);
    return () => window.clearTimeout(id);
  }, [trimmed, readySrc]);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  const imgReady = Boolean(trimmed) && readySrc === trimmed;
  const waitingImage = trimmed.length > 0 && !imgReady;
  const showSpinner = pending || waitingImage;
  const canPreview = enlargeOnHover && trimmed.length > 0;
  const clickable = Boolean(canPreview || onClick);

  const cancelLeave = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const openPreview = () => {
    if (!canPreview || lightboxOpen) return;
    cancelLeave();
    setHoverOpen(true);
  };

  const scheduleClosePreview = () => {
    cancelLeave();
    leaveTimerRef.current = setTimeout(() => setHoverOpen(false), 80);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const handleClick: MouseEventHandler<HTMLElement> = (event) => {
    event.stopPropagation();
    if (canPreview) {
      cancelLeave();
      setHoverOpen(false);
      setLightboxOpen(true);
    }
    onClick?.(event);
  };

  useEffect(() => {
    if (!hoverOpen || lightboxOpen) return;
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
  }, [hoverOpen, lightboxOpen]);

  return (
    <>
      <span
        ref={anchorRef}
        className={[
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-100",
          clickable ? "cursor-zoom-in" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ width, height, minWidth: width, ...style }}
        onClick={clickable ? handleClick : undefined}
        onMouseEnter={canPreview ? openPreview : undefined}
        onMouseLeave={canPreview ? scheduleClosePreview : undefined}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).click();
                }
              }
            : undefined
        }
        aria-busy={showSpinner ? true : undefined}
        aria-label={
          canPreview
            ? `Ver ${alt} a tamaño grande`
            : showSpinner
              ? "Cargando carta"
              : undefined
        }
      >
        {trimmed ? (
          <>
            <img
              ref={imgRef}
              src={trimmed}
              alt={alt}
              loading={loading}
              onLoad={markImageReady}
              onError={markImageReady}
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
          open={hoverOpen && !lightboxOpen}
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
      {canPreview ? (
        <Dialog
          open={lightboxOpen}
          onClose={closeLightbox}
          maxWidth={false}
          scroll="body"
          aria-label={alt}
          slotProps={{
            paper: {
              sx: {
                bgcolor: "transparent",
                boxShadow: "none",
                overflow: "visible",
                m: 2,
                maxWidth: "92vw",
                maxHeight: "92dvh",
              },
            },
            backdrop: {
              sx: (theme) => ({
                bgcolor: alpha(theme.palette.ditto.brand.ink, 0.82),
              }),
            },
          }}
        >
          <IconButton
            aria-label="Cerrar"
            onClick={closeLightbox}
            sx={(theme) => ({
              position: "fixed",
              top: 16,
              right: 16,
              zIndex: 1,
              bgcolor: "background.paper",
              color: "text.primary",
              boxShadow: 2,
              "&:hover": {
                bgcolor: theme.palette.ditto.surface.muted,
              },
            })}
          >
            <IconClose />
          </IconButton>
          <img
            data-testid="card-thumb-lightbox"
            src={trimmed}
            alt={alt}
            draggable={false}
            style={{
              display: "block",
              maxWidth: "92vw",
              maxHeight: "92dvh",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              borderRadius: 10,
            }}
          />
        </Dialog>
      ) : null}
    </>
  );
}
