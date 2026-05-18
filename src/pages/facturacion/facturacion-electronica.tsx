import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { apiClient, getApiBaseUrl } from "../../api/client";

type InvoiceLine = {
  description: string;
  quantity: number;
  unitPriceCop: number;
};

type InvoiceResponse = Record<string, unknown>;

const emptyLine = (): InvoiceLine => ({
  description: "",
  quantity: 1,
  unitPriceCop: 0,
});

export default function FacturacionElectronicaPage() {
  const [customerName, setCustomerName] = useState("");
  const [customerIdentification, setCustomerIdentification] = useState("");
  const [customerDocumentType, setCustomerDocumentType] = useState("CC");
  const [customerDv, setCustomerDv] = useState("");
  const [legalCompanyName, setLegalCompanyName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerDepartment, setCustomerDepartment] = useState("");
  const [customerMunicipalityCode, setCustomerMunicipalityCode] = useState("");
  const [taxResponsibility, setTaxResponsibility] = useState(
    "O-47 Régimen ordinario"
  );
  const [paymentMethod, setPaymentMethod] = useState("Contado — efectivo");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [referenceOrder, setReferenceOrder] = useState("");
  const [internalReference, setInternalReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([
    { description: "Cartas TCG — venta mostrador", quantity: 1, unitPriceCop: 0 },
  ]);

  const [invoiceId, setInvoiceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null);

  const subtotalCop = useMemo(
    () =>
      lines.reduce((s, l) => s + l.quantity * l.unitPriceCop, 0),
    [lines]
  );

  const updateLine = (index: number, patch: Partial<InvoiceLine>) => {
    setLines((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) =>
    setLines((prev) => prev.filter((_, i) => i !== index));

  const createInvoice = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await apiClient.post(`/billing/factus/invoice`, {
        customerName,
        customerIdentification,
        customerDocumentType,
        customerDv: customerDv || undefined,
        legalCompanyName: legalCompanyName || undefined,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        customerAddress: customerAddress || undefined,
        customerCity: customerCity || undefined,
        customerDepartment: customerDepartment || undefined,
        customerMunicipalityCode: customerMunicipalityCode || undefined,
        taxResponsibility: taxResponsibility || undefined,
        paymentMethod: paymentMethod || undefined,
        paymentDueDate: paymentDueDate || undefined,
        referenceOrder: referenceOrder || undefined,
        internalReference: internalReference || undefined,
        notes: notes || undefined,
        lines,
      });

      const created = res.data?.invoice as InvoiceResponse;
      setInvoice(created);
      const id = created?._id;
      if (typeof id === "string") setInvoiceId(id);
      setMessage("Borrador creado: se guardó en MongoDB con estado draft.");
    } catch {
      setMessage("No fue posible crear la factura (revisa que el API esté arriba).");
    } finally {
      setLoading(false);
    }
  };

  const sendInvoice = async () => {
    if (!invoiceId) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await apiClient.post(
        `/billing/factus/invoice/${invoiceId}/send`
      );
      setInvoice(res.data?.invoice ?? null);
      setMessage(
        "Enviado: se llamó a Factus (REST) y al adaptador SOAP interno; estado actualizado."
      );
    } catch {
      setMessage("No fue posible enviar la factura.");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!invoiceId) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await apiClient.get(
        `/billing/factus/invoice/${invoiceId}/status`
      );
      setInvoice(res.data?.invoice ?? null);
      setMessage("Estado sincronizado desde Factus (si hay token configurado).");
    } catch {
      setMessage("No fue posible consultar el estado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold">Facturación electrónica</h1>
        <p className="text-sm text-gray-600 mt-1">
          Formulario ampliado con datos típicos del adquiriente y del documento.
          Usa la misma base URL que el resto de la app ({getApiBaseUrl()}).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold mb-2">Qué hace «Crear borrador»</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Calcula el <strong>total en COP</strong> sumando cantidad × valor
              unitario de cada línea.
            </li>
            <li>
              Genera un <strong>external_id</strong> único y guarda todo en{" "}
              <strong>MongoDB</strong> con estado <code>draft</code> (no sale a
              Factus).
            </li>
            <li>
              Devuelve el <strong>_id</strong> del documento para los pasos
              siguientes.
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold mb-2">Qué hace «Enviar»</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Lee el borrador guardado (incluye líneas y datos de contacto).
            </li>
            <li>
              Llama a <strong>Factus REST</strong> (sandbox o real según{" "}
              <code>FACTUS_API_TOKEN</code>) para validar/enviar el payload.
            </li>
            <li>
              Ejecuta el <strong>adaptador SOAP interno</strong> (genera sobre
              XML y registra un tracking simulado).
            </li>
            <li>
              Actualiza la factura con <code>factus_document_id</code>,{" "}
              <code>soap_tracking_id</code> y estado devuelto.
            </li>
          </ul>
        </div>
      </div>

      <form
        onSubmit={createInvoice}
        className="bg-white shadow rounded-lg p-5 space-y-6 border"
      >
        <section>
          <h2 className="text-lg font-medium text-gray-800 mb-3">
            Adquiriente (comprador)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-gray-600">Nombre / nombre comercial</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Identificación</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={customerIdentification}
                onChange={(e) => setCustomerIdentification(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Tipo documento</span>
              <select
                className="mt-1 w-full border rounded px-3 py-2 bg-white"
                value={customerDocumentType}
                onChange={(e) => setCustomerDocumentType(e.target.value)}
              >
                <option value="CC">CC — Cédula</option>
                <option value="CE">CE — Extranjería</option>
                <option value="NIT">NIT</option>
                <option value="TI">TI</option>
                <option value="PP">Pasaporte</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">DV (si es NIT)</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={customerDv}
                onChange={(e) => setCustomerDv(e.target.value)}
                placeholder="Ej. 6"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-gray-600">Razón social (persona jurídica)</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={legalCompanyName}
                onChange={(e) => setLegalCompanyName(e.target.value)}
                placeholder="Opcional"
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium text-gray-800 mb-3">
            Ubicación y contacto
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm md:col-span-2">
              <span className="text-gray-600">Dirección</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Ciudad</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={customerCity}
                onChange={(e) => setCustomerCity(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Departamento</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={customerDepartment}
                onChange={(e) => setCustomerDepartment(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Código municipio (opcional)</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={customerMunicipalityCode}
                onChange={(e) => setCustomerMunicipalityCode(e.target.value)}
                placeholder="Ej. según tabla DIAN"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Correo electrónico</span>
              <input
                type="email"
                className="mt-1 w-full border rounded px-3 py-2"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Teléfono / WhatsApp</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium text-gray-800 mb-3">
            Fiscal y forma de pago
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm md:col-span-2">
              <span className="text-gray-600">Responsabilidad fiscal / régimen</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={taxResponsibility}
                onChange={(e) => setTaxResponsibility(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Medio de pago</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Vencimiento (opcional)</span>
              <input
                type="date"
                className="mt-1 w-full border rounded px-3 py-2"
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Pedido / orden de compra</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={referenceOrder}
                onChange={(e) => setReferenceOrder(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Referencia interna</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={internalReference}
                onChange={(e) => setInternalReference(e.target.value)}
              />
            </label>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-gray-800">
              Detalle (líneas)
            </h2>
            <button
              type="button"
              onClick={addLine}
              className="text-sm text-blue-700 hover:underline"
            >
              + Añadir línea
            </button>
          </div>
          <div className="space-y-3">
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border-b pb-3"
              >
                <label className="block text-sm md:col-span-5">
                  <span className="text-gray-600">Descripción</span>
                  <input
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={line.description}
                    onChange={(e) =>
                      updateLine(index, { description: e.target.value })
                    }
                    required
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="text-gray-600">Cant.</span>
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(index, { quantity: Number(e.target.value) })
                    }
                    required
                  />
                </label>
                <label className="block text-sm md:col-span-3">
                  <span className="text-gray-600">Vlr. unitario COP</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={line.unitPriceCop}
                    onChange={(e) =>
                      updateLine(index, {
                        unitPriceCop: Number(e.target.value),
                      })
                    }
                    required
                  />
                </label>
                <div className="md:col-span-2 flex gap-2">
                  <span className="text-sm text-gray-500 py-2">
                    Sub:{" "}
                    {(line.quantity * line.unitPriceCop).toLocaleString("es-CO")}
                  </span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="text-sm text-red-600 px-2 py-1 rounded border border-red-200"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-right font-medium text-gray-800">
            Total ítems: {subtotalCop.toLocaleString("es-CO")} COP
          </p>
        </section>

        <label className="block text-sm">
          <span className="text-gray-600">Observaciones / notas al documento</span>
          <textarea
            className="mt-1 w-full border rounded px-3 py-2 min-h-[80px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej. Entrega en tienda, reserva #..."
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg disabled:opacity-50"
        >
          Crear borrador
        </button>
      </form>

      <div className="bg-white shadow rounded-lg p-5 border space-y-4">
        <h2 className="text-lg font-medium text-gray-800">
          Enviar y consultar estado
        </h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="border rounded px-3 py-2 flex-1 min-w-[200px]"
            placeholder="ID de factura (MongoDB _id)"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          />
          <button
            type="button"
            onClick={sendInvoice}
            disabled={loading || !invoiceId}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            Enviar
          </button>
          <button
            type="button"
            onClick={checkStatus}
            disabled={loading || !invoiceId}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            Estado
          </button>
        </div>

        {message && (
          <p className="text-sm text-gray-700 border-l-4 border-gray-400 pl-3">
            {message}
          </p>
        )}

        {invoice && (
          <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto max-h-96">
            {JSON.stringify(invoice, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
