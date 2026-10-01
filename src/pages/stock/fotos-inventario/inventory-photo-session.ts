export type MissingPhotoRow = {
  _id: string;
  card_id: string;
  card_name: string;
  image_url: string;
  language?: string;
  rareza?: string | null;
  card_state: string;
};

export type InventoryPhotoSessionMode = "edit" | "retake";

export type InventoryPhotoSessionState = {
  stockId: string;
  mode: InventoryPhotoSessionMode;
  photoPath?: string;
  row: MissingPhotoRow;
};

export function isInventoryPhotoSessionState(
  value: unknown,
): value is InventoryPhotoSessionState {
  if (!value || typeof value !== "object") return false;
  const v = value as InventoryPhotoSessionState;
  return (
    typeof v.stockId === "string" &&
    (v.mode === "edit" || v.mode === "retake") &&
    typeof v.row === "object" &&
    v.row != null &&
    typeof v.row._id === "string"
  );
}
