import { AxiosError } from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { extractAxiosErrorMessage } from "./extract-axios-error";

const FALLBACK = "No se pudo completar la operación.";

function axiosErrorWithData(data: unknown): AxiosError {
  return new AxiosError(
    "Request failed",
    "ERR_BAD_REQUEST",
    {} as InternalAxiosRequestConfig,
    undefined,
    {
      data,
      status: 400,
      statusText: "Bad Request",
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    } as AxiosResponse,
  );
}

describe("extractAxiosErrorMessage", () => {
  it("usa message string del body axios", () => {
    expect(
      extractAxiosErrorMessage(
        axiosErrorWithData({ message: "Cliente no encontrado" }),
        FALLBACK,
      ),
    ).toBe("Cliente no encontrado");
  });

  it("une message array de strings", () => {
    expect(
      extractAxiosErrorMessage(
        axiosErrorWithData({ message: ["Campo requerido", "Teléfono inválido"] }),
        FALLBACK,
      ),
    ).toBe("Campo requerido Teléfono inválido");
  });

  it("devuelve fallback si no es error de axios", () => {
    expect(extractAxiosErrorMessage(new Error("boom"), FALLBACK)).toBe(FALLBACK);
    expect(extractAxiosErrorMessage("timeout", FALLBACK)).toBe(FALLBACK);
    expect(extractAxiosErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(extractAxiosErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it("devuelve fallback si axios no trae message usable", () => {
    expect(extractAxiosErrorMessage(new AxiosError("network"), FALLBACK)).toBe(FALLBACK);
    expect(extractAxiosErrorMessage(axiosErrorWithData(null), FALLBACK)).toBe(FALLBACK);
    expect(extractAxiosErrorMessage(axiosErrorWithData("oops"), FALLBACK)).toBe(FALLBACK);
    expect(extractAxiosErrorMessage(axiosErrorWithData({}), FALLBACK)).toBe(FALLBACK);
    expect(extractAxiosErrorMessage(axiosErrorWithData({ message: "   " }), FALLBACK)).toBe(
      FALLBACK,
    );
    expect(extractAxiosErrorMessage(axiosErrorWithData({ message: [] }), FALLBACK)).toBe(
      FALLBACK,
    );
    expect(
      extractAxiosErrorMessage(axiosErrorWithData({ message: ["", "  ", 12] }), FALLBACK),
    ).toBe(FALLBACK);
  });
});
