export const CAMERA_DEVICE_STORAGE_KEY = "dittos.stock-photo.cameraDeviceId";

export type VideoInputOption = {
  deviceId: string;
  label: string;
};

export function isLikelyFixedFocusWebcam(label: string): boolean {
  return /gopro|webcam|uvc|logitech|c920|elgato|obs virtual/i.test(label);
}

export function isGoProWebcam(label: string): boolean {
  return /gopro/i.test(label);
}

/** Celular como webcam vía DroidCam, Iriun, Camo, etc. */
export function isPhoneWebcam(label: string): boolean {
  return /droidcam|iriun|epoccam|camo|phone link|link to windows|android|iphone|ios/i.test(
    label,
  );
}

export function readStoredCameraDeviceId(): string {
  try {
    return sessionStorage.getItem(CAMERA_DEVICE_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function storeCameraDeviceId(deviceId: string): void {
  try {
    sessionStorage.setItem(CAMERA_DEVICE_STORAGE_KEY, deviceId);
  } catch {
    /* ignore */
  }
}

export async function listVideoInputDevices(): Promise<VideoInputOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput" && d.deviceId)
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label?.trim() || `Cámara ${i + 1}`,
    }));
}

export function pickDefaultCameraDeviceId(
  devices: VideoInputOption[],
  storedId?: string,
): string {
  if (storedId && devices.some((d) => d.deviceId === storedId)) {
    return storedId;
  }
  const phone = devices.find((d) => isPhoneWebcam(d.label));
  if (phone) return phone.deviceId;
  const gopro = devices.find((d) => isGoProWebcam(d.label));
  if (gopro) return gopro.deviceId;
  const rear = devices.find((d) =>
    /back|rear|trasera|environment|wide/i.test(d.label),
  );
  if (rear) return rear.deviceId;
  return devices[0]?.deviceId ?? "";
}

export function buildVideoConstraints(deviceId: string): MediaTrackConstraints {
  if (!deviceId) {
    return {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    };
  }
  return {
    deviceId: { exact: deviceId },
    width: { ideal: 3840, min: 1280 },
    height: { ideal: 2160, min: 720 },
    frameRate: { ideal: 30, max: 60 },
  };
}

type TrackCaps = MediaTrackCapabilities & {
  focusMode?: string[];
  focusDistance?: { min: number; max: number; step?: number };
  zoom?: { min: number; max: number; step?: number };
  pointsOfInterest?: boolean;
};

export function readTrackCaps(track: MediaStreamTrack): TrackCaps {
  return (track.getCapabilities?.() ?? {}) as TrackCaps;
}

export async function applyMaxResolution(track: MediaStreamTrack): Promise<void> {
  const caps = readTrackCaps(track);
  const width = caps.width as { max?: number } | undefined;
  const height = caps.height as { max?: number } | undefined;
  if (!width?.max || !height?.max) return;
  try {
    await track.applyConstraints({
      width: { ideal: width.max },
      height: { ideal: height.max },
    });
  } catch {
    /* dispositivo rechaza resolución máxima */
  }
}

export async function applyContinuousFocus(track: MediaStreamTrack): Promise<boolean> {
  const caps = readTrackCaps(track);
  if (!caps.focusMode?.length) return false;
  const mode = caps.focusMode.includes("continuous")
    ? "continuous"
    : caps.focusMode.includes("auto")
      ? "auto"
      : null;
  if (!mode) return false;
  try {
    await track.applyConstraints({
      advanced: [{ focusMode: mode } as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;
  }
}

export async function triggerRefocus(track: MediaStreamTrack): Promise<boolean> {
  const caps = readTrackCaps(track);
  if (!caps.focusMode?.length) return false;
  try {
    if (caps.focusMode.includes("single-shot")) {
      await track.applyConstraints({
        advanced: [{ focusMode: "single-shot" } as MediaTrackConstraintSet],
      });
      await new Promise((r) => setTimeout(r, 400));
    }
    return applyContinuousFocus(track);
  } catch {
    return false;
  }
}

export async function applyZoom(
  track: MediaStreamTrack,
  zoom: number,
): Promise<void> {
  const caps = readTrackCaps(track);
  if (!caps.zoom) return;
  const clamped = Math.min(caps.zoom.max, Math.max(caps.zoom.min, zoom));
  try {
    await track.applyConstraints({ zoom: clamped } as MediaTrackConstraints);
  } catch {
    /* ignore */
  }
}

export function getZoomRange(track: MediaStreamTrack | null): {
  min: number;
  max: number;
  step: number;
} | null {
  if (!track) return null;
  const caps = readTrackCaps(track);
  if (!caps.zoom) return null;
  return {
    min: caps.zoom.min,
    max: caps.zoom.max,
    step: caps.zoom.step ?? 0.01,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

/** Nitidez ligera para webcams de enfoque fijo (GoPro, etc.). */
export function sharpenCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount = 0.55,
): void {
  if (width < 3 || height < 3) return;
  const src = ctx.getImageData(0, 0, width, height);
  const out = ctx.createImageData(width, height);
  const s = src.data;
  const d = out.data;
  const w = width;
  const strength = Math.min(1, Math.max(0, amount));

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const center = s[i + c] * 5;
        const neighbors =
          s[i - w * 4 + c] +
          s[i + w * 4 + c] +
          s[i - 4 + c] +
          s[i + 4 + c];
        const sharp = center - neighbors;
        d[i + c] = Math.min(255, Math.max(0, s[i + c] + (sharp - s[i + c]) * strength));
      }
      d[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

export async function sharpenDataUrl(
  dataUrl: string,
  amount = 0.55,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0);
  sharpenCanvas(ctx, canvas.width, canvas.height, amount);
  return canvas.toDataURL("image/jpeg", 0.93);
}
