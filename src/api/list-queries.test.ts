import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

vi.mock("axios");
vi.mock("../config/api", () => ({
  apiUrl: (p: string) => `http://api${p}`,
}));

import {
  fetchClientById,
  fetchClientesRaw,
  fetchStockListRaw,
  selectClientList,
  selectStockVisibleInGrid,
} from "./list-queries";
import type { StockListItem } from "../types/stock";

afterEach(() => {
  vi.resetAllMocks();
});

describe("fetchStockListRaw", () => {
  it("devuelve todas las líneas sin filtrar (vendidas/propiedad incluidas)", async () => {
    const rows = [
      { _id: "1", card_state: "disponible" },
      { _id: "2", card_state: "vendida" },
      { _id: "3", card_state: "propiedad" },
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: rows });
    await expect(fetchStockListRaw()).resolves.toEqual(rows);
    expect(axios.get).toHaveBeenCalledWith("http://api/stock", undefined);
  });

  it("con owner usa ownerOverride", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    await fetchStockListRaw("ditto" as never);
    expect(axios.get).toHaveBeenCalledWith("http://api/stock", { ownerOverride: "ditto" });
  });

  it("respuesta no array → []", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [] } });
    await expect(fetchStockListRaw()).resolves.toEqual([]);
  });
});

describe("selectStockVisibleInGrid", () => {
  it("excluye vendidas y propiedad (misma vista que la grilla)", () => {
    const rows = [
      { _id: "1", card_state: "disponible" },
      { _id: "2", card_state: "vendida" },
      { _id: "3", card_state: "propiedad" },
      { _id: "4", card_state: "reserva" },
    ] as StockListItem[];
    expect(selectStockVisibleInGrid(rows).map((r) => r._id)).toEqual(["1", "4"]);
  });
});

describe("clientes", () => {
  it("fetchClientesRaw guarda la respuesta cruda; selectClientList normaliza", async () => {
    const raw = [{ id: "c1", nombre: "Ana" }, { nombre: "sin id" }, null];
    vi.mocked(axios.get).mockResolvedValue({ data: raw });
    const stored = await fetchClientesRaw();
    expect(stored).toEqual(raw);
    const list = selectClientList(stored);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ _id: "c1", nombre: "Ana", metodo_contacto: "whatsapp" });
  });

  it("fetchClientById normaliza la ficha", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { id: "c1", nombre: "Ana" } });
    await expect(fetchClientById("c1")).resolves.toMatchObject({ _id: "c1", nombre: "Ana" });
    expect(axios.get).toHaveBeenCalledWith("http://api/client/c1");
  });

  it("fetchClientById lanza si el servidor no devuelve una ficha válida", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: null });
    await expect(fetchClientById("c1")).rejects.toThrow("Cliente no encontrado en el servidor.");
  });
});
