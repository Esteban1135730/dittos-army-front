/** Ciudad Bogotá: sin tildes, minúsculas; igual a `bogota` o la contiene. */
export function isCiudadBogota(ciudad: string | null | undefined): boolean {
  const n = (ciudad ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!n) return false;
  return n === "bogota" || n.includes("bogota");
}
