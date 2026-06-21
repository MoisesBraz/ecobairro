import { QuizCategoria } from '@prisma/client';

/**
 * Banco curado de perguntas sobre lixo/reciclagem (PT-PT) — fonte do sorteio
 * aleatório do quiz (RF-19). Cada pergunta tem exatamente UMA opção correta e
 * uma explicação educativa (mostrada sempre no resultado).
 *
 * Para adicionar variedade, basta acrescentar entradas aqui e voltar a correr
 * o seed; o sorteio (Fisher-Yates) escolhe N por sessão.
 */
export interface QuizBankOption {
  texto: string;
  correta: boolean;
}

export interface QuizBankQuestion {
  categoria: QuizCategoria;
  textoPergunta: string;
  explicacaoEducativa: string;
  opcoes: QuizBankOption[];
}

export const QUIZ_BANK: QuizBankQuestion[] = [
  // ── ORGÂNICOS ──────────────────────────────────────────────────────────
  {
    categoria: QuizCategoria.ORGANICOS,
    textoPergunta: 'Qual destes resíduos deve ir para o contentor dos orgânicos (castanho)?',
    explicacaoEducativa:
      'Restos de comida e cascas de fruta são biorresíduos: vão para o contentor castanho ou para compostagem.',
    opcoes: [
      { texto: 'Cascas de fruta', correta: true },
      { texto: 'Embalagens de plástico', correta: false },
      { texto: 'Pilhas usadas', correta: false },
      { texto: 'Garrafas de vidro', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.ORGANICOS,
    textoPergunta: 'O que NÃO deve ser colocado na compostagem doméstica?',
    explicacaoEducativa:
      'Carne e peixe atraem pragas e geram maus odores; devem ser evitados na compostagem doméstica.',
    opcoes: [
      { texto: 'Restos de carne e peixe', correta: true },
      { texto: 'Cascas de legumes', correta: false },
      { texto: 'Borras de café', correta: false },
      { texto: 'Folhas secas', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.ORGANICOS,
    textoPergunta: 'As borras de café podem ser aproveitadas para...',
    explicacaoEducativa: 'As borras de café são orgânicas e excelentes para compostar, enriquecendo o composto.',
    opcoes: [
      { texto: 'Compostagem', correta: true },
      { texto: 'Contentor do vidro', correta: false },
      { texto: 'Pilhão', correta: false },
      { texto: 'Esgoto', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.ORGANICOS,
    textoPergunta: 'Um guardanapo de papel sujo com comida deve ir para...',
    explicacaoEducativa:
      'Papel contaminado com restos de comida não recicla no azul — segue para os orgânicos/biorresíduos.',
    opcoes: [
      { texto: 'Orgânicos (castanho)', correta: true },
      { texto: 'Papel/cartão (azul)', correta: false },
      { texto: 'Embalagens (amarelo)', correta: false },
      { texto: 'Vidrão (verde)', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.ORGANICOS,
    textoPergunta: 'A compostagem transforma os resíduos orgânicos em...',
    explicacaoEducativa: 'A decomposição controlada produz composto (adubo natural) que fertiliza o solo.',
    opcoes: [
      { texto: 'Composto/adubo natural', correta: true },
      { texto: 'Plástico reciclado', correta: false },
      { texto: 'Vidro novo', correta: false },
      { texto: 'Metal', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.ORGANICOS,
    textoPergunta: 'Qual é o principal benefício de separar os biorresíduos?',
    explicacaoEducativa:
      'Desviar os orgânicos do aterro reduz a emissão de metano e produz composto útil para a agricultura.',
    opcoes: [
      { texto: 'Reduz resíduos em aterro e produz adubo', correta: true },
      { texto: 'Aumenta a quantidade de lixo', correta: false },
      { texto: 'Polui a água potável', correta: false },
      { texto: 'Não tem qualquer benefício', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.ORGANICOS,
    textoPergunta: 'As cascas de ovo, na compostagem...',
    explicacaoEducativa: 'As cascas de ovo adicionam cálcio ao composto; partidas, decompõem-se mais depressa.',
    opcoes: [
      { texto: 'Podem ser adicionadas, de preferência partidas', correta: true },
      { texto: 'São proibidas', correta: false },
      { texto: 'Vão para o vidrão', correta: false },
      { texto: 'Vão para o pilhão', correta: false },
    ],
  },

  // ── RECICLAGEM ─────────────────────────────────────────────────────────
  {
    categoria: QuizCategoria.RECICLAGEM,
    textoPergunta: 'No ecoponto, as garrafas de plástico vão para o contentor...',
    explicacaoEducativa: 'Embalagens de plástico e metal colocam-se no contentor amarelo.',
    opcoes: [
      { texto: 'Amarelo', correta: true },
      { texto: 'Azul', correta: false },
      { texto: 'Verde', correta: false },
      { texto: 'Castanho', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.RECICLAGEM,
    textoPergunta: 'O contentor azul destina-se a...',
    explicacaoEducativa: 'O azul é para papel e cartão limpos e secos.',
    opcoes: [
      { texto: 'Papel e cartão', correta: true },
      { texto: 'Vidro', correta: false },
      { texto: 'Plástico', correta: false },
      { texto: 'Orgânicos', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.RECICLAGEM,
    textoPergunta: 'O vidrão (verde) recebe...',
    explicacaoEducativa:
      'Só embalagens de vidro (garrafas e frascos). Espelhos, lâmpadas e cerâmica têm circuitos próprios.',
    opcoes: [
      { texto: 'Garrafas e frascos de vidro', correta: true },
      { texto: 'Espelhos', correta: false },
      { texto: 'Lâmpadas', correta: false },
      { texto: 'Loiça de cerâmica', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.RECICLAGEM,
    textoPergunta: 'Antes de reciclar uma embalagem, deve-se...',
    explicacaoEducativa: 'Basta esvaziar e espalmar para poupar espaço; não é preciso lavar exaustivamente.',
    opcoes: [
      { texto: 'Esvaziar e espalmar', correta: true },
      { texto: 'Lavar sempre com água quente', correta: false },
      { texto: 'Partir em pedaços pequenos', correta: false },
      { texto: 'Pintar de outra cor', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.RECICLAGEM,
    textoPergunta: 'As latas de conserva (metal) vão para o contentor...',
    explicacaoEducativa: 'Em Portugal, metal e plástico partilham o contentor amarelo.',
    opcoes: [
      { texto: 'Amarelo', correta: true },
      { texto: 'Verde', correta: false },
      { texto: 'Azul', correta: false },
      { texto: 'Pilhão', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.RECICLAGEM,
    textoPergunta: 'Uma caixa de pizza muito suja com gordura deve ir para...',
    explicacaoEducativa: 'Cartão com gordura contamina a reciclagem do papel; segue para orgânicos/indiferenciado.',
    opcoes: [
      { texto: 'Orgânicos/indiferenciado', correta: true },
      { texto: 'Azul', correta: false },
      { texto: 'Amarelo', correta: false },
      { texto: 'Verde', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.RECICLAGEM,
    textoPergunta: 'O símbolo das três setas em ciclo (Möbius) significa...',
    explicacaoEducativa: 'É o símbolo universal de material reciclável/reciclado.',
    opcoes: [
      { texto: 'Produto reciclável ou reciclado', correta: true },
      { texto: 'Produto tóxico', correta: false },
      { texto: 'Produto inflamável', correta: false },
      { texto: 'Resíduo biológico', correta: false },
    ],
  },

  // ── LEGISLAÇÃO ─────────────────────────────────────────────────────────
  {
    categoria: QuizCategoria.LEGISLACAO,
    textoPergunta: 'O pilhão serve para depositar...',
    explicacaoEducativa:
      'Pilhas e baterias têm recolha específica (pilhão) por conterem metais pesados perigosos.',
    opcoes: [
      { texto: 'Pilhas e baterias usadas', correta: true },
      { texto: 'Plástico', correta: false },
      { texto: 'Vidro', correta: false },
      { texto: 'Papel', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.LEGISLACAO,
    textoPergunta: 'Os medicamentos fora de prazo devem ser entregues...',
    explicacaoEducativa: 'A Valormed recolhe medicamentos e respetivas embalagens nas farmácias.',
    opcoes: [
      { texto: 'Na farmácia (Valormed)', correta: true },
      { texto: 'No lixo comum', correta: false },
      { texto: 'No vidrão', correta: false },
      { texto: 'No esgoto', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.LEGISLACAO,
    textoPergunta: 'Os resíduos de equipamentos elétricos (REEE) devem...',
    explicacaoEducativa: 'Os REEE têm circuito próprio: lojas e ecocentros recebem-nos para tratamento adequado.',
    opcoes: [
      { texto: 'Ir para pontos de recolha ou lojas', correta: true },
      { texto: 'Ir para o amarelo', correta: false },
      { texto: 'Ir para o vidrão', correta: false },
      { texto: 'Ser queimados em casa', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.LEGISLACAO,
    textoPergunta: 'O óleo alimentar usado deve ser...',
    explicacaoEducativa: 'Despejar óleo no lava-loiça polui a água; deve ser colocado no oleão.',
    opcoes: [
      { texto: 'Colocado no oleão', correta: true },
      { texto: 'Despejado no lava-loiça', correta: false },
      { texto: 'Misturado no amarelo', correta: false },
      { texto: 'Deitado no solo', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.LEGISLACAO,
    textoPergunta: 'Quem é responsável pela gestão dos resíduos urbanos?',
    explicacaoEducativa: 'A gestão de resíduos urbanos compete aos municípios e sistemas intermunicipais.',
    opcoes: [
      { texto: 'Municípios e sistemas de gestão', correta: true },
      { texto: 'Apenas os cidadãos', correta: false },
      { texto: 'Apenas as lojas', correta: false },
      { texto: 'Ninguém em concreto', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.LEGISLACAO,
    textoPergunta: "O princípio 'poluidor-pagador' significa que...",
    explicacaoEducativa: 'Quem gera poluição/resíduos é responsável por suportar os custos da sua gestão.',
    opcoes: [
      { texto: 'Quem polui suporta os custos', correta: true },
      { texto: 'O Estado paga tudo', correta: false },
      { texto: 'Reciclar é proibido', correta: false },
      { texto: 'Ninguém paga nada', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.LEGISLACAO,
    textoPergunta: 'Entulho de pequenas obras domésticas deve ir para...',
    explicacaoEducativa: 'Os resíduos de construção e demolição (RCD) entregam-se no ecocentro.',
    opcoes: [
      { texto: 'Ecocentro', correta: true },
      { texto: 'Contentor da rua', correta: false },
      { texto: 'Vidrão', correta: false },
      { texto: 'Pilhão', correta: false },
    ],
  },

  // ── GERAL ──────────────────────────────────────────────────────────────
  {
    categoria: QuizCategoria.GERAL,
    textoPergunta: 'Qual é a ordem correta da hierarquia dos resíduos (3 R)?',
    explicacaoEducativa: "Política dos 3 R's: primeiro reduzir, depois reutilizar e, por fim, reciclar.",
    opcoes: [
      { texto: 'Reduzir, reutilizar, reciclar', correta: true },
      { texto: 'Reciclar, reduzir, reutilizar', correta: false },
      { texto: 'Queimar, enterrar, reciclar', correta: false },
      { texto: 'Comprar, deitar fora, esquecer', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.GERAL,
    textoPergunta: 'Porque é que reutilizar costuma ser melhor do que reciclar?',
    explicacaoEducativa: 'Reutilizar prolonga a vida útil do produto sem gastar energia a transformá-lo de novo.',
    opcoes: [
      { texto: 'Evita gastar energia a transformar de novo', correta: true },
      { texto: 'Porque é sempre mais caro', correta: false },
      { texto: 'Não há nenhuma diferença', correta: false },
      { texto: 'Porque produz mais lixo', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.GERAL,
    textoPergunta: 'O que é a economia circular?',
    explicacaoEducativa: 'É manter os recursos em uso o máximo de tempo: reparar, reutilizar e reciclar em vez de descartar.',
    opcoes: [
      { texto: 'Manter os recursos em uso o máximo de tempo', correta: true },
      { texto: 'Deitar tudo fora rapidamente', correta: false },
      { texto: 'Produzir sem qualquer limite', correta: false },
      { texto: 'Importar resíduos de outros países', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.GERAL,
    textoPergunta: 'Levar sacos reutilizáveis às compras ajuda a...',
    explicacaoEducativa: 'Menos sacos descartáveis significa menos plástico de uso único e menos resíduos.',
    opcoes: [
      { texto: 'Reduzir o plástico de uso único', correta: true },
      { texto: 'Aumentar o lixo produzido', correta: false },
      { texto: 'Poluir mais os oceanos', correta: false },
      { texto: 'Gastar mais água', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.GERAL,
    textoPergunta: 'Um dos maiores problemas do plástico no ambiente é que...',
    explicacaoEducativa: 'O plástico persiste durante séculos e fragmenta-se em microplásticos que contaminam a cadeia alimentar.',
    opcoes: [
      { texto: 'Demora séculos a decompor-se', correta: true },
      { texto: 'Decompõe-se num único dia', correta: false },
      { texto: 'É totalmente comestível', correta: false },
      { texto: 'Não causa qualquer poluição', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.GERAL,
    textoPergunta: 'Separar corretamente o lixo permite, sobretudo...',
    explicacaoEducativa: 'A separação na origem é essencial para recuperar materiais e poupar recursos naturais.',
    opcoes: [
      { texto: 'Recuperar materiais e poupar recursos', correta: true },
      { texto: 'Encher mais depressa os aterros', correta: false },
      { texto: 'Não tem qualquer efeito', correta: false },
      { texto: 'Aumentar sempre os custos', correta: false },
    ],
  },
  {
    categoria: QuizCategoria.GERAL,
    textoPergunta: 'O que fazer com roupa que já não usa mas está em bom estado?',
    explicacaoEducativa: 'A reutilização têxtil faz-se através de doação ou de contentores próprios para têxteis.',
    opcoes: [
      { texto: 'Doar ou colocar em contentores de têxteis', correta: true },
      { texto: 'Deitar no indiferenciado', correta: false },
      { texto: 'Queimar em casa', correta: false },
      { texto: 'Colocar no vidrão', correta: false },
    ],
  },
];
