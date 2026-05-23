import { useAuth } from "./hooks/useAuth";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";

export default function App() {
  const { session, carregando } = useAuth();

  if (carregando) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-faint)",
          fontSize: 15,
        }}
      >
        Carregando...
      </div>
    );
  }

  return session ? <Dashboard session={session} /> : <Login />;
}
