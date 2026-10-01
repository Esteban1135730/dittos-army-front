import { useCallback, useEffect, useRef, useState } from "react";
import { formatMediaError } from "../../../utils/format-media-error";
import {
  applyContinuousFocus,
  applyMaxResolution,
  applyZoom,
  buildVideoConstraints,
  getZoomRange,
  isLikelyFixedFocusWebcam,
  listVideoInputDevices,
  pickDefaultCameraDeviceId,
  readStoredCameraDeviceId,
  readTrackCaps,
  sharpenDataUrl,
  storeCameraDeviceId,
  triggerRefocus,
  type VideoInputOption,
} from "./camera-capture-utils";

export type CameraCaptureStatus = "idle" | "starting" | "ready" | "error";

type UseCameraCaptureOptions = {
  enabled: boolean;
  deviceId: string;
  sharpenCapture: boolean;
};

type FocusPoint = { x: number; y: number };

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function focusAtNormalizedPoint(
  track: MediaStreamTrack,
  point: FocusPoint,
): Promise<void> {
  const caps = readTrackCaps(track);
  try {
    if (caps.pointsOfInterest) {
      await track.applyConstraints({
        advanced: [
          {
            pointsOfInterest: [{ x: point.x, y: point.y }],
          } as MediaTrackConstraintSet,
        ],
      });
    }
    await triggerRefocus(track);
  } catch {
    await triggerRefocus(track);
  }
}

export function useCameraCapture({
  enabled,
  deviceId,
  sharpenCapture,
}: UseCameraCaptureOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraCaptureStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const [devices, setDevices] = useState<VideoInputOption[]>([]);
  const [activeDeviceLabel, setActiveDeviceLabel] = useState("");
  const [supportsTapFocus, setSupportsTapFocus] = useState(false);
  const [supportsSoftwareFocus, setSupportsSoftwareFocus] = useState(false);
  const [fixedFocusWebcam, setFixedFocusWebcam] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [zoomRange, setZoomRange] = useState<{
    min: number;
    max: number;
    step: number;
  } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setStatus("idle");
    setFocusPoint(null);
    setZoomRange(null);
  }, []);

  const refreshDevices = useCallback(async () => {
    const list = await listVideoInputDevices();
    setDevices(list);
    return list;
  }, []);

  const start = useCallback(async () => {
    if (!enabled) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Tu navegador no soporta acceso a la cámara.");
      setStatus("error");
      return;
    }

    stop();
    setStatus("starting");
    setErrorMessage(null);

    try {
      const list = await refreshDevices();
      const chosenId =
        deviceId ||
        pickDefaultCameraDeviceId(list, readStoredCameraDeviceId());
      const chosenLabel =
        list.find((d) => d.deviceId === chosenId)?.label ?? "";

      if (chosenId) {
        storeCameraDeviceId(chosenId);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: buildVideoConstraints(chosenId),
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];

      if (track) {
        setActiveDeviceLabel(track.label || chosenLabel);
        await applyMaxResolution(track);
        const hasFocus = await applyContinuousFocus(track);
        const caps = readTrackCaps(track);
        const tapFocus = Boolean(
          caps.pointsOfInterest || (caps.focusMode?.length ?? 0) > 0,
        );
        setSupportsSoftwareFocus(hasFocus || tapFocus);
        setSupportsTapFocus(tapFocus);
        setFixedFocusWebcam(
          isLikelyFixedFocusWebcam(track.label || chosenLabel) && !hasFocus,
        );

        const zRange = getZoomRange(track);
        setZoomRange(zRange);
        if (zRange) {
          const initial = Math.max(zRange.min, Math.min(zRange.max, 1));
          setZoomState(initial);
          await applyZoom(track, initial);
        } else {
          setZoomState(1);
        }

        await refreshDevices();
      }

      const video = videoRef.current;
      if (!video) {
        stop();
        setErrorMessage("Vista de cámara no disponible.");
        setStatus("error");
        return;
      }
      video.srcObject = stream;
      await video.play();
      setStatus("ready");
    } catch (err) {
      stop();
      setErrorMessage(formatMediaError(err));
      setStatus("error");
    }
  }, [deviceId, enabled, refreshDevices, stop]);

  const refocus = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || fixedFocusWebcam) return;
    await triggerRefocus(track);
  }, [fixedFocusWebcam]);

  const setZoom = useCallback(async (value: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoomRange) return;
    const clamped = Math.min(zoomRange.max, Math.max(zoomRange.min, value));
    setZoomState(clamped);
    await applyZoom(track, clamped);
  }, [zoomRange]);

  const focusAtClientPoint = useCallback(
    async (clientX: number, clientY: number) => {
      const video = videoRef.current;
      const track = streamRef.current?.getVideoTracks()[0];
      if (!video || !track) return;
      const rect = video.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      setFocusPoint({ x, y });
      await focusAtNormalizedPoint(track, { x, y });
    },
    [],
  );

  const capturePhoto = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!video || !track) return null;

    if (supportsSoftwareFocus) {
      await triggerRefocus(track);
      await new Promise((r) => setTimeout(r, 450));
    } else {
      await new Promise((r) => setTimeout(r, 150));
    }

    const ImageCaptureCtor = (
      window as Window & {
        ImageCapture?: new (t: MediaStreamTrack) => ImageCapture;
      }
    ).ImageCapture;

    let dataUrl: string | null = null;

    if (ImageCaptureCtor) {
      try {
        const capture = new ImageCaptureCtor(track);
        const blob = await capture.takePhoto();
        if (blob.size > 0) {
          dataUrl = await blobToDataUrl(blob);
        }
      } catch {
        /* fallback canvas */
      }
    }

    if (!dataUrl && video.videoWidth > 0 && video.videoHeight > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        dataUrl = canvas.toDataURL("image/jpeg", 0.93);
      }
    }

    if (!dataUrl) return null;
    if (sharpenCapture || fixedFocusWebcam) {
      return sharpenDataUrl(dataUrl, fixedFocusWebcam ? 0.65 : 0.45);
    }
    return dataUrl;
  }, [fixedFocusWebcam, sharpenCapture, supportsSoftwareFocus]);

  useEffect(() => {
    if (enabled) {
      void start();
    } else {
      stop();
    }
    return stop;
  }, [enabled, deviceId, start, stop]);

  return {
    videoRef,
    status,
    errorMessage,
    focusPoint,
    devices,
    activeDeviceLabel,
    supportsTapFocus,
    supportsSoftwareFocus,
    fixedFocusWebcam,
    zoom,
    zoomRange,
    start,
    stop,
    refocus,
    setZoom,
    focusAtClientPoint,
    capturePhoto,
    refreshDevices,
  };
}
