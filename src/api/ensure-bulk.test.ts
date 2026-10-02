import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

vi.mock("axios");
vi.mock("../config/api", () => {
  let owner = "ditto";
  let tcg = "pokemon";
  return {
    apiUrl: (p: string) => `http://api${p}`,
    getApiOwnerHeader: () => owner,
    getApiTcgHeader: () => tcg,
    __setScope: (o: string, t: string) => {
      owner = o;
      tcg = t;
    },
  };
});

import * as apiConfig from "../config/api";
import { ensureBulkProduct, resetEnsureBulkCacheForTests } from "./ensure-bulk";

const setScope = (apiConfig as unknown as { __setScope: (o: string, t: string) => void })
  .__setScope;

const okBody = (created: boolean) => ({
  data: {
    stock_id: "s1",
    card_id: "bulk",
    card_name: "Bulk",
    product_kind: "quantity",
    quantity: 0,
    created,
    pvp_ensured: true,
  },
});

beforeEach(() => {
  resetEnsureBulkCacheForTests();
  setScope("ditto", "pokemon");
  vi.mocked(axios.isAxiosError).mockReturnValue(false);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("ensureBulkProduct", () => {
  it("solo hace un POST por sesión y scope; los siguientes ven created=false", async () => {
    vi.mocked(axios.post).mockResolvedValue(okBody(true));

    const [a, b] = await Promise.all([ensureBulkProduct(), ensureBulkProduct()]);
    const c = await ensureBulkProduct();

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(a).toMatchObject({ ok: true, data: { created: true } });
    expect(b).toMatchObject({ ok: true, data: { created: false } });
    expect(c).toMatchObject({ ok: true, data: { created: false } });
  });

  it("cambiar de owner o TCG vuelve a llamar", async () => {
    vi.mocked(axios.post).mockResolvedValue(okBody(false));

    await ensureBulkProduct();
    setScope("otro", "pokemon");
    await ensureBulkProduct();
    setScope("otro", "yugioh");
    await ensureBulkProduct();
    setScope("ditto", "pokemon");
    await ensureBulkProduct();

    expect(axios.post).toHaveBeenCalledTimes(3);
  });

  it("un fallo no se memoriza: el siguiente intento reintenta", async () => {
    vi.mocked(axios.post)
      .mockRejectedValueOnce(new Error("red"))
      .mockResolvedValueOnce(okBody(true));

    const first = await ensureBulkProduct();
    const second = await ensureBulkProduct();

    expect(first).toEqual({ ok: false, error: "No se pudo asegurar el SKU bulk" });
    expect(second).toMatchObject({ ok: true, data: { created: true } });
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});
