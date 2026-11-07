import { useId, useState } from "react";
import { Check, ClipboardPaste } from "lucide-react";
import type { Lancamento, NovoLancamento, Tipo } from "../types";
import { hojeLocal } from "../lib/calculos";
import Folha from "./Folha";
import {
  AlternarTipo,
  AtalhosData,
  BotaoLink,
  BotaoPrincipal,
  CampoValor,
  GradeCategorias,
  campoComErro,
  categoriasDe,
  estiloErro,
  estiloRotulo,
} from "./campos";

// O formulário de um lançamento: o que o + abre e o que se usa para editar.
//
// O valor vem grande, no topo — é o que se digita primeiro e o que mais se
// confere. A data tem atalhos (Hoje, Ontem) porque quase todo lançamento é de
// um dos dois; "Outra" abre o calendário do aparelho. As categorias ficam em
// grade, com ícone, para escolher num toque em vez de abrir uma lista. O
// Salvar fica no rodapé da folha, sempre à vista, inclusive com o teclado
// aberto (ver Folha).

interface Props {
  onFechar: () => void;
  onSalvar: (item: NovoLancamento) => Promise<void> | void;
  lancamentoParaEditar?: Lancamento;
  dataInicial?: string;
  // Abre o formulário já preenchido sem entrar em modo de edição — usado
  // quando uma conta paga vira lançamento no financeiro pessoal.
  valoresIniciais?: Partial<Pick<NovoLancamento, "tipo" | "valor" | "descricao" | "categoria">>;
  // Saída para o Adicionar, onde se escreve várias linhas de uma vez ou se
  // cola a lista pronta. Leva junto o que já foi digitado aqui, porque
  // trocar de tela não é motivo para perder o que a pessoa escreveu.
  onColarLista?: (
    valores: Partial<
      Pick<NovoLancamento, "tipo" | "valor" | "descricao" | "categoria">
    >,
    data: string
  ) => void;
}

interface Erros {
  valor?: string;
  descricao?: string;
  categoria?: string;
  data?: string;
}

