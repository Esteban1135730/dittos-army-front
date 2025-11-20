import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { StockItem } from "../pages/stock/grid-stock";

export const exportToPDF = async (
  stock: StockItem[],
  convertToCOP: (euros: number) => number | null,
  onFinish?: () => void
) => {
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

  const cardWidth = 130;
  const cardHeight = 180;
  const marginX = 20;
  const marginY = 20;
  const spacingX = 10;
  const spacingY = 10;

  const cardsPerRow = 4;
  const cardsPerCol = 4;
  const cardsPerPage = cardsPerRow * cardsPerCol;

  // Agrupar cartas duplicadas
  const grouped = new Map<string, { item: StockItem; cantidad: number }>();
  stock.forEach((item) => {
    const key = `${item.card_name}_${item.card_cost.toFixed(2)}`;
    if (grouped.has(key)) {
      grouped.get(key)!.cantidad += 1;
    } else {
      grouped.set(key, { item, cantidad: 1 });
    }
  });

  // Orden alfabético
  const cartasOrdenadas = Array.from(grouped.values()).sort((a, b) =>
    a.item.card_name.localeCompare(b.item.card_name)
  );

  for (let i = 0; i < cartasOrdenadas.length; i++) {
    const { item, cantidad } = cartasOrdenadas[i];

    const indexInPage = i % cardsPerPage;
    const col = indexInPage % cardsPerRow;
    const row = Math.floor(indexInPage / cardsPerRow);

    const x = marginX + col * (cardWidth + spacingX);
    const y = marginY + row * (cardHeight + spacingY);

    const cardDiv = document.createElement("div");
    cardDiv.style.width = `${cardWidth}px`;
    cardDiv.style.height = `${cardHeight}px`;
    cardDiv.style.display = "flex";
    cardDiv.style.flexDirection = "column";
    cardDiv.style.alignItems = "center";
    cardDiv.style.justifyContent = "start";
    cardDiv.style.border = "1px solid #ccc";
    cardDiv.style.backgroundColor = "white";
    cardDiv.style.fontSize = "8px";
    cardDiv.style.boxSizing = "border-box";
    cardDiv.style.padding = "2px";

    const img = document.createElement("img");
    img.src = item.image_url;
    img.style.width = "100px";
    img.style.height = "130px";
    img.style.objectFit = "cover";
    cardDiv.appendChild(img);

    const nameDiv = document.createElement("div");
    nameDiv.textContent = item.card_name;
    nameDiv.style.textAlign = "center";
    nameDiv.style.marginTop = "4px";
    cardDiv.appendChild(nameDiv);

    const priceDiv = document.createElement("div");
    priceDiv.textContent = `€${item.card_cost.toFixed(2)} / COP ${convertToCOP(item.card_cost)?.toFixed(0) ?? "—"}`;
    priceDiv.style.textAlign = "center";
    cardDiv.appendChild(priceDiv);

    if (cantidad > 1) {
      const qtyDiv = document.createElement("div");
      qtyDiv.textContent = `Cantidad: ${cantidad}`;
      qtyDiv.style.textAlign = "center";
      cardDiv.appendChild(qtyDiv);
    }

    document.body.appendChild(cardDiv);

    try {
      await new Promise((res, rej) => {
        if (img.complete) return res(true);
        img.onload = () => res(true);
        img.onerror = () => rej("Error al cargar imagen");
      });

      const canvas = await html2canvas(cardDiv, {
        scale: 1.5,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.5); // calidad reducida
      pdf.addImage(imgData, "JPEG", x, y, cardWidth, cardHeight);
    } catch (err) {
      console.warn("❌ Error al renderizar carta:", item.card_name, err);
    } finally {
      document.body.removeChild(cardDiv);
    }

    const isLastCard = i === cartasOrdenadas.length - 1;
    if ((indexInPage === cardsPerPage - 1) && !isLastCard) {
      pdf.addPage();
    }
  }

  pdf.save("inventario_cartas.pdf");

  if (onFinish) onFinish();
};
