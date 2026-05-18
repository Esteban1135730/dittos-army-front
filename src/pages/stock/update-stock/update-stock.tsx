import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "../../../api/client";
import { useState, useEffect, useRef } from "react";
import type { UpdateStockRequestBody } from "../../../types/stock";
import {
  OPERATIONAL_RAREZA_VALUES,
  operationalRarezaLabel,
} from "../../../constants/item-rareza";

export default function ModificarStock() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["stock", id],
    queryFn: async () => {
      const res = await apiClient.get(`/stock/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const [form, setForm] = useState<UpdateStockRequestBody>({
    id: id ?? "",
    card_id: "",
    card_name: "",
    image_url: "",
    currency: "EUR",
    shipment: 0,
    unity_cost: 0,
    cards_in_shipmet: 1,
    card_state: "near_mint",
    language: "",
    holofoil: false,
    league_card: false,
    rareza: "",
  });

  const loadedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadedForIdRef.current = null;
  }, [id]);

  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const mutation = useMutation({
    mutationFn: async (nuevo: UpdateStockRequestBody) => {
      const res = await apiClient.post(`/stock/update`, nuevo);
      return res.data;
    },
    onSuccess: () => {
      setMensaje("✅ Cambios guardados");
      setTimeout(() => navigate("/stock"), 1500);
    },
    onError: () => {
      setMensaje("❌ Error al guardar cambios");
    },
    onSettled: () => {
      setGuardando(false);
    },
  });

  useEffect(() => {
    if (!data || !id) return;
    if (loadedForIdRef.current === id) return;
    loadedForIdRef.current = id;
    const d = data as {
      rareza?: string | null;
      holofoil?: boolean;
      league_card?: boolean;
    };
    let rz =
      d.rareza != null && String(d.rareza).trim() !== ""
        ? String(d.rareza).trim()
        : "";
    if (rz === "" && d.holofoil) rz = "holofoil";
    if (rz === "" && d.league_card) rz = "league card";
    setForm({
      id,
      card_id: data.card_id || "",
      card_name: data.card_name ?? "",
      image_url: data.image_url || "",
      currency: data.currency || "EUR",
      shipment: data.shipment || 0,
      unity_cost: data.unity_cost || 0,
      cards_in_shipmet: data.cards_in_shipmet || 1,
      card_state: data.card_state || "near_mint",
      language: data.language || "",
      holofoil: rz === "holofoil",
      league_card: rz === "league card",
      rareza: rz,
    });
  }, [data, id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    if (type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }
    
    // Para campos numéricos, permitir punto y coma
    if (name === "shipment" || name === "unity_cost") {
      // Permitir vacío, números, punto y coma
      if (value === "" || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
        const normalizedValue = value.replace(",", ".");
        if (normalizedValue === "" || normalizedValue === ".") {
          setForm((prev) => ({
            ...prev,
            [name]: 0,
          }));
        } else {
          const num = parseFloat(normalizedValue);
          setForm((prev) => ({
            ...prev,
            [name]: isNaN(num) ? 0 : num,
          }));
        }
      }
    } else if (name === "cards_in_shipmet") {
      const num = parseInt(value);
      setForm((prev) => ({
        ...prev,
        [name]: isNaN(num) || num < 1 ? 1 : num,
      }));
    } else if (name === "rareza") {
      setForm((prev) => ({
        ...prev,
        rareza: value,
        holofoil: value === "holofoil",
        league_card: value === "league card",
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleGuardar = () => {
    setGuardando(true);
    const rz =
      form.rareza && String(form.rareza).trim() !== ""
        ? String(form.rareza).trim()
        : null;
    const payload: UpdateStockRequestBody = {
      ...form,
      rareza: rz,
      holofoil: rz === "holofoil",
      league_card: rz === "league card",
    };
    mutation.mutate(payload);
  };

  if (isLoading) return <p className="text-center">⏳ Cargando datos...</p>;
  if (error || !data)
    return <p className="text-center text-red-500">❌ Error al cargar</p>;

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white rounded-xl shadow-lg p-6 space-y-6">
      <h1 className="text-2xl font-bold text-center text-gray-800">
        Editar Stock de Carta
      </h1>

      <div className="flex flex-col items-center">
        <img
          src={data.image_url}
          alt="Carta"
          className="w-40 h-auto rounded border mb-2"
        />
        <p className="text-sm text-gray-500">{data.card_id}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">ID de la carta</label>
          <input
            type="text"
            name="card_id"
            value={form.card_id}
            disabled
            className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-600 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Nombre de la carta</label>
          <input
            type="text"
            name="card_name"
            value={form.card_name}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
            placeholder="Nombre visible en listados"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">
              Costo unidad (€)
            </label>
            <input
              type="text"
              inputMode="decimal"
              name="unity_cost"
              value={form.unity_cost === 0 ? "" : form.unity_cost.toString().replace(".", ",")}
              onChange={handleChange}
              onBlur={(e) => {
                const value = e.target.value.replace(",", ".");
                const num = parseFloat(value);
                setForm((prev) => ({
                  ...prev,
                  unity_cost: isNaN(num) || num < 0 ? 0 : num,
                }));
              }}
              className="w-full px-3 py-2 border rounded"
              placeholder="0,00 o 0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Costo envío (€)</label>
            <input
              type="text"
              inputMode="decimal"
              name="shipment"
              value={form.shipment === 0 ? "" : form.shipment.toString().replace(".", ",")}
              onChange={handleChange}
              onBlur={(e) => {
                const value = e.target.value.replace(",", ".");
                const num = parseFloat(value);
                setForm((prev) => ({
                  ...prev,
                  shipment: isNaN(num) || num < 0 ? 0 : num,
                }));
              }}
              className="w-full px-3 py-2 border rounded"
              placeholder="0,00 o 0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              Cartas por envío
            </label>
            <input
              type="number"
              name="cards_in_shipmet"
              step="1"
              min="1"
              value={form.cards_in_shipmet}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Estado</label>
            <select
              name="card_state"
              value={form.card_state}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="mint">Mint</option>
              <option value="near_mint">Near Mint</option>
              <option value="played">Played</option>
              <option value="good">Good</option>
              <option value="poor">Poor</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Idioma</label>
            <select
              name="language"
              value={form.language}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">Selecciona un idioma</option>
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="fr">Francés</option>
              <option value="de">Alemán</option>
              <option value="it">Italiano</option>
              <option value="pt">Portugués</option>
              <option value="ja">Japonés</option>
              <option value="ko">Coreano</option>
              <option value="zh">Chino</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium">Variante (rareza)</label>
            <select
              name="rareza"
              value={form.rareza === null || form.rareza === undefined ? "" : form.rareza}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">Sin variante</option>
              {OPERATIONAL_RAREZA_VALUES.map((v) => (
                <option key={v} value={v}>
                  {operationalRarezaLabel(v)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate("/stock")}
          className="text-gray-600 hover:underline"
        >
          ← Volver
        </button>

        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      {mensaje && (
        <p className="text-center text-sm mt-4 text-blue-600">{mensaje}</p>
      )}
    </div>
  );
}