// O campo aceita "10,50" e também texto pela metade. Vale só o que já é
// número; o resto vira undefined e não atrapalha quem está de saída.
function valorNumerico(valor: string): number | undefined {
  const limpo = valor.trim().replace(",", ".");
  if (!limpo) return undefined;
  const n = parseFloat(limpo);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function ModalNovo({
  onFechar,
  onSalvar,
  lancamentoParaEditar,
  dataInicial,
  valoresIniciais,
  onColarLista,
}: Props) {
  const editando = !!lancamentoParaEditar;
  const ids = useId();

  const [tipo, setTipo] = useState<Tipo>(
    lancamentoParaEditar?.tipo ?? valoresIniciais?.tipo ?? "entrada"
  );
  const [valor, setValor] = useState(() => {
    const inicial = lancamentoParaEditar?.valor ?? valoresIniciais?.valor;
    // Sempre com os centavos: em letra grande, "40,5" parece valor pela metade.
    return inicial == null ? "" : inicial.toFixed(2).replace(".", ",");
  });
  const [descricao, setDescricao] = useState(
    lancamentoParaEditar?.descricao ?? valoresIniciais?.descricao ?? ""
  );
  const [categoria, setCategoria] = useState(() => {
    if (lancamentoParaEditar) {
      const lista = categoriasDe(lancamentoParaEditar.tipo);
      const existe = lista.some((c) => c.nome === lancamentoParaEditar.categoria);
      return existe ? lancamentoParaEditar.categoria : lista[0].nome;
    }
    const lista = categoriasDe(valoresIniciais?.tipo ?? "entrada");
    const sugerida = valoresIniciais?.categoria;
    if (sugerida && lista.some((c) => c.nome === sugerida)) return sugerida;
    return lista[0].nome;
  });
  const [data, setData] = useState<string>(() => {
    if (lancamentoParaEditar?.data) return lancamentoParaEditar.data;
    if (lancamentoParaEditar?.created_at) {
      return lancamentoParaEditar.created_at.slice(0, 10);
    }
    return dataInicial ?? hojeLocal();
  });
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);

  const limparErro = (campo: keyof Erros) => {
    if (erros[campo]) setErros((er) => ({ ...er, [campo]: undefined }));
  };

  function trocarTipo(novoTipo: Tipo) {
    if (novoTipo === tipo) return;
    setTipo(novoTipo);
    setCategoria(categoriasDe(novoTipo)[0].nome);
    limparErro("categoria");
  }

  function validar(): Erros {
    const novos: Erros = {};
    const valorLimpo = valor.trim();
    const formatoValido = /^\d+([.,]\d{1,2})?$/.test(valorLimpo);
    const v = parseFloat(valorLimpo.replace(",", "."));
    if (!valorLimpo) {
      novos.valor = "Informe um valor numérico maior que zero.";
    } else if (!formatoValido) {
      novos.valor = "Formato inválido. Use ex: 10,50 ou 10.50";
    } else if (isNaN(v) || v <= 0) {
      novos.valor = "Informe um valor numérico maior que zero.";
    } else if (v > 1_000_000_000) {
      novos.valor = "Valor muito alto. Verifique se digitou corretamente.";
    }
    if (descricao.trim().length < 3) {
      novos.descricao = "Descrição obrigatória (mínimo 3 caracteres).";
    }
    if (!categoria) {
      novos.categoria = "Selecione uma categoria.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      novos.data = "Informe uma data válida.";
    }
    return novos;
  }

  async function submit() {
    if (salvando) return;
    const novosErros = validar();
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const v = parseFloat(valor.replace(",", "."));
    const [yyyy, mm] = data.split("-");
    const ano = Number(yyyy);
    const mes = Number(mm) - 1;
    setSalvando(true);
    try {
      await onSalvar({
        tipo,
        valor: v,
        descricao: descricao.trim(),
        categoria,
        mes,
        ano,
        data,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Folha
      titulo={editando ? "Editar lançamento" : "Novo lançamento"}
      onFechar={onFechar}
      rodape={
        <>
          <BotaoPrincipal onClick={submit} desligado={salvando} icone={<Check size={19} aria-hidden="true" />}>
            {salvando
              ? "Salvando..."
              : editando
              ? "Salvar alterações"
              : tipo === "entrada"
              ? "Salvar entrada"
              : "Salvar saída"}
          </BotaoPrincipal>
          {!editando && onColarLista && (
            <BotaoLink
              icone={<ClipboardPaste size={14} />}
              onClick={() =>
                onColarLista(
                  { tipo, valor: valorNumerico(valor), descricao: descricao.trim(), categoria },
                  data
                )
              }
            >
              Escrever ou colar vários
            </BotaoLink>
          )}
        </>
      }
    >
      <AlternarTipo tipo={tipo} onTrocar={trocarTipo} />

      <CampoValor
        id="campo-valor"
        valor={valor}
        tipo={tipo}
        erro={erros.valor}
        onEnter={submit}
        onMudar={(v) => {
          setValor(v);
          limparErro("valor");
        }}
      />

      <AtalhosData
        id={`${ids}-quando`}
        data={data}
        erro={erros.data}
        onData={(d) => {
          setData(d);
          limparErro("data");
        }}
      />

      <label htmlFor="campo-descricao" style={estiloRotulo}>Descrição</label>
      <input
        id="campo-descricao"
        maxLength={120}
        enterKeyHint="done"
        style={campoComErro(erros.descricao)}
        value={descricao}
        placeholder={tipo === "entrada" ? "ex: salário de outubro" : "ex: almoço no RU"}
        aria-invalid={!!erros.descricao}
        onChange={(e) => {
          setDescricao(e.target.value);
          limparErro("descricao");
        }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {erros.descricao && <p style={estiloErro}>{erros.descricao}</p>}

      <GradeCategorias
        id={`${ids}-categoria`}
        tipo={tipo}
        categoria={categoria}
        erro={erros.categoria}
        onEscolher={(c) => {
          setCategoria(c);
          limparErro("categoria");
        }}
      />
    </Folha>
  );
}
