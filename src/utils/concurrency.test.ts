import { describe, expect, it } from "vitest";
import { mapSettledWithConcurrency, mapWithConcurrency } from "./concurrency";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("mapWithConcurrency", () => {
  it("lista vacía → []", async () => {
    await expect(mapWithConcurrency([], async () => 1)).resolves.toEqual([]);
  });

  it("conserva el orden de entrada aunque terminen desordenadas", async () => {
    const delays = [30, 5, 20, 1, 10];
    const out = await mapWithConcurrency(
      delays,
      (ms, i) => new Promise<string>((r) => setTimeout(() => r(`#${i}:${ms}`), ms)),
      2,
    );
    expect(out).toEqual(["#0:30", "#1:5", "#2:20", "#3:1", "#4:10"]);
  });

  it("nunca supera el límite de tareas en vuelo", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await mapWithConcurrency(
      items,
      async (n) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, n % 3));
        inFlight--;
        return n;
      },
      6,
    );
    expect(maxInFlight).toBe(6);
  });

  it("arranca las primeras N en paralelo (no secuencial)", async () => {
    const gates = [deferred<void>(), deferred<void>(), deferred<void>()];
    const started: number[] = [];
    const p = mapWithConcurrency(
      [0, 1, 2],
      async (i) => {
        started.push(i);
        await gates[i].promise;
        return i;
      },
      3,
    );
    await tick();
    expect(started).toEqual([0, 1, 2]);
    gates.forEach((g) => g.resolve());
    await expect(p).resolves.toEqual([0, 1, 2]);
  });

  it("rechaza con el primer error y no arranca ítems nuevos", async () => {
    const started: number[] = [];
    const p = mapWithConcurrency(
      [0, 1, 2, 3, 4],
      async (i) => {
        started.push(i);
        if (i === 0) throw new Error("boom");
        await tick();
        return i;
      },
      1,
    );
    await expect(p).rejects.toThrow("boom");
    expect(started).toEqual([0]);
  });

  it("concurrency inválida se normaliza a 1", async () => {
    let maxInFlight = 0;
    let inFlight = 0;
    await mapWithConcurrency(
      [1, 2, 3],
      async (n) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await tick();
        inFlight--;
        return n;
      },
      0,
    );
    expect(maxInFlight).toBe(1);
  });
});

describe("mapSettledWithConcurrency", () => {
  it("reporta éxito/error por posición sin rechazar", async () => {
    const out = await mapSettledWithConcurrency([1, 2, 3], async (n) => {
      if (n === 2) throw new Error("fallo 2");
      return n * 10;
    });
    expect(out[0]).toEqual({ ok: true, value: 10 });
    expect(out[1].ok).toBe(false);
    expect((out[1] as { error: Error }).error.message).toBe("fallo 2");
    expect(out[2]).toEqual({ ok: true, value: 30 });
  });
});
