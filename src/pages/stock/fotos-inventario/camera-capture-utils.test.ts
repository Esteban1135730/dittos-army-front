import { describe, expect, it } from "vitest";
import {
  isGoProWebcam,
  isLikelyFixedFocusWebcam,
  isPhoneWebcam,
  pickDefaultCameraDeviceId,
} from "./camera-capture-utils";

describe("camera-capture-utils", () => {
  it("detecta GoPro webcam", () => {
    expect(isGoProWebcam("GoPro Webcam")).toBe(true);
    expect(isGoProWebcam("Integrated Camera")).toBe(false);
  });

  it("prioriza celular webcam sobre GoPro", () => {
    const id = pickDefaultCameraDeviceId([
      { deviceId: "a", label: "GoPro Webcam" },
      { deviceId: "b", label: "DroidCam Source 2" },
    ]);
    expect(id).toBe("b");
  });

  it("detecta celular como webcam", () => {
    expect(isPhoneWebcam("DroidCam Source 2")).toBe(true);
    expect(isPhoneWebcam("GoPro Webcam")).toBe(false);
  });

  it("marca webcams externas como enfoque fijo probable", () => {
    expect(isLikelyFixedFocusWebcam("GoPro Webcam")).toBe(true);
    expect(isLikelyFixedFocusWebcam("Back Camera")).toBe(false);
  });
});
