import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Callback con identidad estable que siempre ejecuta la última versión de `fn`.
 * Para handlers de eventos usados dentro de `useMemo` (p. ej. columnas de DataGrid)
 * sin añadir el estado que leen a las dependencias. No llamar durante el render.
 */
export function useEventCallback<A extends unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
