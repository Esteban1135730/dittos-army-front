import { useAuth } from "../../context/auth.context";

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="p-4">
      <h1 className="text-2xl">Bienvenid@, {user?.name}</h1>
    </div>
  );
}
