import type { Tipo } from "../types";

// Adivinhação de categoria e de tipo a partir do que o usuário escreveu.
//
// Existe para que "almoço 25" vire uma saída de Alimentação sem passar por
// dois selects. Erra às vezes — por isso quem chama sempre mostra o palpite
// numa prévia editável, nunca salva direto.

// Minúsculas, sem acento, pontuação virando espaço. "Almoço no R.U." e
// "almoco no ru" passam a ser a mesma string.
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface Regra {
  categoria: string;
  // Já escritas normalizadas: sem acento e em minúsculas.
  palavras: string[];
}

const REGRAS_SAIDA: Regra[] = [
  {
    categoria: "Alimentação",
    palavras: [
      "mercado", "supermercado", "compras do mes", "ifood", "rappi", "almoco",
      "almocos", "janta", "jantar", "lanche", "lanchonete", "padaria", "cafe",
      "comida", "rango", "pizza", "hamburguer", "burger", "restaurante", "ru",
      "bandejao", "feira", "acougue", "marmita", "sorvete", "acai", "salgado",
      "coxinha", "mcdonalds", "subway", "delivery",
    ],
  },
  {
    categoria: "Transporte",
    palavras: [
      "uber", "99", "taxi", "cabify", "indriver", "gasolina", "combustivel",
      "posto", "onibus", "busao", "passagem", "metro", "estacionamento",
      "pedagio", "ipva", "licenciamento", "mecanico", "oficina", "pneu",
      "oleo do carro", "lavagem", "seguro do carro",
    ],
  },
  {
    categoria: "Lazer",
    palavras: [
      "balada", "bar", "cerveja", "breja", "boate", "pub", "festa", "cinema",
      "show", "role", "jogo", "jogos", "game", "games", "steam", "viagem",
      "praia", "ingresso", "churrasco", "parque", "boliche", "sinuca",
    ],
  },
  {
    categoria: "Educação",
    palavras: [
      "faculdade", "mensalidade", "curso", "livro", "livros", "apostila",
      "matricula", "escola", "xerox", "impressao", "material escolar",
      "formatura", "semestre", "certificado",
    ],
  },
  {
    categoria: "Assinaturas",
    palavras: [
      "netflix", "spotify", "prime video", "amazon prime", "disney", "hbo",
      "max", "youtube premium", "assinatura", "plano", "icloud", "google one",
      "chatgpt", "claude", "deezer", "crunchyroll", "globoplay", "paramount",
      "apple tv", "canva", "github",
    ],
  },
  {
    categoria: "Saúde",
    palavras: [
      "farmacia", "remedio", "medico", "dentista", "exame", "consulta",
      "plano de saude", "psicologo", "terapia", "academia", "oculos", "lente",
      "vacina", "hospital", "laboratorio", "fisioterapia", "suplemento",
    ],
  },
  {
    categoria: "Tecnologia",
    palavras: [
      "notebook", "celular", "fone", "headset", "mouse", "teclado", "monitor",
      "computador", "pc", "cabo", "carregador", "hd", "ssd", "pendrive",
      "memoria ram", "placa de video", "webcam", "impressora", "chip",
    ],
  },
  {
    categoria: "Beleza",
    palavras: [
      "cabelo", "corte de cabelo", "barbeiro", "barbearia", "salao", "unha",
      "manicure", "perfume", "skincare", "maquiagem", "cosmetico",
    ],
  },
  {
    categoria: "Casa",
    palavras: [
      "aluguel", "luz", "energia", "conta de luz", "conta de agua", "internet",
      "wifi", "gas", "condominio", "faxina", "limpeza", "iptu", "movel",
      "moveis", "decoracao", "reforma", "lampada", "chuveiro",
      "material de construcao",
    ],
  },
  {
    categoria: "Cartão de Crédito / Contas",
    palavras: [
      "cartao", "cartao de credito", "fatura", "nubank", "inter", "itau",
      "bradesco", "santander", "c6", "caixa", "banco do brasil", "picpay",
      "emprestimo", "parcela", "boleto", "financiamento", "anuidade",
      "consorcio",
    ],
  },
  {
    categoria: "Vestuário",
    palavras: [
      "roupa", "roupas", "tenis", "camisa", "camiseta", "calca", "bermuda",
      "sapato", "meia", "jaqueta", "moletom", "bone", "renner", "riachuelo",
      "zara", "shein", "shorts",
    ],
  },
];

