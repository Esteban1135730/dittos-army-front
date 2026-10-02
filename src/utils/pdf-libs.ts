/** jsPDF (+ autotable) bajo demanda: solo se descargan al generar un PDF. */
export async function loadJsPdf() {
  return (await import("jspdf")).jsPDF;
}

export async function loadJsPdfWithAutoTable() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
}
