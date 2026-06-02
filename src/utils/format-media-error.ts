import { NotFoundException } from "@zxing/library";

const ZXING_NOT_FOUND_MESSAGE_RE =
  /no\s+multiformat\s+readers?\s+were\s+able\s+to\s+detect/i;

/** Frame sin código visible: normal entre intentos de ZXing, no es fallo de cámara. */
export function isZxingNotFoundError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof NotFoundException) return true;
  if (typeof error !== "object") return false;

  const err = error as {
    name?: string;
    message?: string;
    getKind?: () => string;
  };

  if (err.name === "NotFoundException" || err.name === "NotFoundError") {
    return true;
  }

  if (typeof err.getKind === "function" && err.getKind() === "NotFoundException") {
    return true;
  }

  if (typeof err.message === "string" && ZXING_NOT_FOUND_MESSAGE_RE.test(err.message)) {
    return true;
  }

  return false;
}

/** Mensaje legible para fallos de cámara (getUserMedia / permisos). */
export function formatMediaError(error: unknown): string {
  if (isZxingNotFoundError(error)) {
    return "";
  }
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Permiso de cámara denegado. Actívalo en Ajustes del navegador o del teléfono.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No se encontró ninguna cámara en este dispositivo.";
      case "NotReadableError":
      case "TrackStartError":
        return "La cámara está en uso por otra app. Ciérrala e inténtalo de nuevo.";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "La cámara no admite el modo solicitado. Pulsa «Reiniciar cámara».";
      case "SecurityError":
        return "El navegador bloqueó la cámara. Usa https:// y confía en el certificado de desarrollo.";
      case "AbortError":
        return "Se canceló el acceso a la cámara. Vuelve a intentarlo.";
      default:
        return error.message || `Error de cámara (${error.name})`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "No se pudo iniciar la cámara.";
}
