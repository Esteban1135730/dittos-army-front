import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import {
  clearGeocodeCache,
  geocodeBogotaAddress,
} from "./geocode-nominatim";

vi.mock("axios");

afterEach(() => {
  clearGeocodeCache();
  vi.restoreAllMocks();
});

describe("geocodeBogotaAddress", () => {
  it("éxito vía API → lat/lng y cachea por texto", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { ok: true, lat: 4.65, lng: -74.08 },
    });

    const first = await geocodeBogotaAddress("Unicentro local 203");
    const second = await geocodeBogotaAddress("  Unicentro local 203  ");
    expect(first).toEqual({ lat: 4.65, lng: -74.08 });
    expect(second).toEqual({ lat: 4.65, lng: -74.08 });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(vi.mocked(axios.get).mock.calls[0]?.[1]).toMatchObject({
      params: { q: "Unicentro local 203" },
    });
  });

  it("ok false → omitir (null)", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { ok: false, lat: null, lng: null },
    });
    await expect(geocodeBogotaAddress("Medellín centro")).resolves.toBeNull();
  });
});
