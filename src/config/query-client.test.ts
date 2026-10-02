import { afterEach, describe, expect, it, vi } from "vitest";
import axios, { type AxiosAdapter } from "axios";
import { QueryClient, QueryObserver, focusManager } from "@tanstack/react-query";
import {
  QUERY_DEFAULT_STALE_TIME_MS,
  createPanelQueryClient,
  installStaleOnWriteInterceptor,
  isOperationalQueryKey,
  isPersistableQueryKey,
  refetchOperationalOnWindowFocus,
  shouldPersistQuery,
} from "./query-client";

describe("createPanelQueryClient", () => {
  it("staleTime 30s y refetch al enfocar solo para listas operativas", () => {
    const qc = createPanelQueryClient();
    const q = qc.getDefaultOptions().queries;
    expect(q?.staleTime).toBe(QUERY_DEFAULT_STALE_TIME_MS);
    expect(q?.refetchOnWindowFocus).toBe(refetchOperationalOnWindowFocus);
    expect(q?.gcTime).toBe(1000 * 60 * 60 * 24);
  });

  describe("al volver a enfocar la ventana", () => {
    afterEach(() => {
      focusManager.setFocused(undefined);
    });

    async function observe(qc: QueryClient, queryKey: unknown[]) {
      const queryFn = vi.fn(async () => [1]);
      const observer = new QueryObserver(qc, { queryKey, queryFn });
      const unsubscribe = observer.subscribe(() => undefined);
      await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
      return { queryFn, unsubscribe };
    }

    it("refetchea listas operativas aunque sigan frescas y no el resto", async () => {
      const qc = createPanelQueryClient();
      qc.mount();
      const stock = await observe(qc, ["stock", "pablo"]);
      const ventas = await observe(qc, ["sales-mobile-pending"]);
      const catalog = await observe(qc, ["catalog-sets", "pokemon"]);
      const metricas = await observe(qc, ["metricas"]);

      focusManager.setFocused(false);
      focusManager.setFocused(true);

      await vi.waitFor(() => {
        expect(stock.queryFn).toHaveBeenCalledTimes(2);
        expect(ventas.queryFn).toHaveBeenCalledTimes(2);
      });
      expect(catalog.queryFn).toHaveBeenCalledTimes(1);
      expect(metricas.queryFn).toHaveBeenCalledTimes(1);

      for (const o of [stock, ventas, catalog, metricas]) o.unsubscribe();
      qc.unmount();
      qc.clear();
    });
  });
});

describe("isOperationalQueryKey", () => {
  it.each([
    [["stock"]],
    [["stock", "pablo"]],
    [["stock", "qr-export", "pablo"]],
    [["stock", "perdidas"]],
    [["reservas"]],
    [["reservas", "c1"]],
    [["reservas-incoming"]],
    [["reservas-incoming", "c1"]],
    [["clientes"]],
    [["client", "c1"]],
    [["pedidos", "c1"]],
    [["sales-dashboard"]],
    [["sales-history"]],
    [["ventas-cliente", "c1"]],
    [["sales-mobile-pending"]],
  ])("operativa %j", (key) => {
    expect(isOperationalQueryKey(key)).toBe(true);
  });

  it.each([
    [["catalog-sets", "pokemon"]],
    [["expansiones", "es"]],
    [["pedido-tiendas"]],
    [["dashboard-overview", "v2"]],
    [["metricas"]],
    [["stock-review", "active"]],
    [["property-cards"]],
    [["cardtrader", "cart", "ditto"]],
    [["cardtrader-transit-lots-open"]],
    [["incoming-homolog-active"]],
    [[42]],
    [[]],
  ])("no operativa %j", (key) => {
    expect(isOperationalQueryKey(key)).toBe(false);
  });
});

describe("isPersistableQueryKey", () => {
  it.each([
    [["catalog-sets", "yugioh"]],
    [["expansiones", "es"]],
    [["pedido-tiendas"]],
    [["cardtrader", "expansions", 1]],
  ])("persiste %j", (key) => {
    expect(isPersistableQueryKey(key)).toBe(true);
  });

  it.each([
    [["stock"]],
    [["stock", "qr-export"]],
    [["stock-for-dashboard"]],
    [["sales-dashboard"]],
    [["sales-history"]],
    [["reservas"]],
    [["reservas-incoming"]],
    [["clientes"]],
    [["client", "c1"]],
    [["pedidos", "c1"]],
    [["incoming-homolog-active"]],
    [["cardtrader", "blueprints", 5]],
    [["cardtrader", "marketplace", "expansion", 5]],
    [["cardtrader", "cart", "ditto"]],
    [["cardtrader-transit-lots-open"]],
    [["dashboard-overview", "v2"]],
    [["metricas"]],
    [[42]],
    [[]],
  ])("no persiste %j", (key) => {
    expect(isPersistableQueryKey(key)).toBe(false);
  });
});

describe("shouldPersistQuery", () => {
  it("solo queries exitosas con clave permitida", async () => {
    const qc = new QueryClient();
    await qc.prefetchQuery({ queryKey: ["pedido-tiendas"], queryFn: async () => [1] });
    await qc.prefetchQuery({ queryKey: ["stock"], queryFn: async () => [1] });
    await qc
      .prefetchQuery({
        queryKey: ["expansiones", "es"],
        queryFn: async () => {
          throw new Error("x");
        },
        retry: false,
      })
      .catch(() => undefined);

    const cache = qc.getQueryCache();
    expect(shouldPersistQuery(cache.find({ queryKey: ["pedido-tiendas"] })!)).toBe(true);
    expect(shouldPersistQuery(cache.find({ queryKey: ["stock"] })!)).toBe(false);
    expect(shouldPersistQuery(cache.find({ queryKey: ["expansiones", "es"] })!)).toBe(false);
  });
});

describe("installStaleOnWriteInterceptor", () => {
  function setup(status = 200) {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const adapter: AxiosAdapter = async (config) => {
      const res = { data: {}, status, statusText: "", headers: {}, config };
      if (status >= 400) {
        throw Object.assign(new Error("fail"), { config, response: res, isAxiosError: true });
      }
      return res;
    };
    const http = axios.create({ adapter });
    installStaleOnWriteInterceptor(qc, http);
    return { http, invalidate };
  }

  it("GET no invalida", async () => {
    const { http, invalidate } = setup();
    await http.get("/x");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it.each(["post", "put", "patch", "delete"] as const)(
    "%s marca todo como obsoleto sin refetch",
    async (method) => {
      const { http, invalidate } = setup();
      await http.request({ url: "/x", method });
      expect(invalidate).toHaveBeenCalledWith({ refetchType: "none" });
    },
  );

  it("escritura fallida también marca obsoleto y propaga el error", async () => {
    const { http, invalidate } = setup(500);
    await expect(http.post("/x")).rejects.toThrow("fail");
    expect(invalidate).toHaveBeenCalledWith({ refetchType: "none" });
  });
});
