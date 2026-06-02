import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="p-4">
      <h1 className="text-2xl">Bienvenid@</h1>
      <p className="mt-4">
        <Link
          to="/escanear-codigo"
          className="text-blue-600 underline font-medium"
        >
          Escanear código de barras (pistola / cámara)
        </Link>
      </p>
    </div>
  );
}
