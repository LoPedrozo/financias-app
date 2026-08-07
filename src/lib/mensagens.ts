// Textos que o usuário lê. Ficam todos aqui para que a mesma situação não
// apareça escrita de dois jeitos em telas diferentes.
//
// Regra de tom: dizer o que aconteceu e o que fazer a seguir, sem jargão e sem
// culpar quem está lendo. "Peça um novo link" ajuda; "token inválido" não.

// Erro cuja mensagem já está pronta para a tela. O que não for disso vira uma
// mensagem genérica, porque texto cru de banco não serve para o usuário final.
export class ErroAmigavel extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroAmigavel";
  }
}

export const ERROS = {
  // Sessão e conexão
  naoAutenticado: "Sua sessão expirou. Entre novamente para continuar.",
  semConexao:
    "Não foi possível conectar. Verifique sua internet e tente de novo.",
  inesperado: "Algo deu errado. Tente novamente em instantes.",

  // Listas
  listaNaoEncontrada:
    "Não encontramos esta lista. Ela pode ter sido excluída por quem a criou.",
  listaJaExiste: "Você já tem uma lista de contas para este mês.",
  mesFechado:
    "Este mês já foi fechado. Você pode consultar as contas, mas não adicionar nem editar.",

  // Pilhas
  nomeDaPilhaObrigatorio: "Dê um nome para a lista. Ex: Contas da mãe.",
  apenasCriadorPassaPosse: "Só quem criou a lista pode passar a posse dela.",
  novoDonoPrecisaParticipar:
    "Escolha alguém que já participa da lista. Convide a pessoa primeiro.",
  donoNaoSaiSemPassar:
    "Você criou esta lista. Passe a posse para outra pessoa antes de sair — ou exclua a lista.",

  // Itens
  apenasCriadorExcluiItem:
    "Só quem criou a lista pode excluir contas. Você pode editar ou marcar como paga.",

  // Convites
  apenasCriadorConvida: "Só quem criou a lista pode convidar outras pessoas.",
  apenasCriadorRemove: "Só quem criou a lista pode remover pessoas dela.",
  conviteInvalido: "Este convite não é mais válido. Peça um novo link.",
  conviteExpirado: "Este convite expirou. Peça um novo link para quem te convidou.",
  conviteUsado:
    "Este convite já foi usado. Cada link serve para uma pessoa — peça outro.",
  conviteEhSuaLista: "Esta lista já é sua. Compartilhe o link com outra pessoa.",
  conviteJaParticipa: "Você já faz parte desta lista.",
  conviteExigeLogin: "Entre na sua conta para aceitar o convite.",
} as const;

export const SUCESSOS = {
  // Listas
  listaCriada: (mes: string) => `Lista de ${mes} criada.`,

  // Itens
  itemCriado: "Conta adicionada à lista.",
  itemAtualizado: "Conta atualizada.",
  itemExcluido: "Conta excluída.",
  itemPago: "Conta marcada como paga.",
  itemDesmarcado: "Conta desmarcada como paga.",

  // Convites
  conviteGerado: "Link de convite criado. Ele vale por 48 horas.",
  linkCopiado: "Link copiado! Agora é só enviar.",
  conviteAceito: (mes: string) => `Pronto! Você entrou na lista de ${mes}.`,
  conviteRevogado: "Convite cancelado. O link não funciona mais.",

  // Colaboradores
  colaboradorRemovido: "Pessoa removida da lista.",
  saiuDaLista: "Você saiu da lista.",
} as const;

// Frases que as funções do banco levantam, na ordem em que devem ser testadas.
// O Postgres devolve o texto do RAISE EXCEPTION; aqui ele vira algo legível.
const TRADUCOES: ReadonlyArray<readonly [string, string]> = [
  ["já foi utilizado", ERROS.conviteUsado],
  ["expirou", ERROS.conviteExpirado],
  ["inválido ou expirado", ERROS.conviteInvalido],
  ["já é o dono", ERROS.conviteEhSuaLista],
  // Precisa vir antes de "já participa": a frase da transferência é
  // "Escolha alguém que já participa desta lista" e casaria com a de convite.
  ["Escolha alguém", ERROS.novoDonoPrecisaParticipar],
  ["já participa", ERROS.conviteJaParticipa],
  ["Apenas o criador da lista pode gerar convites", ERROS.apenasCriadorConvida],
  ["pode passar a posse", ERROS.apenasCriadorPassaPosse],
  ["não autenticado", ERROS.naoAutenticado],
];

function pareceFalhaDeRede(mensagem: string): boolean {
  const m = mensagem.toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed")
  );
}

// Converte qualquer coisa lançada em um texto que faça sentido na tela.
// O erro original continua indo para o console — ele serve para quem depura,
// não para quem está tentando pagar uma conta.
export function traduzirErro(erro: unknown): string {
  if (erro instanceof ErroAmigavel) return erro.message;

  const bruta =
    erro instanceof Error
      ? erro.message
      : typeof erro === "object" && erro !== null && "message" in erro
        ? String((erro as { message: unknown }).message)
        : "";

  if (!bruta) return ERROS.inesperado;
  if (pareceFalhaDeRede(bruta)) return ERROS.semConexao;

  for (const [trecho, amigavel] of TRADUCOES) {
    if (bruta.toLowerCase().includes(trecho.toLowerCase())) return amigavel;
  }

  return ERROS.inesperado;
}
