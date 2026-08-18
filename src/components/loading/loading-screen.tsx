import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/system";

const brandPulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
`;

export type LoadingScreenVariant = "page" | "fullscreen" | "inline";

export type LoadingScreenProps = {
  /** Texto debajo del logo. Omitir para solo spinner de marca. */
  message?: string;
  variant?: LoadingScreenVariant;
  minHeight?: number | string;
};

export default function LoadingScreen({
  message = "Cargando…",
  variant = "page",
  minHeight,
}: LoadingScreenProps) {
  const sizeSx =
    variant === "fullscreen"
      ? { minHeight: "100vh", bgcolor: "background.default" }
      : variant === "page"
        ? { minHeight: minHeight ?? "min(560px, 70vh)" }
        : { minHeight: minHeight ?? 200, py: 4 };

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message || "Cargando"}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        ...sizeSx,
      }}
    >
      <Stack
        alignItems="center"
        spacing={2.5}
        sx={{ px: 2, maxWidth: 360, textAlign: "center" }}
      >
        <Box
          sx={{
            position: "relative",
            width: 72,
            height: 72,
            animation: `${brandPulse} 2.4s ease-in-out infinite`,
          }}
        >
          <Box
            sx={(theme) => ({
              position: "absolute",
              inset: 4,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              opacity: 0.14,
            })}
          />
          <CircularProgress
            size={72}
            thickness={2.5}
            aria-hidden
            sx={{ color: "primary.main", position: "absolute", inset: 0 }}
          />
          <Typography
            component="span"
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "1.35rem",
              letterSpacing: "-0.04em",
              background: (theme) =>
                `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            D
          </Typography>
        </Box>

        <Stack spacing={0.75}>
          <Typography variant="subtitle1" fontWeight={700} letterSpacing="-0.02em">
            Dittos Army
          </Typography>
          {message ? (
            <Typography variant="body2" color="text.secondary">
              {message}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}
