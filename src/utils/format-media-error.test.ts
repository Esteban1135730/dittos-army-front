import { NotFoundException } from "@zxing/library";
import { describe, expect, it } from "vitest";
import { formatMediaError, isZxingNotFoundError } from "./format-media-error";

describe("formatMediaError", () => {
  it("traduce permiso denegado", () => {
    const err = new DOMException("denied", "NotAllowedError");
    expect(formatMediaError(err)).toMatch(/Permiso de cámara denegado/i);
  });

  it("traduce cámara en uso", () => {
    const err = new DOMException("busy", "NotReadableError");
    expect(formatMediaError(err)).toMatch(/en uso/i);
  });
});

describe("isZxingNotFoundError", () => {
  it("detecta NotFoundException de ZXing", () => {
    expect(isZxingNotFoundError({ name: "NotFoundException" })).toBe(true);
    expect(
      isZxingNotFoundError(
        new NotFoundException("No MultiFormat Readers were able to detect the code."),
      ),
    ).toBe(true);
    expect(
      isZxingNotFoundError({
        message: "No multiformat readers were able to detect the code",
      }),
    ).toBe(true);
    expect(isZxingNotFoundError({ name: "Other" })).toBe(false);
  });

  it("no muestra el mensaje de frame sin código como error de cámara", () => {
    const err = new NotFoundException(
      "No MultiFormat Readers were able to detect the code.",
    );
    expect(formatMediaError(err)).toBe("");
  });
});
