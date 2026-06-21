import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, QuizCategoria, ReportStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { config as loadEnv } from 'dotenv';
import { QUIZ_BANK } from './quiz-bank';

loadEnv({ path: '../../.env' });
loadEnv({ path: '.env', override: true });

const databaseUrl =
  process.env.DATABASE_URL ??
  `postgresql://${process.env.POSTGRES_USER ?? 'ecobairro'}:${process.env.POSTGRES_PASSWORD ?? 'ecobairro'}@localhost:${process.env.POSTGRES_PORT ?? '5432'}/${process.env.POSTGRES_DB ?? 'ecobairro'}`;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const BCRYPT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);

async function main(): Promise<void> {
  const cidadaoEmail = 'cidadao.seed@ecobairro.local';
  const operadorEmail = 'operador.seed@ecobairro.local';
  const gestorEmail = 'gestor.seed@ecobairro.local';
  const adminEmail = 'admin.seed@ecobairro.local';
  const passwordPlain = 'Password12345';
  
  if (process.env.NODE_ENV === 'development') {
    const passwordHash = await bcrypt.hash(passwordPlain, BCRYPT_ROUNDS);

    const cidadao = await prisma.user.upsert({
      where: { email: cidadaoEmail },
      update: {
        passwordHash,
        role: UserRole.CIDADAO,
        emailVerified: true,
        eliminadoEm: null,
      },
      create: {
        email: cidadaoEmail,
        passwordHash,
        role: UserRole.CIDADAO,
        emailVerified: true,
        cidadaoPerfil: {
          create: {
            nomeCompleto: 'Cidadao Seed',
            rgpdAccepted: true,
          },
        },
      },
    });

    await prisma.cidadaoPerfil.upsert({
      where: { userId: cidadao.id },
      update: {
        nomeCompleto: 'Cidadao Seed',
        rgpdAccepted: true,
      },
      create: {
        userId: cidadao.id,
        nomeCompleto: 'Cidadao Seed',
        rgpdAccepted: true,
      },
    });

    await prisma.user.upsert({
      where: { email: operadorEmail },
      update: {
        passwordHash,
        role: UserRole.OPERADOR,
        emailVerified: true,
        eliminadoEm: null,
      },
      create: {
        email: operadorEmail,
        passwordHash,
        role: UserRole.OPERADOR,
        emailVerified: true,
      },
    });

    await prisma.user.upsert({
      where: { email: gestorEmail },
      update: {
        passwordHash,
        role: UserRole.GESTOR,
        emailVerified: true,
        eliminadoEm: null,
      },
      create: {
        email: gestorEmail,
        passwordHash,
        role: UserRole.GESTOR,
        emailVerified: true,
      },
    });

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash,
        role: UserRole.ADMIN,
        emailVerified: true,
        eliminadoEm: null,
      },
      create: {
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
        emailVerified: true,
      },
    });
  }

  await prisma.rota.deleteMany();
  await prisma.equipaMembro.deleteMany();
  await prisma.equipa.deleteMany();
  await prisma.tarefa.deleteMany();
  await prisma.recolha.deleteMany();
  await prisma.campanha.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.ecoponto.deleteMany();
  await prisma.report.deleteMany();
  await prisma.partilha.deleteMany();
  await prisma.noticia.deleteMany();

  await prisma.ecoponto.createMany({
    data: [
      {
        nome: 'Ecoponto Rossio',
        codigo: 'EP-001',
        morada: 'Praça do Rossio, Aveiro',
        zona: 'Centro',
        distanciaLabel: '250 m',
        ocupacao: 25,
        tipos: ['Papel', 'Vidro', 'Plástico'],
        sensorEstado: 'online',
        ultimaRecolha: '20 Jan 2026',
        ultimaAtualizacao: 'há 2 min',
        lat: 40.6409,
        lng: -8.6537,
        bateria: 87,
        temperatura: 14.0,
        ordem: 0,
      },
      {
        nome: 'Ecoponto Mercado',
        codigo: 'EP-002',
        morada: 'R. do Mercado, Aveiro',
        zona: 'Centro',
        distanciaLabel: '400 m',
        ocupacao: 95,
        tipos: ['Papel', 'Vidro', 'Plástico', 'Metal'],
        sensorEstado: 'alerta',
        ultimaRecolha: '21 Jan 2026',
        ultimaAtualizacao: 'há 5 min',
        lat: 40.639,
        lng: -8.651,
        bateria: 12,
        temperatura: 16.0,
        ordem: 1,
      },
      {
        nome: 'Ecoponto Universidade',
        codigo: 'EP-003',
        morada: 'Campus Universitário, Aveiro',
        zona: 'Norte',
        distanciaLabel: '800 m',
        ocupacao: 60,
        tipos: ['Papel', 'Plástico'],
        sensorEstado: 'online',
        ultimaRecolha: '19 Jan 2026',
        ultimaAtualizacao: 'há 8 min',
        lat: 40.6315,
        lng: -8.6574,
        bateria: 65,
        temperatura: 13.0,
        ordem: 2,
      },
      {
        nome: 'Ecoponto Glória',
        codigo: 'EP-004',
        morada: 'R. da Glória, Aveiro',
        zona: 'Sul',
        distanciaLabel: '1.1 km',
        ocupacao: 18,
        tipos: ['Vidro', 'Plástico', 'Metal'],
        sensorEstado: 'offline',
        ultimaRecolha: '18 Jan 2026',
        ultimaAtualizacao: 'há 3 dias',
        lat: 40.6445,
        lng: -8.648,
        bateria: null,
        temperatura: null,
        ordem: 3,
      },
      {
        nome: 'Ecoponto Beira-Mar',
        codigo: 'EP-005',
        morada: 'Av. Beira-Mar, Aveiro',
        zona: 'Oeste',
        distanciaLabel: '1.5 km',
        ocupacao: 88,
        tipos: ['Papel', 'Vidro'],
        sensorEstado: 'alerta',
        ultimaRecolha: '17 Jan 2026',
        ultimaAtualizacao: 'há 12 min',
        lat: 40.642,
        lng: -8.661,
        bateria: 8,
        temperatura: 15.0,
        ordem: 4,
      },
      {
        nome: 'Ecoponto Vera Cruz',
        codigo: 'EP-006',
        morada: 'R. Vera Cruz, Aveiro',
        zona: 'Centro',
        distanciaLabel: '900 m',
        ocupacao: 72,
        tipos: ['Papel', 'Vidro', 'Plástico', 'Metal'],
        sensorEstado: 'online',
        ultimaRecolha: '22 Jan 2026',
        ultimaAtualizacao: 'há 1 min',
        lat: 40.637,
        lng: -8.6555,
        bateria: 72,
        temperatura: 14.0,
        ordem: 5,
      },
      {
        nome: 'Ecoponto São Bernardo',
        codigo: 'EP-007',
        morada: 'Av. Dr. Lourenço Peixinho, Aveiro',
        zona: 'Norte',
        distanciaLabel: '1.2 km',
        ocupacao: 42,
        tipos: ['Papel', 'Metal'],
        sensorEstado: 'offline',
        ultimaRecolha: '15 Jan 2026',
        ultimaAtualizacao: 'há 2 dias',
        lat: 40.643,
        lng: -8.649,
        bateria: null,
        temperatura: null,
        ordem: 6,
      },
      {
        nome: 'Ecoponto Aradas',
        codigo: 'EP-008',
        morada: 'R. de Aradas, Aveiro',
        zona: 'Este',
        distanciaLabel: '2.1 km',
        ocupacao: 42,
        tipos: ['Vidro', 'Plástico'],
        sensorEstado: 'online',
        ultimaRecolha: '20 Jan 2026',
        ultimaAtualizacao: 'há 4 min',
        lat: 40.635,
        lng: -8.66,
        bateria: 91,
        temperatura: 13.0,
        ordem: 7,
      },
      {
        nome: 'Ecoponto Esgueira',
        codigo: 'EP-009',
        morada: 'Zona Industrial de Aveiro',
        zona: 'Este',
        distanciaLabel: '3.4 km',
        ocupacao: 91,
        tipos: ['Papel', 'Vidro', 'Plástico', 'Metal'],
        sensorEstado: 'online',
        ultimaRecolha: '22 Jan 2026',
        ultimaAtualizacao: 'há 8 min',
        lat: 40.646,
        lng: -8.644,
        bateria: 55,
        temperatura: 15.0,
        ordem: 8,
      },
    ],
  });

  // Partilhas e reports para gamificação/quiz (cada utilizador deve ver valores diferentes).
  const citizens = await prisma.user.findMany({
    where: { role: UserRole.CIDADAO, eliminadoEm: null },
    select: {
      id: true,
      email: true,
      cidadaoPerfil: { select: { nomeCompleto: true } },
      criadoEm: true,
    },
    orderBy: { criadoEm: 'asc' },
  });

  const partilhaTemplates = [
    {
      titulo: 'Frigorífico Smeg em bom estado',
      autorNome: 'Ana Miranda',
      zona: 'Rossio',
      categoria: 'eletro',
      imagemUrl: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?q=80&w=600&auto=format&fit=crop',
    },
    {
      titulo: 'Sofá de 2 lugares (Cinza)',
      autorNome: 'Carlos Vale',
      zona: 'Glória',
      categoria: 'moveis',
      imagemUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=600&auto=format&fit=crop',
    },
    {
      titulo: 'Coleção de livros técnicos',
      autorNome: 'Sofia Roberto',
      zona: 'Vera Cruz',
      categoria: 'livros',
      imagemUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=600&auto=format&fit=crop',
    },
    {
      titulo: 'Candeeiro de pé industrial',
      autorNome: 'Ricardo Pinho',
      zona: 'Beira-Mar',
      categoria: 'eletro',
      imagemUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?q=80&w=600&auto=format&fit=crop',
    },
    {
      titulo: 'Mesa de centro em carvalho',
      autorNome: 'Marta Silva',
      zona: 'Rossio',
      categoria: 'moveis',
      imagemUrl: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?q=80&w=600&auto=format&fit=crop',
    },
    {
      titulo: 'Casaco de inverno (M)',
      autorNome: 'Joana Ferreira',
      zona: 'Santiago',
      categoria: 'roupa',
      imagemUrl: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?q=80&w=600&auto=format&fit=crop',
    },
    {
      titulo: 'Cadeiras de jardim (x4)',
      autorNome: 'Bruno Lopes',
      zona: 'Vera Cruz',
      categoria: 'moveis',
      imagemUrl: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?q=80&w=600&auto=format&fit=crop',
    },
    {
      titulo: 'Conjunto de lâmpadas LED',
      autorNome: 'Raquel Santos',
      zona: 'Este',
      categoria: 'eletro',
      imagemUrl: 'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?q=80&w=600&auto=format&fit=crop',
    },
  ];

  const reportTipos = [
    'Ecoponto Cheio',
    'Deposição Ilegal',
    'Dano em Equipamento',
    'Odores',
    'Vandalismo',
  ] as const;

  const now = new Date();
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth(); // 0-11
  const today = new Date(Date.UTC(year, monthIndex, now.getUTCDate(), 12, 0, 0));

  const reportLocais = [
    'Praça do Rossio, Aveiro',
    'R. do Mercado, Aveiro',
    'Campus Universitário, Aveiro',
    'R. da Glória, Aveiro',
    'Av. Beira-Mar, Aveiro',
    'R. Vera Cruz, Aveiro',
    'Av. Dr. Lourenço Peixinho, Aveiro',
    'R. de Aradas, Aveiro',
    'Zona Industrial de Aveiro',
  ];

  // Challenge seed (usado no /quiz — metadados do hero "Desafio da Semana").
  await prisma.quizDesafio.deleteMany({ where: { ano: year } });
  await prisma.quizDesafio.create({
    data: {
      titulo: `Herói da Reciclagem ${year}`,
      bonusXp: 50,
      tempoLimiteMin: 2,
      ano: year,
      ativo: true,
    },
  });

  // Banco de perguntas do quiz (RF-19). Pool ativo do qual o backend sorteia
  // N perguntas por sessão. Bootstrap *create-if-absent*: se o pool já tem
  // perguntas, é preservado — assim re-correr o seed NÃO apaga as perguntas
  // adicionadas/editadas pelo gestor em runtime (CRUD em /admin/quiz/perguntas).
  const QUIZ_BANK_TITULO = 'Banco de Perguntas EcoBairro';
  const existingPool = await prisma.quiz.findFirst({
    where: { titulo: QUIZ_BANK_TITULO },
    include: { _count: { select: { perguntas: true } } },
  });
  if (existingPool && existingPool._count.perguntas > 0) {
    console.log(
      `[seed] Pool de quiz já existe com ${existingPool._count.perguntas} perguntas — preservado (edições do gestor).`,
    );
  } else {
    if (existingPool) {
      await prisma.quiz.deleteMany({ where: { titulo: QUIZ_BANK_TITULO } });
    }
    await prisma.quiz.create({
      data: {
        titulo: QUIZ_BANK_TITULO,
        descricao: 'Perguntas sobre separação de resíduos e reciclagem (sorteadas aleatoriamente).',
        tipo: 'SEMANAL',
        disponivelDe: new Date(Date.UTC(year, 0, 1)),
        disponivelAte: new Date(Date.UTC(year + 1, 0, 1)),
        numeroPerguntas: 5,
        pontosMaximo: 5 * 10,
        categoriaTema: null,
        ativo: true,
        perguntas: {
          create: QUIZ_BANK.map((q, idx) => ({
            ordem: idx + 1,
            textoPergunta: q.textoPergunta,
            explicacaoEducativa: q.explicacaoEducativa,
            categoria: q.categoria as QuizCategoria,
            pontos: 10,
            opcoes: {
              create: q.opcoes.map((o, oIdx) => ({
                ordem: oIdx + 1,
                texto: o.texto,
                correta: o.correta,
              })),
            },
          })),
        },
      },
    });
  }

  // Inserção de partilhas e reports para cada cidadão existente.
  for (let idx = 0; idx < citizens.length; idx += 1) {
    const c = citizens[idx]!;
    const profileName = c.cidadaoPerfil?.nomeCompleto ?? c.email;

    const partilhaCount = idx === 0 ? 5 : idx === 1 ? 3 : idx === 2 ? 2 : 1;
    const resolvedCount = idx === 0 ? 25 : idx === 1 ? 12 : idx === 2 ? 6 : 2;
    const streakDays = idx === 0 ? 12 : idx === 1 ? 6 : idx === 2 ? 3 : 1;

    // Partilhas (marcadas com userId para serem individuais).
    const partilhasToCreate = partilhaCount;
    for (let p = 0; p < partilhasToCreate; p += 1) {
      const t = partilhaTemplates[(idx + p) % partilhaTemplates.length]!;
      const createdAt = new Date(Date.UTC(year, monthIndex, 1 + ((idx + p) % 28), 10, 0, 0));
      await prisma.partilha.create({
        data: {
          titulo:    t.titulo,
          autorNome: profileName,
          zona:      t.zona,
          categoria: t.categoria,
          imagemUrl: t.imagemUrl,
          userId:    c.id,
          criadoEm:  createdAt,
        },
      });
    }

    // Reports resolvidos em dias consecutivos (para streak).
    const dates = Array.from({ length: streakDays }, (_, d) => {
      const dd = new Date(today);
      dd.setUTCDate(dd.getUTCDate() - d);
      return dd;
    });

    const base = Math.floor(resolvedCount / streakDays);
    const remainder = resolvedCount - base * streakDays;

    let created = 0;
    for (let d = 0; d < dates.length; d += 1) {
      const countOnDay = base + (d < remainder ? 1 : 0);
      for (let j = 0; j < countOnDay; j += 1) {
        const tipo = reportTipos[(idx + d + j) % reportTipos.length]!;
        const local = reportLocais[(idx + d + j) % reportLocais.length]!;
        await prisma.report.create({
          data: {
            titulo: `Report ${idx}-${d}-${j}`,
            tipo,
            descricao:
              'Descricao do reporte para gamificação e métricas do utilizador (dados de seed).',
            local,
            status: ReportStatus.RESOLVIDO,
            userId: c.id,
            criadoEm: dates[d]!,
          },
        });
        created += 1;
        if (created >= resolvedCount) break;
      }
      if (created >= resolvedCount) break;
    }
  }

  await prisma.noticia.createMany({
    data: [
      {
        titulo: 'Campanha de Limpeza do Rio Vouga',
        resumo:
          'O município de Aveiro convida todos os cidadãos a participar na grande campanha de limpeza das margens do Rio Vouga. Serão fornecidos equipamentos e os voluntários receberão eco-pontos extra na plataforma ecoBairro.',
        imagemUrl:
          'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?q=80&w=900&auto=format&fit=crop',
        tag: 'Ambiente',
        destaque: true,
        publishedAt: new Date('2025-12-20T12:00:00.000Z'),
        tempoLeituraMin: 3,
      },
      {
        titulo: 'Novos Ecopontos Inteligentes Instalados',
        resumo:
          '15 novos equipamentos com sensores IoT e compactação solar foram instalados no centro de Aveiro, melhorando a capacidade de monitorização.',
        imagemUrl:
          'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?q=80&w=600&auto=format&fit=crop',
        tag: 'Infraestrutura',
        destaque: false,
        publishedAt: new Date('2025-12-18T12:00:00.000Z'),
        tempoLeituraMin: 2,
      },
      {
        titulo: 'Compostagem Urbana Chega a 5 Parques',
        resumo:
          'O programa de compostagem coletiva expande-se a mais cinco parques da cidade. As inscrições estão abertas para residentes.',
        imagemUrl:
          'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=600&auto=format&fit=crop',
        tag: 'Sustentabilidade',
        destaque: false,
        publishedAt: new Date('2025-12-15T12:00:00.000Z'),
        tempoLeituraMin: 4,
      },
      {
        titulo: 'Aveiro Bate Recorde de Reciclagem em 2025',
        resumo:
          'Com mais de 4.200 toneladas separadas, o município atinge o melhor resultado de sempre em taxa de valorização de resíduos.',
        imagemUrl:
          'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=600&auto=format&fit=crop',
        tag: 'Relatório',
        destaque: false,
        publishedAt: new Date('2025-12-10T12:00:00.000Z'),
        tempoLeituraMin: 3,
      },
    ],
  });

  // ─── Fila de Prioridades ───────────────────────────────────────────────────
  await prisma.tarefa.createMany({
    data: [
      { titulo: 'Recolha urgente EP-001 — Rossio',         local: 'Praça do Rossio',        tipo: 'Recolha',    prioridade: 'critica', estado: 'pendente'  },
      { titulo: 'Reparação porta EP-008 — Aradas',         local: 'R. de Aradas, Aveiro',   tipo: 'Manutenção', prioridade: 'alta',    estado: 'em_curso', atribuido: 'Pedro Mendes' },
      { titulo: 'Recolha EP-005 — Beira-Mar',              local: 'Av. Beira-Mar',          tipo: 'Recolha',    prioridade: 'alta',    estado: 'pendente'  },
      { titulo: 'Limpeza depósito ilegal — Vera Cruz',     local: 'R. Vera Cruz, 7',        tipo: 'Limpeza',    prioridade: 'normal',  estado: 'pendente'  },
      { titulo: 'Manutenção sensor EP-004 — Glória',       local: 'R. da Glória, 45',       tipo: 'Manutenção', prioridade: 'normal',  estado: 'em_curso', atribuido: 'Sofia Lopes' },
      { titulo: 'Recolha EP-006 — Vera Cruz',              local: 'R. Vera Cruz, 33',       tipo: 'Recolha',    prioridade: 'alta',    estado: 'pendente'  },
      { titulo: 'Pintura ecoponto vandalizado — Beira-Mar',local: 'Av. Beira-Mar',          tipo: 'Manutenção', prioridade: 'baixa',   estado: 'pendente'  },
      { titulo: 'Recolha EP-002 — Mercado',                local: 'R. do Mercado, 12',      tipo: 'Recolha',    prioridade: 'alta',    estado: 'resolvido', atribuido: 'Pedro Mendes' },
    ],
  });

  // ─── Recolhas de Monos/Entulho ─────────────────────────────────────────────
  const cidadaoUser = await prisma.user.findFirst({
    where: { email: cidadaoEmail },
    select: { id: true },
  });
  if (cidadaoUser) {
    await prisma.recolha.createMany({
      data: [
        { tipo: 'Monos Volumosos', subtipo: 'Frigorífico e Máquina de Lavar', morada: 'Rua de Aveiro, 12, 3º Dto', status: 'agendado',  dataPrevista: '22/04/2026', obs: 'Deixar junto à porta do prédio.', userId: cidadaoUser.id },
        { tipo: 'Entulho',         subtipo: 'Restos de obras (Tijolos)',      morada: 'Av. Dr. Lourenço Peixinho, 45', status: 'concluido', dataPrevista: '12/04/2026', obs: 'Sacos bem fechados.', userId: cidadaoUser.id },
        { tipo: 'Monos Volumosos', subtipo: 'Sofá de 3 lugares',              morada: 'Rua Direita, 8',            status: 'pendente',  dataPrevista: null,         obs: 'Não cabe no elevador.', userId: cidadaoUser.id },
      ],
    });
  }

  // ─── Campanhas Institucionais ───────────────────────────────────────────────
  await prisma.campanha.createMany({
    data: [
      {
        titulo: 'Recolha especial de REEE — Janeiro 2026',
        corpo: 'No dia 15 de Janeiro haverá uma recolha especial de resíduos elétricos e eletrónicos em todos os bairros do concelho. Deixe os seus equipamentos junto ao ecoponto habitual até às 9h.',
        estado: 'publicada',
        dataValidade: new Date('2026-01-16'),
        autor: 'Câmara de Aveiro',
      },
      {
        titulo: 'Campanha "Aveiro Recicla Mais" — Fevereiro',
        corpo: 'Junte-se à campanha de reciclagem do mês de Fevereiro. Cada tonelada de papel reciclado poupa 17 árvores! Participe e ganhe pontos ecoBairro.',
        estado: 'publicada',
        dataValidade: new Date('2026-02-28'),
        autor: 'Câmara de Aveiro',
      },
      {
        titulo: 'Manutenção ecopontos Zona Norte — Aviso',
        corpo: 'Informamos que os ecopontos da Zona Norte estarão temporariamente sem serviço nos dias 10 e 11 de Janeiro para manutenção programada.',
        estado: 'expirada',
        dataValidade: new Date('2026-01-11'),
        autor: 'Câmara de Aveiro',
      },
      {
        titulo: 'Novo horário de recolha — Bairro do Liceu',
        corpo: 'A partir de Fevereiro, a recolha de resíduos no Bairro do Liceu passa para as terças e sextas-feiras, entre as 22h e as 2h.',
        estado: 'rascunho',
        dataValidade: new Date('2026-02-28'),
        autor: 'Câmara de Aveiro',
      },
      {
        titulo: 'Obras na Av. Central — Alteração de ecopontos',
        corpo: 'Devido às obras em curso na Av. Central, os ecopontos foram temporariamente relocalizados para a Rua de Viseu, em frente ao nº 45.',
        estado: 'publicada',
        dataValidade: new Date('2026-03-20'),
        autor: 'Câmara de Aveiro',
      },
    ],
  });

  // ─── Audit Logs ────────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { utilizador: 'admin@ecobairro.pt',      papel: 'admin',    acao: 'config', descricao: 'Alterou configurações globais do sistema',          ip: '192.168.1.10' },
      { utilizador: 'joao.silva@cm-aveiro.pt', papel: 'gestor',   acao: 'create', descricao: 'Criou mensagem institucional #12',                  ip: '192.168.1.45' },
      { utilizador: 'ana.costa@cm-aveiro.pt',  papel: 'gestor',   acao: 'update', descricao: 'Editou zona geográfica "Zona Norte"',               ip: '192.168.1.52' },
      { utilizador: 'op01@ecobairro.pt',       papel: 'operador', acao: 'login',  descricao: 'Sessão iniciada',                                   ip: '10.0.0.23'    },
      { utilizador: 'admin@ecobairro.pt',      papel: 'admin',    acao: 'delete', descricao: 'Eliminou utilizador id:47 (conta desativada)',       ip: '192.168.1.10' },
      { utilizador: 'rui.faria@cm-aveiro.pt',  papel: 'gestor',   acao: 'login',  descricao: 'Sessão iniciada',                                   ip: '172.16.0.8'   },
      { utilizador: 'op02@ecobairro.pt',       papel: 'operador', acao: 'update', descricao: 'Atualizou estado do ecoponto EP-204 para "Cheio"',  ip: '10.0.0.31'    },
      { utilizador: 'joao.silva@cm-aveiro.pt', papel: 'gestor',   acao: 'create', descricao: 'Criou zona geográfica "Bairro do Liceu"',           ip: '192.168.1.45' },
      { utilizador: 'admin@ecobairro.pt',      papel: 'admin',    acao: 'update', descricao: 'Alterou papel de utilizador id:23 para "operador"', ip: '192.168.1.10' },
      { utilizador: 'op01@ecobairro.pt',       papel: 'operador', acao: 'logout', descricao: 'Sessão terminada',                                  ip: '10.0.0.23'    },
      { utilizador: 'ana.costa@cm-aveiro.pt',  papel: 'gestor',   acao: 'delete', descricao: 'Arquivou mensagem institucional #8',                ip: '192.168.1.52' },
      { utilizador: 'rui.faria@cm-aveiro.pt',  papel: 'gestor',   acao: 'logout', descricao: 'Sessão terminada',                                  ip: '172.16.0.8'   },
    ],
  });

  // ─── Equipa + atribuição de rotas ao operador (apenas em dev) ───────────────
  let seedEquipaId: string | null = null;
  let seedOperadorId: string | null = null;
  let seedOperadorLabel = 'Pedro Mendes';

  const operadorUser = await prisma.user.findUnique({
    where: { email: operadorEmail },
    select: { id: true, email: true },
  });
  if (operadorUser) {
    const equipa = await prisma.equipa.create({ data: { nome: 'Equipa Centro' } });
    await prisma.equipaMembro.create({
      data: { equipaId: equipa.id, userId: operadorUser.id },
    });
    seedEquipaId = equipa.id;
    seedOperadorId = operadorUser.id;
    seedOperadorLabel = operadorUser.email;
  }

  // ─── Rotas de Recolha ──────────────────────────────────────────────────────
  await prisma.rota.createMany({
    data: [
      {
        nome: 'Rota Norte — Manhã',
        operador: seedOperadorLabel,
        operadorId: seedOperadorId,
        equipaId: seedEquipaId,
        estado: 'ativa',
        ecopontos: 6,
        distancia: '8.2 km',
        duracao: '1h 45min',
        waypoints: [[40.646, -8.644], [40.6445, -8.648], [40.6433, -8.648], [40.642, -8.649], [40.6409, -8.6537], [40.639, -8.651]],
        cor: '#22c55e',
      },
      {
        nome: 'Rota Sul — Tarde',
        operador: seedOperadorLabel,
        operadorId: seedOperadorId,
        equipaId: seedEquipaId,
        estado: 'pendente',
        ecopontos: 5,
        distancia: '6.5 km',
        duracao: '1h 20min',
        waypoints: [[40.639, -8.651], [40.637, -8.6555], [40.635, -8.66], [40.6315, -8.6574], [40.637, -8.66]],
        cor: '#fb923c',
      },
      {
        nome: 'Rota Beira-Mar',
        operador: 'Carlos Lima',
        estado: 'concluida',
        ecopontos: 4,
        distancia: '5.1 km',
        duracao: '1h 05min',
        waypoints: [[40.642, -8.661], [40.643, -8.658], [40.6445, -8.655], [40.643, -8.649]],
        cor: '#60a5fa',
      },
    ],
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('Seed concluido com sucesso.');
    console.log('Conta cidadao:', cidadaoEmail);
    console.log('Conta operador:', operadorEmail);
    console.log('Conta gestor:', gestorEmail);
    console.log('Conta admin:', adminEmail);
    console.log('Password (todas):', passwordPlain);
  }
}

main()
  .catch((error: unknown) => {
    console.error('Falha ao executar seed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
