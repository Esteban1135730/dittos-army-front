/** Catálogos alineados a tablas Factus/DIAN (códigos en `value`). */

export type SelectOption = { value: string; label: string; hint?: string };

/** Tipos de identificación — `identification_document_code` Factus */
export const ID_DOCUMENT_TYPES: SelectOption[] = [
  { value: "13", label: "CC — Cédula de ciudadanía", hint: "Persona natural" },
  { value: "22", label: "CE — Cédula de extranjería" },
  { value: "31", label: "NIT", hint: "Persona jurídica o natural con NIT" },
  { value: "12", label: "TI — Tarjeta de identidad" },
  { value: "41", label: "PP — Pasaporte" },
  { value: "42", label: "DOC extranjero" },
];

/** `legal_organization_code` */
export const LEGAL_ORGANIZATION: SelectOption[] = [
  { value: "2", label: "Persona natural" },
  { value: "1", label: "Persona jurídica" },
];

/** `tribute_code` — responsabilidades frecuentes */
export const TRIBUTE_CODES: SelectOption[] = [
  { value: "ZZ", label: "ZZ — No aplica / sin responsabilidad" },
  { value: "O-47", label: "O-47 — Régimen ordinario" },
  { value: "O-13", label: "O-13 — Gran contribuyente" },
  { value: "O-15", label: "O-15 — Autorretenedor" },
  { value: "O-23", label: "O-23 — Agente retención IVA" },
  { value: "R-99-PN", label: "R-99-PN — No responsable (persona natural)" },
];

/** `payment_form` */
export const PAYMENT_FORMS: SelectOption[] = [
  { value: "1", label: "Contado" },
  { value: "2", label: "Crédito" },
];

/** `payment_method_code` — métodos habituales */
export const PAYMENT_METHODS: SelectOption[] = [
  { value: "10", label: "Efectivo" },
  { value: "49", label: "Tarjeta débito" },
  { value: "48", label: "Tarjeta crédito" },
  { value: "42", label: "Consignación bancaria" },
  { value: "45", label: "Transferencia" },
  { value: "47", label: "Pago en línea / PSE" },
];

/** Unidad de medida por defecto en ítems (unidad) */
export const DEFAULT_UNIT_MEASURE = "94";

export const LINE_PRESETS: { label: string; description: string }[] = [
  { label: "Cartas TCG", description: "Cartas TCG — venta mostrador" },
  { label: "Sobres / booster", description: "Producto sellado TCG" },
  { label: "Accesorio", description: "Accesorio coleccionable" },
  { label: "Servicio", description: "Servicio en tienda" },
];

export type MunicipalityOption = { code: string; name: string };

export type DepartmentOption = {
  code: string;
  name: string;
  municipalities: MunicipalityOption[];
};

/** Municipios frecuentes (código DIAN). Ampliar con API Factus si hace falta. */
export const CO_DEPARTMENTS: DepartmentOption[] = [
  {
    code: "11",
    name: "Bogotá D.C.",
    municipalities: [{ code: "11001", name: "Bogotá D.C." }],
  },
  {
    code: "05",
    name: "Antioquia",
    municipalities: [
      { code: "05001", name: "Medellín" },
      { code: "05088", name: "Bello" },
      { code: "05360", name: "Itagüí" },
      { code: "05631", name: "Sabaneta" },
    ],
  },
  {
    code: "08",
    name: "Atlántico",
    municipalities: [
      { code: "08001", name: "Barranquilla" },
      { code: "08758", name: "Soledad" },
    ],
  },
  {
    code: "76",
    name: "Valle del Cauca",
    municipalities: [
      { code: "76001", name: "Cali" },
      { code: "76364", name: "Palmira" },
    ],
  },
  {
    code: "25",
    name: "Cundinamarca",
    municipalities: [
      { code: "25269", name: "Facatativá" },
      { code: "25754", name: "Soacha" },
      { code: "25175", name: "Chía" },
    ],
  },
  {
    code: "68",
    name: "Santander",
    municipalities: [{ code: "68001", name: "Bucaramanga" }],
  },
];

export const FORM_STEPS = [
  "Cliente (adquiriente)",
  "Pago y documento",
  "Ítems",
  "Revisar",
] as const;
