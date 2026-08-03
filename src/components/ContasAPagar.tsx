import { Receipt } from "lucide-react";

export default function ContasAPagar() {
  return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--text-faint)" }}>
      <Receipt size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
      <p style={{ fontSize: 16, fontWeight: 600 }}>Contas a Pagar</p>
      <p style={{ fontSize: 14, marginTop: 8 }}>Em breve</p>
    </div>
  );
}
