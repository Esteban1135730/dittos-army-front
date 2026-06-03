import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ScannerErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[qr-scanner]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ maxWidth: 480, mx: "auto", py: 4 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={2}>
              <Alert severity="error" variant="outlined">
                La pantalla de venta QR falló: {this.state.error.message}
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Recarga la página o vuelve al panel. En móvil usa Chrome con HTTPS y
                permisos de cámara activos.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button component={Link} to="/ventas" variant="contained">
                  Ir a ventas
                </Button>
                <Button variant="outlined" onClick={() => window.location.reload()}>
                  Recargar
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}
