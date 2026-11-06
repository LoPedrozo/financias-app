import {
  Briefcase, Car, CreditCard, Gift, GraduationCap, HandCoins, HeartPulse, Home,
  Landmark, Laptop, PartyPopper, PiggyBank, RotateCcw, Shirt, ShoppingBag,
  Sparkles, Tag, Tv, Utensils, type LucideIcon,
} from "lucide-react";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA } from "../types";
import type { Tipo } from "../types";

// O ícone e a cor de cada categoria, num círculo — no lugar da etiqueta de
// texto da lista antiga. Categoria desconhecida (renomeada, de versão antiga
// do app) cai na etiqueta genérica e no cinza do "Outros".

const ICONES: Record<string, LucideIcon> = {
  "Alimentação": Utensils,
  "Transporte": Car,
  "Lazer": PartyPopper,
  "Educação": GraduationCap,
  "Assinaturas": Tv,
  "Saúde": HeartPulse,
  "Tecnologia": Laptop,
  "Beleza": Sparkles,
  "Casa": Home,
  "Cartão de Crédito / Contas": CreditCard,
  "Vestuário": Shirt,
  "Salário": Briefcase,
  "Mesada": HandCoins,
  "Freelance / Bico": Laptop,
  "Presente": Gift,
  "Empréstimo recebido": Landmark,
  "Rendimentos / Investimentos": PiggyBank,
  "Reembolso": RotateCcw,
  "Vendas": ShoppingBag,
  "Bolsa / Auxílio": GraduationCap,
};

const COR_PADRAO = "#9aa3b0";

export function corDaCategoria(tipo: Tipo, categoria: string): string {
  const lista = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
  return lista.find((c) => c.nome === categoria)?.cor ?? COR_PADRAO;
}

export function iconeDaCategoria(categoria: string): LucideIcon {
  return ICONES[categoria] ?? Tag;
}

export default function IconeCategoria({
  tipo,
  categoria,
  tamanho = 38,
}: {
  tipo: Tipo;
  categoria: string;
  tamanho?: number;
}) {
  const cor = corDaCategoria(tipo, categoria);
  const Icone = iconeDaCategoria(categoria);
  return (
    <span
      aria-hidden="true"
      className="icone-categoria"
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // A cor é sempre hex: o "38" no fim é a transparência (22%). Hex com
        // alfa funciona em qualquer iPhone; color-mix só do iOS 16.2 em diante.
        background: cor + "38",
        color: cor,
      }}
    >
      <Icone size={Math.round(tamanho * 0.47)} />
    </span>
  );
}