const REGRAS_ENTRADA: Regra[] = [
  {
    categoria: "Salário",
    palavras: [
      "salario", "holerite", "contracheque", "folha", "pagamento",
      "adiantamento", "decimo terceiro", "ferias", "vale",
    ],
  },
  {
    categoria: "Mesada",
    palavras: ["mesada", "pai", "mae", "pais", "avo", "avos"],
  },
  {
    categoria: "Freelance / Bico",
    palavras: ["freela", "freelance", "bico", "job", "servico", "extra"],
  },
  {
    categoria: "Presente",
    palavras: ["presente", "aniversario", "natal", "gorjeta"],
  },
  {
    categoria: "Empréstimo recebido",
    palavras: ["emprestimo", "emprestado"],
  },
  {
    categoria: "Rendimentos / Investimentos",
    palavras: [
      "rendimento", "rendimentos", "juros", "dividendo", "dividendos",
      "investimento", "cdb", "tesouro", "poupanca", "cripto", "acoes", "fii",
    ],
  },
  {
    categoria: "Reembolso",
    palavras: [
      "reembolso", "estorno", "devolucao", "ressarcimento", "troco", "cashback",
    ],
  },
  {
    categoria: "Vendas",
    palavras: [
      "venda", "vendas", "vendi", "olx", "mercado livre", "enjoei", "shopee",
    ],
  },
  {
    categoria: "Bolsa / Auxílio",
    palavras: [
      "bolsa", "auxilio", "estagio", "bolsista", "pibic",
      "iniciacao cientifica",
    ],
  },
];

// Palavras que, sozinhas, já dizem que o lançamento é dinheiro entrando —
// usadas quando a linha não trouxe o "+" na frente.
//
// É uma lista curta de propósito. "bolsa" e "presente" ficam de fora porque
// "bolsa 200" é quase sempre uma compra, e "presente 80" é o presente que
// você deu, não o que ganhou. Na dúvida, saída: é o caso mais comum e o erro
// aparece na prévia antes de salvar.
const ENTRADA_INEQUIVOCA = [
  "salario", "holerite", "contracheque", "mesada", "freela", "freelance",
  "bico", "reembolso", "estorno", "cashback", "vendi", "recebi", "recebido",
  "deposito", "rendimento", "rendimentos", "dividendo", "dividendos",
  "adiantamento", "decimo terceiro", "estagio",
];

// Procura a palavra reconhecida mais longa: sem isso "plano" (Assinaturas)
// venceria "plano de saude" (Saúde) só por vir antes na tabela.
function acharCategoria(descricao: string, regras: Regra[]): string | null {
  const alvo = ` ${normalizar(descricao)} `;
  let achada: string | null = null;
  let maior = 0;
  for (const regra of regras) {
    for (const palavra of regra.palavras) {
      if (palavra.length <= maior) continue;
      if (alvo.includes(` ${palavra} `)) {
        achada = regra.categoria;
        maior = palavra.length;
      }
    }
  }
  return achada;
}

export function adivinharCategoria(descricao: string, tipo: Tipo): string | null {
  return acharCategoria(
    descricao,
    tipo === "entrada" ? REGRAS_ENTRADA : REGRAS_SAIDA
  );
}

export function adivinharTipo(descricao: string): Tipo | null {
  const alvo = ` ${normalizar(descricao)} `;
  return ENTRADA_INEQUIVOCA.some((p) => alvo.includes(` ${p} `))
    ? "entrada"
    : null;
}

// As duas listas de categorias terminam em "Outros"; é para onde vai o que
// não foi reconhecido.
export const CATEGORIA_PADRAO = "Outros";
