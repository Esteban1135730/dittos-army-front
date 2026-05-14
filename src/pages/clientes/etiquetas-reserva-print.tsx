import { useCallback, useEffect, useMemo } from "react";

export const ETIQUETA_RESERVA_IMAGE_SRC = "/reservaditto-separador.png";
const ETIQUETA_SIZE_MM = 48;
const ETIQUETA_PADDING_MM = 0.75;
const ETIQUETA_NAME_FONT_MM = 3.2;

export type EtiquetaReservaItem = {
  key: string;
  clientName: string;
};

type Props = {
  clientName: string;
  labelCount: number;
};

export function buildEtiquetasReservaItems(clientName: string, labelCount: number): EtiquetaReservaItem[] {
  return Array.from({ length: labelCount }, (_, index) => ({
    key: `label-${index}`,
    clientName,
  }));
}

export function buildEtiquetasReservaItemsFromPedidos(
  pedidos: { client: { _id: string; nombre: string }; items: unknown[] }[],
): EtiquetaReservaItem[] {
  return pedidos.flatMap((pedido) =>
    pedido.items.map((_, index) => ({
      key: `${pedido.client._id}-${index}`,
      clientName: pedido.client.nombre,
    })),
  );
}

export async function preloadEtiquetaReservaImage(): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No se pudo cargar la imagen de la etiqueta."));
    img.src = ETIQUETA_RESERVA_IMAGE_SRC;
  });
}

export function useClearEtiquetasReservaPrintMode() {
  useEffect(() => {
    const clear = () => {
      document.body.classList.remove("print-etiquetas-mode");
    };
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);
}

export function EtiquetasReservaPrintArea({ labels }: { labels: EtiquetaReservaItem[] }) {
  if (labels.length === 0) return null;

  return (
  <>
    <div className="etiquetas-reserva-print-only" style={{ padding: 0 }}>
      {labels.map((label) => (
        <div
          key={label.key}
          className="etiqueta-reserva-card"
          style={{
            width: `${ETIQUETA_SIZE_MM}mm`,
            height: `${ETIQUETA_SIZE_MM}mm`,
            minHeight: `${ETIQUETA_SIZE_MM}mm`,
            boxSizing: "border-box",
            padding: `${ETIQUETA_PADDING_MM}mm`,
            border: "1px solid #ccc",
            breakInside: "avoid",
            pageBreakInside: "avoid",
            display: "inline-flex",
            flexDirection: "column",
            verticalAlign: "top",
            margin: "2mm",
            overflow: "hidden",
          }}
        >
          <img
            src={ETIQUETA_RESERVA_IMAGE_SRC}
            alt=""
            style={{
              width: "100%",
              flex: "1 1 0",
              minHeight: 0,
              objectFit: "contain",
              display: "block",
            }}
          />
          <div
            style={{
              flexShrink: 0,
              marginTop: "0.5mm",
              fontSize: `${ETIQUETA_NAME_FONT_MM}mm`,
              lineHeight: 1.15,
              fontWeight: 700,
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label.clientName}
          </div>
        </div>
      ))}
    </div>
    <style>{ETIQUETAS_RESERVA_PRINT_STYLES}</style>
  </>
  );
}

export const ETIQUETAS_RESERVA_PRINT_STYLES = `
  @media print {
    body * { visibility: hidden; }
    body.print-etiquetas-mode .etiquetas-reserva-print-only,
    body.print-etiquetas-mode .etiquetas-reserva-print-only * {
      visibility: visible;
    }
    body.print-etiquetas-mode .etiquetas-reserva-print-only {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      padding: 0;
      margin: 0;
      display: block !important;
      background: white;
    }
    body:not(.print-etiquetas-mode) .etiquetas-reserva-print-only {
      display: none !important;
    }
    .no-print { display: none !important; }
    .etiqueta-reserva-card {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    @page { size: A4; margin: 10mm; }
  }
  @media screen {
    .etiquetas-reserva-print-only { display: none !important; }
  }
`;

export function useEtiquetasReservaPrint({ clientName, labelCount }: Props) {
  const labels = useMemo(
    () => buildEtiquetasReservaItems(clientName, labelCount),
    [clientName, labelCount],
  );

  useClearEtiquetasReservaPrintMode();

  const imprimir = useCallback(async () => {
    if (labelCount <= 0) return;
    await preloadEtiquetaReservaImage();
    document.body.classList.add("print-etiquetas-mode");
    window.print();
  }, [labelCount]);

  const printArea = <EtiquetasReservaPrintArea labels={labels} />;

  return { imprimir, printArea };
}
