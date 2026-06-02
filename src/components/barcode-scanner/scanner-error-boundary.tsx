import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ScannerErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[escanear-codigo]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 3, maxWidth: 480, mx: "auto" }}>
          <Stack spacing={2}>
            <Alert severity="error">
              La pantalla de escaneo falló: {this.state.error.message}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Prueba recargar la página. Si persiste, usa Chrome en Android con{" "}
              <strong>https://</strong> y permisos de cámara activos.
            </Typography>
            <Button component={Link} to="/" variant="contained">
              Volver al panel
            </Button>
            <Button variant="outlined" onClick={() => window.location.reload()}>
              Recargar
            </Button>
          </Stack>
        </Box>
      );
    }
    return this.props.children;
  }
}
