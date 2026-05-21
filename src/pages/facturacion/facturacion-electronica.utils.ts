import type { ClientItem } from "../clientes/cliente-types";
import {
  LEGAL_ORGANIZATION,
  PAYMENT_FORMS,
  PAYMENT_METHODS,
  TRIBUTE_CODES,
  type SelectOption,
} from "./facturacion-electronica.constants";

export type BillableItem = {
  key: string;
  source: "reserva" | "venta";
  sourceId: string;
  stockId: string;
  cardId: string;
  cardName: string;
  variant?: string;
  amountCop: number;
  currencyLabel?: string;
  createdAt?: string;
};

export type InvoiceLineForm = {
  description: string;
  quantity: number;
  unitPriceCop: number;
  codeReference: string;
  /** Evita duplicar la misma reserva/venta al añadir desde el picker */
  sourceKey?: string;
};

export type FacturaElectronicaForm = {
  personKind: "1" | "2";
  idDocumentCode: string;
  identification: string;
  dv: string;
  names: string;
  company: string;
  tradeName: string;
  email: string;
  phone: string;
  address: string;
  departmentCode: string;
  municipalityCode: string;
  tributeCode: string;
  paymentForm: string;
  paymentMethodCode: string;
  dueDate: string;
  sendEmail: boolean;
  orderReference: string;
  internalReference: string;
  observation: string;
  lines: InvoiceLineForm[];
};

export const emptyLine = (): InvoiceLineForm => ({
  description: "",
  quantity: 1,
  unitPriceCop: 0,
  codeReference: "",
});

export const defaultForm = (): FacturaElectronicaForm => ({
  personKind: "2",
  idDocumentCode: "13",
  identification: "",
  dv: "",
  names: "",
  company: "",
  tradeName: "",
  email: "",
  phone: "",
  address: "",
  departmentCode: "11",
  municipalityCode: "11001",
  tributeCode: "O-47",
  paymentForm: "1",
  paymentMethodCode: "10",
  dueDate: "",
  sendEmail: true,
  orderReference: "",
  internalReference: "",
  observation: "",
  lines: [
    {
      description: "Cartas TCG — venta mostrador",
      quantity: 1,
      unitPriceCop: 0,
      codeReference: "TCG-001",
    },
  ],
});

export function calcNitVerificationDigit(nit: string): string {
  const digits = nit.replace(/\D/g, "");
  if (!digits) return "";
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[digits.length - 1 - i], 10) * weights[i];
  }
  const mod = sum % 11;
  if (mod < 2) return String(mod);
  return String(11 - mod);
}

export function optionLabel(options: SelectOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function shortDocType(code: string): string {
  const map: Record<string, string> = {
    "13": "CC",
    "22": "CE",
    "31": "NIT",
    "12": "TI",
    "41": "PP",
    "42": "DOC",
  };
  return map[code] ?? "CC";
}

export function lineSubtotal(line: InvoiceLineForm): number {
  return Math.max(0, line.quantity) * Math.max(0, line.unitPriceCop);
}

export function formTotalCop(form: FacturaElectronicaForm): number {
  return form.lines.reduce((s, l) => s + lineSubtotal(l), 0);
}

export function applyClientToForm(
  form: FacturaElectronicaForm,
  client: ClientItem
): FacturaElectronicaForm {
  return {
    ...form,
    personKind: "2",
    idDocumentCode: "13",
    names: client.nombre,
    tradeName: client.tienda_entrega,
    phone: client.celular ?? form.phone,
    observation: client.notas
      ? `Cliente reserva: ${client.notas}`
      : form.observation,
    internalReference: client._id,
  };
}

/** Payload actual del backend Nest (`CreateElectronicInvoiceDto`). */
export function buildApiPayload(form: FacturaElectronicaForm) {
  const isJuridica = form.personKind === "1";
  const customerName = isJuridica
    ? form.company.trim() || form.tradeName.trim()
    : form.names.trim();

  const paymentLabel = `${optionLabel(PAYMENT_FORMS, form.paymentForm)} — ${optionLabel(
    PAYMENT_METHODS,
    form.paymentMethodCode
  )}`;

  return {
    customerName,
    customerIdentification: form.identification.replace(/\D/g, ""),
    customerDocumentType: shortDocType(form.idDocumentCode),
    customerDv:
      form.idDocumentCode === "31" ? form.dv || undefined : undefined,
    legalCompanyName: isJuridica ? form.company.trim() || undefined : undefined,
    customerEmail: form.email.trim() || undefined,
    customerPhone: form.phone.trim() || undefined,
    customerAddress: form.address.trim() || undefined,
    customerCity: undefined,
    customerDepartment: undefined,
    customerMunicipalityCode: form.municipalityCode || undefined,
    taxResponsibility: optionLabel(TRIBUTE_CODES, form.tributeCode),
    paymentMethod: paymentLabel,
    paymentDueDate:
      form.paymentForm === "2" && form.dueDate ? form.dueDate : undefined,
    referenceOrder: form.orderReference.trim() || undefined,
    internalReference: form.internalReference.trim() || undefined,
    notes: [
      form.observation.trim(),
      form.tradeName.trim() ? `Nombre comercial: ${form.tradeName.trim()}` : "",
      `Enviar correo: ${form.sendEmail ? "sí" : "no"}`,
      `Org. legal: ${optionLabel(LEGAL_ORGANIZATION, form.personKind)}`,
      `Doc. Factus: ${form.idDocumentCode}`,
      `Forma pago: ${form.paymentForm}`,
      `Método pago: ${form.paymentMethodCode}`,
    ]
      .filter(Boolean)
      .join(" | "),
    lines: form.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPriceCop: l.unitPriceCop,
    })),
  };
}

export function validateStep(
  step: number,
  form: FacturaElectronicaForm
): string[] {
  const errors: string[] = [];
  const id = form.identification.replace(/\D/g, "");

  if (step === 0) {
    if (!id) errors.push("Número de identificación obligatorio.");
    if (form.personKind === "2" && !form.names.trim()) {
      errors.push("Nombre del cliente obligatorio (persona natural).");
    }
    if (form.personKind === "1" && !form.company.trim()) {
      errors.push("Razón social obligatoria (persona jurídica).");
    }
    if (form.idDocumentCode === "31" && !form.dv.trim()) {
      errors.push("DV del NIT obligatorio (o usa «Calcular DV»).");
    }
    if (!form.municipalityCode) {
      errors.push("Selecciona municipio (código DIAN).");
    }
  }

  if (step === 1) {
    if (form.paymentForm === "2" && !form.dueDate) {
      errors.push("Fecha de vencimiento obligatoria para pago a crédito.");
    }
    if (form.observation.length > 250) {
      errors.push("Observación máximo 250 caracteres (límite Factus).");
    }
  }

  if (step === 2) {
    if (form.lines.length === 0) {
      errors.push("Añade al menos un ítem.");
    }
    form.lines.forEach((l, i) => {
      if (!l.description.trim()) {
        errors.push(`Ítem ${i + 1}: descripción obligatoria.`);
      }
      if (l.quantity < 1) errors.push(`Ítem ${i + 1}: cantidad mínima 1.`);
      if (l.unitPriceCop <= 0) {
        errors.push(`Ítem ${i + 1}: valor unitario debe ser mayor a 0.`);
      }
    });
  }

  if (step === 3 && formTotalCop(form) <= 0) {
    errors.push("El total de la factura debe ser mayor a 0.");
  }

  return errors;
}

export function formatCop(value: number): string {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}
