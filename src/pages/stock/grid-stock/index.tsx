import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../api/client";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { exportToPDF, exportCatalogToPDF } from "../../../utils/pdf";
import { useExchangeRates } from "../../../utils/tasa";
import { formatCOP } from "../../../utils/convert";
import type { StockListItem } from "../../../types/stock";
import { operationalRarezaLabel } from "../../../constants/item-rareza";

export type StockItem = StockListItem;

export default function StockGrid() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [marcandoPropiedad, setMarcandoPropiedad] = useState<string | null>(
    null
  );
  const [errorPropiedad, setErrorPropiedad] = useState("");
  const [mostrarModalVenta, setMostrarModalVenta] = useState(false);
  const [ventaStockId, setVentaStockId] = useState<string | null>(null);
  const [ventaCardId, setVentaCardId] = useState<string | null>(null);
  const [precioVenta, setPrecioVenta] = useState<number | "">("");
  const [vendiendo, setVendiendo] = useState(false);
  const [errorVenta, setErrorVenta] = useState("");

  const {
    data: stock = [],
    isLoading,
    error,
  } = useQuery<StockItem[]>({
    queryKey: ["stock"],
    queryFn: async () => {
      const res = await apiClient.get("/stock");
      return Array.isArray(res.data)
        ? res.data.filter(
          (stockItem) =>
            stockItem.card_state != "vendida" &&
            stockItem.card_state != "propiedad"
        )
        : [];
    },
  });

  const { convert } = useExchangeRates();

  // Calcular precio del inventario en COP/EUR/USD
  const precioInventario = useMemo(() => {
    let totalCOP = 0;

    stock.forEach((item) => {
      if (item.currency === "COP") {
        totalCOP += item.card_cost;
      } else if (item.currency === "EUR") {
        totalCOP += convert.toCopFromEur(item.card_cost) ?? 0;
      } else if (item.currency === "USD") {
        totalCOP += convert.toCopFromUsd(item.card_cost) ?? 0;
      }
    });

    return {
      cop: totalCOP,
      eur: convert.toEurFromCop(totalCOP) ?? 0,
      usd: convert.toUsdFromCop(totalCOP) ?? 0,
    };
  }, [stock, convert]);

  // Calcular ganancia esperada en COP/EUR/USD
  const gananciaEsperada = useMemo(() => {
    let totalGananciaCOP = 0;

    stock.forEach((item) => {
      if (item.pvp && item.pvp > 0) {
        // Convertir PVP a COP
        let pvpCOP = 0;
        if (item.pvp_currency === "COP") {
          pvpCOP = item.pvp;
        } else if (item.pvp_currency === "EUR") {
          pvpCOP = convert.toCopFromEur(item.pvp) ?? 0;
        } else if (item.pvp_currency === "USD") {
          pvpCOP = convert.toCopFromUsd(item.pvp) ?? 0;
        }

        // Convertir costo a COP
        let costoCOP = 0;
        if (item.currency === "COP") {
          costoCOP = item.card_cost;
        } else if (item.currency === "EUR") {
          costoCOP = convert.toCopFromEur(item.card_cost) ?? 0;
        } else if (item.currency === "USD") {
          costoCOP = convert.toCopFromUsd(item.card_cost) ?? 0;
        }

        // Calcular ganancia
        totalGananciaCOP += pvpCOP - costoCOP;
      }
    });

    return {
      cop: totalGananciaCOP,
      eur: convert.toEurFromCop(totalGananciaCOP) ?? 0,
      usd: convert.toUsdFromCop(totalGananciaCOP) ?? 0,
    };
  }, [stock, convert]);

  // Ordenar stock: primero los sin PVP, luego los con PVP
  const stockOrdenado = useMemo(() => {
    return [...stock].sort((a, b) => {
      const aTienePvp = a.pvp && a.pvp > 0;
      const bTienePvp = b.pvp && b.pvp > 0;

      if (!aTienePvp && bTienePvp) return -1; // a sin PVP va primero
      if (aTienePvp && !bTienePvp) return 1;  // b sin PVP va primero
      return 0; // mantener orden original si ambos tienen o no tienen PVP
    });
  }, [stock]);

  // Filtrar stock por búsqueda
  const stockFiltrado = useMemo(() => {
    if (!busqueda.trim()) {
      return stockOrdenado;
    }
    const terminoBusqueda = busqueda.toLowerCase().trim();
    return stockOrdenado.filter((item) =>
      (item.card_name ?? "").toLowerCase().includes(terminoBusqueda)
    );
  }, [stockOrdenado, busqueda]);

  // Contar cartas únicas sin PVP (agrupadas por card_id)
  const cartasSinPvp = useMemo(() => {
    const cartasUnicas = new Map<string, boolean>();
    stock.forEach((item) => {
      if (!cartasUnicas.has(item.card_id)) {
        const tienePvp = !!(item.pvp && item.pvp > 0);
        cartasUnicas.set(item.card_id, tienePvp);
      }
    });
    return Array.from(cartasUnicas.values()).filter((tienePvp) => !tienePvp).length;
  }, [stock]);

  const handleModificar = (id: string) => {
    navigate(`/stock/update/${id}`);
  };

  const handleAsignarPVP = (id: string) => {
    navigate(`/add-pvp/${id}`);
  };

  const handleMarcarPropiedad = async (stockId: string, cardId: string) => {
    const confirmar = window.confirm(
      "¿Marcar esta carta como propiedad?"
    );
    if (!confirmar) return;

    try {
      setMarcandoPropiedad(stockId);
      setErrorPropiedad("");
      await apiClient.post("/sales/keep", {
        stock_id: stockId,
        card_id: cardId,
      });
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
    } catch (error) {
      setErrorPropiedad("No fue posible marcar la carta como propiedad.");
    } finally {
      setMarcandoPropiedad(null);
    }
  };

  const handleAbrirModalVenta = (stockId: string, cardId: string, pvp?: number, pvpCurrency?: string) => {
    setVentaStockId(stockId);
    setVentaCardId(cardId);

    // Si existe PVP, convertirlo a COP y establecerlo como valor por defecto
    if (pvp && pvp > 0 && pvpCurrency) {
      let pvpEnCOP = 0;
      if (pvpCurrency === "COP") {
        pvpEnCOP = pvp;
      } else if (pvpCurrency === "EUR") {
        pvpEnCOP = convert.toCopFromEur(pvp) ?? 0;
      } else if (pvpCurrency === "USD") {
        pvpEnCOP = convert.toCopFromUsd(pvp) ?? 0;
      }
      setPrecioVenta(pvpEnCOP > 0 ? pvpEnCOP : "");
    } else {
      setPrecioVenta("");
    }

    setErrorVenta("");
    setMostrarModalVenta(true);
  };

  const handleCerrarModalVenta = () => {
    setMostrarModalVenta(false);
    setVentaStockId(null);
    setVentaCardId(null);
    setPrecioVenta("");
    setErrorVenta("");
  };

  const handleVender = async () => {
    if (!ventaStockId || !ventaCardId) {
      setErrorVenta("Error: faltan datos de la carta.");
      return;
    }

    if (precioVenta === "" || precioVenta <= 0) {
      setErrorVenta("Por favor ingresa un precio de venta válido (mayor a 0).");
      return;
    }

    try {
      setVendiendo(true);
      setErrorVenta("");
      await apiClient.post("/sales/sell", {
        stock_id: ventaStockId,
        card_id: ventaCardId,
        amount_cop: Number(precioVenta),
        notes: "Venta registrada desde inventario",
      });
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      handleCerrarModalVenta();
    } catch (error: any) {
      setErrorVenta(
        error?.response?.data?.message ||
        "No fue posible registrar la venta. Intenta más tarde."
      );
    } finally {
      setVendiendo(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: "image_url",
      headerName: "Imagen",
      renderCell: (params) => (
        <img
          src={params.value}
          alt="carta"
          className="object-contain w-12 h-16"
        />
      ),
      sortable: false,
      filterable: false,
      width: 80,
    },
    {
      field: "card_name",
      headerName: "Nombre",
      width: 300,
      renderCell: (params) => (
        <span>
          {params.row.card_name}
          {(params.row.league_card ||
            params.row.rareza === "league card") && (
            <span className="text-blue-600 font-semibold ml-1">(liga)</span>
          )}
        </span>
      ),
    },
    {
      field: "rareza",
      headerName: "Rareza",
      width: 130,
      renderCell: (params) => {
        const r = params.row.rareza;
        if (r == null || String(r).trim() === "") {
          return <span className="text-gray-400">—</span>;
        }
        return (
          <span className="text-sm text-gray-800">
            {operationalRarezaLabel(String(r).trim())}
          </span>
        );
      },
    },
    {
      field: "card_cost",
      headerName: "Costo de la carta",
      renderCell: (params) => (
        <>
          {params.row.currency == "COP"
            ? "COP " + params.value.toFixed(2)
            : "EURO " +
            params.value.toFixed(2) +
            " - COP " +
            formatCOP(convert.toCopFromEur(params.value)?.toFixed(0))}
        </>
      ),
      width: 200,
    },
    {
      field: "pvp",
      headerName: "PVP",
      renderCell: (params) => {
        if (params.row.pvp && params.row.pvp > 0) {
          // Convertir PVP a todas las monedas
          let pvpCOP = 0;
          let pvpEUR = 0;
          let pvpUSD = 0;

          if (params.row.pvp_currency === "COP") {
            pvpCOP = params.row.pvp;
            pvpEUR = convert.toEurFromCop(pvpCOP) ?? 0;
            pvpUSD = convert.toUsdFromCop(pvpCOP) ?? 0;
          } else if (params.row.pvp_currency === "EUR") {
            pvpEUR = params.row.pvp;
            pvpCOP = convert.toCopFromEur(pvpEUR) ?? 0;
            pvpUSD = convert.toUsdFromCop(pvpCOP) ?? 0;
          }

          // Moneda de compra (currency del stock)
          const monedaCompra = params.row.currency;

          return (
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex gap-2 flex-wrap">
                <span className={monedaCompra === "COP" ? "font-bold text-blue-600" : ""}>
                  COP {formatCOP(pvpCOP.toFixed(0))}
                </span>
                <span>/</span>
                <span className={monedaCompra === "EUR" ? "font-bold text-blue-600" : ""}>
                  EUR {pvpEUR.toFixed(2)}
                </span>
                <span>/</span>
                <span className={monedaCompra === "USD" ? "font-bold text-blue-600" : ""}>
                  USD {pvpUSD.toFixed(2)}
                </span>
              </div>
            </div>
          );
        }
        return <span className="text-red-600 font-semibold">Sin asignar</span>;
      },
      width: 220,
    },
    {
      field: "ganancia",
      headerName: "Ganancia",
      renderCell: (params) => {
        if (!params.row.pvp || params.row.pvp <= 0) {
          return <span className="text-gray-400">—</span>;
        }

        // Convertir PVP a COP
        let pvpCOP = 0;
        if (params.row.pvp_currency === "COP") {
          pvpCOP = params.row.pvp;
        } else if (params.row.pvp_currency === "EUR") {
          pvpCOP = convert.toCopFromEur(params.row.pvp) ?? 0;
        }

        // Convertir costo a COP
        let costoCOP = 0;
        if (params.row.currency === "COP") {
          costoCOP = params.row.card_cost;
        } else if (params.row.currency === "EUR") {
          costoCOP = convert.toCopFromEur(params.row.card_cost) ?? 0;
        }

        // Calcular ganancia y porcentaje
        const ganancia = pvpCOP - costoCOP;
        const porcentaje = costoCOP > 0 ? (ganancia / costoCOP) * 100 : 0;

        const esGanancia = ganancia > 0;
        const esPerdida = ganancia < 0;

        return (
          <div className="flex items-center gap-3">
            <span
              className={`font-semibold ${esGanancia
                  ? "text-green-600"
                  : esPerdida
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
            >
              {esGanancia ? "+" : ""}
              {formatCOP(ganancia.toFixed(0))}
            </span>
            <span
              className={`text-sm font-medium ${esGanancia
                  ? "text-green-600"
                  : esPerdida
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
            >
              ({esGanancia ? "+" : ""}
              {porcentaje.toFixed(1)}%)
            </span>
          </div>
        );
      },
      width: 200,
    },
    { field: "card_id", headerName: "Carta", width: 150 },
    {
      field: "card_state",
      headerName: "Estado Venta",
      renderCell: (params) => {
        if (params.row.card_state === "propiedad") {
          return (
            <span className="text-rose-600 font-semibold">En propiedad</span>
          );
        }
        if (params.row.card_state === "vendida") {
          return <span className="text-gray-500 font-medium">Vendida</span>;
        }
        if (params.row.card_state === "reserva") {
          return <span className="text-yellow-600 font-medium">Reservada</span>;
        }
        return <span className="text-green-600 font-medium">Disponible</span>;
      },
      width: 160,
    },
    {
      field: "modificar",
      headerName: "Modificar",
      sortable: false,
      filterable: false,
      width: 120,
      renderCell: (params) => (
        <button
          onClick={() => handleModificar(params.row._id)}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
        >
          Modificar
        </button>
      ),
    },
    {
      field: "asignarPVP",
      headerName: "Asignar/Modificar PVP",
      sortable: false,
      filterable: false,
      width: 160,
      renderCell: (params) => {
        const tienePvp = params.row.pvp && params.row.pvp > 0;
        return (
          <button
            onClick={() => handleAsignarPVP(params.row.card_id)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
          >
            {tienePvp ? "Modificar PVP" : "Asignar PVP"}
          </button>
        );
      },
    },
    {
      field: "propiedad",
      headerName: "Quedarme",
      sortable: false,
      filterable: false,
      width: 150,
      renderCell: (params) => (
        <button
          onClick={() =>
            handleMarcarPropiedad(params.row._id, params.row.card_id)
          }
          disabled={
            params.row.card_state === "propiedad" ||
            marcandoPropiedad === params.row._id
          }
          className={`px-3 py-1 rounded ${params.row.card_state === "propiedad"
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-rose-600 text-white hover:bg-rose-700"
            }`}
        >
          {marcandoPropiedad === params.row._id ? "Marcando..." : "Propiedad"}
        </button>
      ),
    },
    {
      field: "vendido",
      headerName: "Vendido",
      sortable: false,
      filterable: false,
      width: 120,
      renderCell: (params) => (
        <button
          onClick={() =>
            handleAbrirModalVenta(
              params.row._id,
              params.row.card_id,
              params.row.pvp,
              params.row.pvp_currency
            )
          }
          disabled={
            params.row.card_state === "vendida" ||
            params.row.card_state === "propiedad"
          }
          className={`px-3 py-1 rounded ${params.row.card_state === "vendida" ||
              params.row.card_state === "propiedad"
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-green-600 text-white hover:bg-green-700"
            }`}
        >
          Vendido
        </button>
      ),
    },
  ];

  const [exportando, setExportando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [limpiandoPvp, setLimpiandoPvp] = useState(false);
  const [actualizandoTienda, setActualizandoTienda] = useState(false);

  const handleLimpiarTodosPvp = async () => {
    const confirmar = window.confirm(
      "¿Eliminar todos los PVP asignados? Las cartas quedarán sin precio de venta. Esta acción no se puede deshacer."
    );
    if (!confirmar) return;

    try {
      setLimpiandoPvp(true);
      const res = await apiClient.delete("/pvp");
      const deleted = res.data?.deletedCount ?? 0;
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      if (deleted > 0) {
        window.alert(`Se eliminaron ${deleted} PVP correctamente.`);
      }
    } catch (err) {
      window.alert("No se pudieron eliminar los PVP. Intenta más tarde.");
    } finally {
      setLimpiandoPvp(false);
    }
  };

  const handleExportar = () => {
    setExportando(true);
    exportToPDF(
      stock.filter((stockItem: StockItem) => stockItem.card_state == "en_stock_colombia"),
      convert.toCopFromEur,
      () => setExportando(false)
    );
  };

  const handleImprimirCatalogo = () => {
    setImprimiendo(true);
    exportCatalogToPDF(
      stock.filter((stockItem) => stockItem.card_state != "vendida"),
      convert.toCopFromEur,
      convert.toEurFromCop,
      () => setImprimiendo(false)
    );
  };

  const handleActualizarInformacionTienda = async () => {
    try {
      setActualizandoTienda(true);
      const [invRes, upRes] = await Promise.all([
        apiClient.post("/stock/export-store-inventory"),
        apiClient.post("/stock/export-store-upcoming"),
      ]);
      const inv = invRes.data;
      const up = upRes.data;
      const invOk = inv?.success === true;
      const upOk = up?.success === true;
      if (invOk && upOk) {
        window.alert(
          `Tienda actualizada: ${inv.count ?? 0} cartas en catálogo, ${up.count ?? 0} en Próximamente (compras en camino).`
        );
      } else {
        const parts: string[] = [];
        if (!invOk) parts.push("Inventario: " + (inv?.error || "error"));
        if (!upOk) parts.push("Próximamente: " + (up?.error || "error"));
        window.alert("Error al actualizar la tienda. " + parts.join(" "));
      }
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      window.alert("No se pudo actualizar la información de la tienda. " + (msg || "Intenta más tarde."));
    } finally {
      setActualizandoTienda(false);
    }
  };

  if (isLoading)
    return <p className="text-center text-gray-500">Cargando stock...</p>;

  if (error)
    return (
      <p className="text-center text-red-500">
        ❌ Error al cargar el stock. Intenta más tarde.
      </p>
    );

  return (
    <div style={{ height: "90%", width: "100%", margin: "2rem auto" }}>
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Inventario y precio de venta (paso 2)
        </h1>
        <p className="text-gray-600 text-sm max-w-3xl mb-3">
          Aquí ves todas las cartas disponibles. Para poder cobrarlas en el{" "}
          <strong>mostrador</strong>, cada carta necesita un{" "}
          <strong>PVP</strong> (precio al público). Entra en una fila y usa la
          acción de PVP / venta según tu flujo habitual.
        </p>
        <p className="text-gray-500 text-xs">
          ¿Aún no cargaste la carta? Ve primero a{" "}
          <Link
            to="/add-stock"
            className="text-blue-600 font-semibold underline hover:text-blue-800"
          >
            Agregar cartas al inventario (paso 1)
          </Link>
          .
        </p>
      </div>
      {cartasSinPvp > 0 && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                Tienes {cartasSinPvp} {cartasSinPvp === 1 ? "carta sin asignar" : "cartas sin asignar"} un valor de mercado (PVP)
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre de carta..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={handleExportar}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Exportar PDF
              </button>

              {exportando && (
                <div className="absolute top-0 right-0 mt-2 mr-2 text-sm text-gray-700 bg-white px-3 py-2 border rounded shadow">
                  Generando PDF...
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={handleImprimirCatalogo}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Imprimir Catálogo
              </button>

              {imprimiendo && (
                <div className="absolute top-0 right-0 mt-2 mr-2 text-sm text-gray-700 bg-white px-3 py-2 border rounded shadow">
                  Generando catálogo...
                </div>
              )}
            </div>
            <button
              onClick={handleLimpiarTodosPvp}
              disabled={limpiandoPvp}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {limpiandoPvp ? "Limpiando..." : "Limpiar todos los PVP"}
            </button>
            <button
              type="button"
              title="Genera inventory.json (catálogo) y upcoming.json (compras en camino) en dittos-army-store/public"
              onClick={handleActualizarInformacionTienda}
              disabled={actualizandoTienda}
              className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actualizandoTienda ? "Actualizando..." : "Actualizar tienda (catálogo + Próximamente)"}
            </button>
          </div>
          <div className="flex flex-col gap-4 mt-4">
            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
              <h3 className="text-lg font-semibold mb-3 text-gray-700">
                Estadísticas del Inventario
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Precio del Inventario</p>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-blue-600 text-lg">
                      COP {formatCOP(precioInventario.cop.toFixed(0))}
                    </span>
                    <span className="text-sm text-gray-500">
                      EUR {precioInventario.eur.toFixed(2)} / USD {precioInventario.usd.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Ganancia Esperada</p>
                  <div className="flex flex-col gap-1">
                    <span
                      className={`font-bold text-lg ${gananciaEsperada.cop > 0
                          ? "text-green-600"
                          : gananciaEsperada.cop < 0
                            ? "text-red-600"
                            : "text-gray-600"
                        }`}
                    >
                      {gananciaEsperada.cop > 0 ? "+" : ""}
                      COP {formatCOP(gananciaEsperada.cop.toFixed(0))}
                    </span>
                    <span className="text-sm text-gray-500">
                      {gananciaEsperada.eur > 0 ? "+" : ""}
                      EUR {gananciaEsperada.eur.toFixed(2)} /{" "}
                      {gananciaEsperada.usd > 0 ? "+" : ""}
                      USD {gananciaEsperada.usd.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {busqueda && (
              <p className="text-sm text-gray-600 text-center md:text-left">
                Mostrando {stockFiltrado.length}{" "}
                {stockFiltrado.length === 1 ? "resultado" : "resultados"} de{" "}
                {stock.length} cartas
              </p>
            )}
          </div>
          {errorPropiedad && (
            <p className="text-sm text-red-600 text-center mt-2">
              {errorPropiedad}
            </p>
          )}
        </div>

        {/* Modal de Venta */}
        {mostrarModalVenta && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                Registrar Venta
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Ingresa el precio en el que se vendió la carta (en COP):
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio de Venta (COP)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    precioVenta === ""
                      ? ""
                      : typeof precioVenta === "number"
                        ? precioVenta.toString().replace(".", ",")
                        : precioVenta
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
                      const normalizedValue = value.replace(",", ".");
                      if (normalizedValue === "" || normalizedValue === ".") {
                        setPrecioVenta("");
                      } else {
                        const num = parseFloat(normalizedValue);
                        setPrecioVenta(isNaN(num) ? "" : num);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.replace(",", ".");
                    if (value === "" || value === ".") {
                      setPrecioVenta("");
                    } else {
                      const num = parseFloat(value);
                      setPrecioVenta(isNaN(num) ? "" : num);
                    }
                  }}
                  className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej: 50000 o 50.000"
                  autoFocus
                />
              </div>
              {errorVenta && (
                <p className="text-sm text-red-600 mb-4">{errorVenta}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCerrarModalVenta}
                  disabled={vendiendo}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleVender}
                  disabled={vendiendo || precioVenta === "" || precioVenta <= 0}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {vendiendo ? "Registrando..." : "Registrar Venta"}
                </button>
              </div>
            </div>
          </div>
        )}

        <DataGrid
          rows={stockFiltrado}
          columns={columns}
          getRowId={(row) => row._id}
          pageSizeOptions={[20, 30, 40]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 20, page: 0 },
            },
          }}
          pagination
          disableRowSelectionOnClick
          autosizeOptions={{ includeHeaders: true }}
          getRowClassName={(params) => {
            const tienePvp = params.row.pvp && params.row.pvp > 0;
            if (params.row.card_state === "propiedad") {
              return "propiedad-row";
            }
            return !tienePvp ? "sin-pvp-row" : "";
          }}
          sx={{
            "& .sin-pvp-row": {
              backgroundColor: "#fee2e2 !important", // rojo claro
              "&:hover": {
                backgroundColor: "#fecaca !important", // rojo más oscuro al hover
              },
            },
            "& .propiedad-row": {
              backgroundColor: "#ffe4e6 !important",
              "&:hover": {
                backgroundColor: "#fecdd3 !important",
              },
            },
          }}
        />
      </div>
    </div>
  );
}
