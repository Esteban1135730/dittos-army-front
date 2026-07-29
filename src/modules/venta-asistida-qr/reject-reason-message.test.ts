import { describe, expect, it } from "vitest";
import {
  rejectReasonMessage,
  reservedScanNotice,
} from "./reject-reason-message";

describe("rejectReasonMessage", () => {
  it("traduce razones conocidas", () => {
    expect(rejectReasonMessage("sin_pvp")).toBe(
      "Esta carta no tiene PVP asignado.",
    );
    expect(rejectReasonMessage("reservada")).toBe(
      "Esta carta está reservada.",
    );
  });

  it("mensaje genérico sin razón", () => {
    expect(rejectReasonMessage(undefined)).toBe(
      "No se puede añadir al carrito.",
    );
  });
});

describe("reservedScanNotice", () => {
  it("aviso informativo cuando hubo sustitución por copia equivalente", () => {
    const notice = reservedScanNotice({ substituted: true });
    expect(notice).toEqual({
      severity: "info",
      message:
        "La carta escaneada está reservada; se agregó otra copia disponible.",
    });
  });

  it("aviso de advertencia para reservada sin equivalente", () => {
    const notice = reservedScanNotice({ reserved_fallback: true });
    expect(notice).toEqual({
      severity: "warning",
      message:
        "Carta reservada: al venderla se cancelará la reserva del cliente.",
    });
  });

  it("sin aviso para escaneos normales", () => {
    expect(reservedScanNotice({})).toBeNull();
  });
});
