import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";

export default function ModificarStock() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["stock", id],
    queryFn: async () => {
      const res = await axios.get(`http://localhost:3000/stock/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const [form, setForm] = useState({
    id: id,
    card_id: "",
    shipment: 0,
    unity_cost: 0,
    cards_in_shipmet: 1,
    card_state: "",
  });

  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const mutation = useMutation({
    mutationFn: async (nuevo: any) => {
      const res = await axios.post(`http://localhost:3000/stock/update`, nuevo);
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

  // Inicializar datos cuando lleguen
  if (data && form.card_id === "") {
    setForm({
      id: id,
      card_id: data.card_id || "",
      shipment: data.shipment || 0,
      unity_cost: data.unity_cost || 0,
      cards_in_shipmet: data.cards_in_shipmet || 1,
      card_state: data.card_state || "",
    });
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "shipment" ||
        name === "unity_cost" ||
        name === "cards_in_shipmet"
          ? parseFloat(value)
          : value,
    }));
  };

  const handleGuardar = () => {
    setGuardando(true);
    mutation.mutate(form);
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">
              Costo unidad (€)
            </label>
            <input
              type="number"
              name="unity_cost"
              step="0.01"
              value={form.unity_cost}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Costo envío (€)</label>
            <input
              type="number"
              name="shipment"
              step="0.01"
              value={form.shipment}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded"
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
              <option value="">Selecciona un estado</option>
              <option value="en_envio_cardmarket">En envío (CardMarket)</option>
              <option value="en_stock_espana">En stock (España)</option>
              <option value="en_envio_colombia">En envío (Colombia)</option>
              <option value="en_stock_colombia">En stock (Colombia)</option>
              <option value="vendida">Vendida</option>
              <option value="otro">Otro</option>
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
