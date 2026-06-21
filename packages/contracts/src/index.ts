export * from './errors.js';

export type RuntimeServiceName =
  | 'web'
  | 'api'
  | 'analytics'
  | 'postgres'
  | 'redis'
  | 'nginx';

export type ServiceStatus = 'ok' | 'error';

export type DependencyStatus = 'up' | 'down';

export interface DependencyHealth {
  name: string;
  status: DependencyStatus;
  details?: string;
}

export interface ServiceHealthPayload {
  service: string;
  status: ServiceStatus;
  timestamp: string;
  dependencies?: DependencyHealth[];
}

export type UserRole =
  | 'CIDADAO'
  | 'OPERADOR'
  | 'GESTOR'
  | 'ADMIN';

export interface RegisterRequest {
  email: string;
  password: string;
  nome_completo?: string;
  phone?: string;
  rgpd_accepted: boolean;
}

export interface RegisterResponse {
  id: string;
  email: string;
  role: UserRole;
  email_verified: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  requires_2fa: boolean;
  pre_auth_token: string | null;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface AuthMeResponse {
  id: string;
  email: string;
  role: UserRole;
  email_verified: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  ok: true;
  reset_token?: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface CitizenSelfProfileResponse {
  id: string;
  email: string;
  phone: string | null;
  role: 'CIDADAO';
  email_verified: boolean;
  nome_completo: string | null;
  gamification_opt_in: boolean;
  notificacao_prefs: Record<string, unknown> | null;
  dashboard_widgets: Record<string, unknown> | null;
  criado_em: string;
}

export interface UpdateCitizenSelfProfileRequest {
  phone?: string;
  nome_completo?: string;
  gamification_opt_in?: boolean;
  notificacao_prefs?: Record<string, unknown>;
  dashboard_widgets?: Record<string, unknown>;
}

export type ReportStatus = 'pendente' | 'analise' | 'resolvido' | 'rejeitado';

export type ReportTipo =
  | 'Ecoponto Cheio'
  | 'Deposição Ilegal'
  | 'Dano em Equipamento'
  | 'Odores'
  | 'Vandalismo';

export interface ReportRecord {
  id: string;
  titulo: string;
  tipo: ReportTipo;
  descricao: string;
  local: string;
  data: string;
  status: ReportStatus;
  imagem?: string;
  user_id: string;
  /** Coordenadas opcionais (WGS84). Reports antigos não têm. */
  lat?: number;
  lng?: number;
}

export interface CreateReportRequest {
  titulo: string;
  tipo: ReportTipo;
  descricao: string;
  local: string;
  imagem?: string;
  /** Georreferenciação opcional (R2/R8). Ambas ou nenhuma. */
  lat?: number;
  lng?: number;
}

export interface CreateReportResponse {
  report: ReportRecord;
}

export interface ListReportsQuery {
  status?: ReportStatus;
  tipo?: ReportTipo;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ListReportsResponse {
  reports: ReportRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UpdateReportStatusRequest {
  status: ReportStatus;
}

export interface UpdateReportStatusResponse {
  report: ReportRecord;
}

export interface ReportStatsByStatus {
  pendente: number;
  analise: number;
  resolvido: number;
  rejeitado: number;
}

export interface ReportZonaStat {
  zona: string;
  total: number;
}

export interface ReportStatsResponse {
  total: number;
  byStatus: ReportStatsByStatus;
  zonas: ReportZonaStat[];
  recent: ReportRecord[];
  scope: 'me' | 'global';
}

export interface ReportStatsQuery {
  recentLimit?: number;
  scope?: 'me' | 'global';
}

/** Ecoponto completo (mapa + backoffice). */
export type EcopontoNivel = 'baixo' | 'medio' | 'alto' | 'cheio'
export type EcopontoSensor = 'online' | 'offline' | 'alerta'

export interface EcopontoRecord {
  id: string
  nome: string
  codigo: string | null
  morada: string
  codigo_postal: string | null
  zona: string | null
  distancia_label: string
  ocupacao: number
  nivel: EcopontoNivel
  tipos: string[]
  sensor_estado: EcopontoSensor
  ultima_recolha: string | null
  ultima_atualizacao: string | null
  lat: number
  lng: number
  bateria: number | null
  temperatura: number | null
  ativo: boolean
  ordem: number
}

export interface ListEcopontosQuery {
  /** Pesquisa de texto livre: nome, morada, código postal, zona */
  q?: string
  /** Filtrar por zona */
  zona?: string
  /** Filtrar por código postal (prefixo) */
  codigo_postal?: string
  /** Filtrar por tipo de resíduo */
  tipo?: string
  /** Filtrar por nível de ocupação */
  nivel?: EcopontoNivel
  /** Incluir inativos */
  todos?: boolean
  /**
   * Página (1-based). Paginação é opt-in: se omitida, devolve todos os
   * resultados (modo usado pelas vistas de mapa/agregação).
   */
  page?: number
  /** Itens por página (só aplicado quando `page` é fornecido) */
  pageSize?: number
}

export interface ListEcopontosResponse {
  ecopontos: EcopontoRecord[]
  total: number
  /** Presente apenas no modo paginado (quando a query envia `page`) */
  page?: number
  /** Presente apenas no modo paginado (quando a query envia `page`) */
  pageSize?: number
}

/**
 * Lista de zonas distintas (ativas). Serve para popular o filtro de zona sem
 * ter de carregar todos os ecopontos — query barata `SELECT DISTINCT zona`.
 */
export interface ListEcopontoZonasResponse {
  zonas: string[]
}

export interface CreateEcopontoRequest {
  nome: string
  codigo?: string
  morada: string
  zona?: string
  ocupacao: number
  tipos?: string[]
  sensor_estado?: EcopontoSensor
  ultima_recolha?: string
  lat: number
  lng: number
  ordem?: number
}

export interface UpdateEcopontoRequest {
  nome?: string
  codigo?: string
  morada?: string
  zona?: string
  ocupacao?: number
  tipos?: string[]
  sensor_estado?: EcopontoSensor
  ultima_recolha?: string
  lat?: number
  lng?: number
  ativo?: boolean
  ordem?: number
}

/** Notícias e eventos da plataforma. */
export interface NoticiaRecord {
  id: string;
  titulo: string;
  resumo: string;
  imagem_url: string;
  conteudo: string;
  tag: string;
  destaque: boolean;
  data: string;
  tempo_leitura_min: number;
}

export interface GetNoticiaResponse {
  noticia: NoticiaRecord;
}

export interface ListNoticiasResponse {
  noticias: NoticiaRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ListNoticiasQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateNoticiaRequest {
  titulo: string;
  resumo: string;
  conteudo?: string;
  imagem_url?: string;
  categoria?: string;
  destaque?: boolean;
  tempo_leitura_min?: number;
}

export interface CreateNoticiaResponse {
  noticia: NoticiaRecord;
}

/** Utilizadores (admin). */
export interface UserRecord {
  id: string;
  email: string;
  role: string;
  nome: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface ListUsersResponse {
  users: UserRecord[];
  total: number;
  page: number;
  pageSize: number;
  /** Contagens globais (toda a tabela), independentes da paginação/filtros. */
  counts?: {
    ativos: number;
    inativos: number;
    admins: number;
  };
}

export interface ListUsersQuery {
  role?: string;
  q?: string;
  ativo?: boolean;
  page?: number;
  pageSize?: number;
}

/** Opção de papel para selects (derivada do enum UserRole). */
export interface AdminRoleOption {
  value: string;
  label: string;
}

export interface ListRolesResponse {
  roles: AdminRoleOption[];
}

/** Criação de utilizador pelo admin (gera password + envia email). */
export interface CreateUserRequest {
  nome: string;
  email: string;
  role: string;
}

/** Alteração de papel de um utilizador existente. */
export interface UpdateUserRoleRequest {
  role: string;
}

/** Analytics agregados. */
export interface AnalyticsMonthly {
  label: string;
  value: number;
}

export interface AnalyticsTipo {
  tipo: string;
  total: number;
  pct: number;
}

export interface AnalyticsZona {
  zona: string;
  ecopontos: number;
  reportes: number;
  resolvidos: number;
}

export interface AnalyticsKpis {
  reports_total: number;
  reports_mes: number;
  taxa_resolucao: number;
  ecopontos_ativos: number;
  users_total: number;
}

export interface PublicStatsResponse {
  ecopontos_ativos: number;
  cidadaos_total: number;
  taxa_resolucao: number;
}

export interface AnalyticsResponse {
  kpis: AnalyticsKpis;
  reports_mensais: AnalyticsMonthly[];
  resolucao_mensais: AnalyticsMonthly[];
  tipos: AnalyticsTipo[];
  zonas: AnalyticsZona[];
}

/** Partilhas locais (troca de objetos na comunidade). */
export type PartilhaCategoria = 'moveis' | 'eletro' | 'livros' | 'roupa';

export interface PartilhaRecord {
  id: string;
  titulo: string;
  autorNome: string;
  zona: string;
  categoria: PartilhaCategoria;
  imagem_url: string | null;
  data: string;
  user_id: string | null;
}

export interface ListPartilhasResponse {
  partilhas: PartilhaRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreatePartilhaRequest {
  titulo: string;
  zona: string;
  categoria: PartilhaCategoria;
  imagem_url?: string;
}

export interface CreatePartilhaResponse {
  partilha: PartilhaRecord;
}

export interface ListPartilhasQuery {
  categoria?: PartilhaCategoria;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** Feed agregado da página home (ecopontos, partilhas, notícias + métricas do cidadão). */
export interface HomeEcoponto {
  id: string;
  nome: string;
  distancia: string;
  ocupacao: number;
  map_url: string;
}

export interface ListFavoritosResponse {
  ecopontos: HomeEcoponto[];
}

export interface AddFavoritoRequest {
  ecoponto_id: string;
}

export interface HomePartilha {
  id: string;
  titulo: string;
  utilizador: string;
  zona: string;
}

export interface HomeNoticia {
  id: string;
  imagem_url: string;
  titulo: string;
  resumo: string;
  conteudo?: string;
  data: string;
  tempo_leitura: string;
  tag: string;
}

export interface HomeAlerta {
  nome: string;
  ocupacao: number;
}

export interface HomeGamification {
  nivel: string;
  pontos: number;
  pontos_proximo: number;
}

export interface HomeImpacto {
  reciclagem_kg: number;
  comunidade_pax: number;
  arvores_equivalentes: number;
}

export interface HomeReportsResumo {
  ativos: number;
  resolvidos: number;
  total: number;
  progresso: number;
  proximo_nivel: string;
}

export interface HomeViewer {
  id: string;
  nome: string | null;
  email: string;
  role: UserRole;
}

export interface HomeFeedResponse {
  ecopontos: HomeEcoponto[];
  partilhas: HomePartilha[];
  noticias: HomeNoticia[];
  alerta: HomeAlerta | null;
  viewer: HomeViewer | null;
  gamification: HomeGamification;
  impacto: HomeImpacto;
  reports: HomeReportsResumo;
}

/** Fila de prioridades (tarefas operacionais). */
export type TarefaPrioridade = 'critica' | 'alta' | 'normal' | 'baixa'
export type TarefaEstado = 'pendente' | 'em_curso' | 'resolvido'

export interface TarefaRecord {
  id: string;
  titulo: string;
  local: string;
  tipo: string;
  prioridade: TarefaPrioridade;
  estado: TarefaEstado;
  atribuido: string | null;
  criado_em: string;
}

export interface ListFilaQuery {
  estado?: TarefaEstado | 'todos';
  page?: number;
  pageSize?: number;
}

export interface ListFilaResponse {
  tarefas: TarefaRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateTarefaRequest {
  prioridade?: TarefaPrioridade;
  estado?: TarefaEstado;
  atribuido?: string | null;
}

/**
 * Analytics geoespacial — servido pelo serviço FastAPI (`/analytics`, não `/api`).
 * Ver `apps/analytics/CLAUDE.md`.
 */

/** OP3 — item da fila de prioridades operacional (ecoponto ranqueado por urgência). */
export interface PrioridadeRecord {
  id: string;
  nome: string;
  zona: string;
  ocupacao: number;
  sensor_estado: string;
  bateria: number | null;
  lat: number | null;
  lng: number | null;
  score_prioridade: number;
  motivo: string;
}

/** R12 — KPIs de reports (tempo de resolução, por categoria/zona). GESTOR/ADMIN. */
export interface ReportsKpiCategoria {
  categoria: string;
  total: number;
  resolvidos: number;
  tempo_medio_horas: number | null;
}
export interface ReportsKpiZona {
  zona: string;
  total: number;
  resolvidos: number;
}
export interface ReportsKpisResponse {
  periodo: { de: string | null; ate: string | null };
  kpis: {
    total: number;
    por_estado: { pendente: number; analise: number; resolvido: number; rejeitado: number };
    taxa_resolucao: number;
    tempo_medio_resolucao_horas: number | null;
  };
  por_categoria: ReportsKpiCategoria[];
  por_zona: ReportsKpiZona[];
}

/** OP2 — heatmap de enchimento por ecoponto. GESTOR/ADMIN. */
export interface HeatmapPonto {
  id: string;
  nome: string;
  zona: string;
  ocupacao: number;
  sensor_estado: string;
  lat: number;
  lng: number;
  peso: number;
}
export interface HeatmapResponse {
  pontos: HeatmapPonto[];
  resumo: {
    total: number;
    faixas: { baixo: number; medio: number; alto: number };
    centro: { lat: number; lng: number } | null;
    bbox: { min_lat: number; min_lng: number; max_lat: number; max_lng: number } | null;
  };
}

/** R2 — ecoponto próximo (ST_DWithin). Devolvido pelo serviço analytics. */
export interface EcopontoProximo {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  distancia_m: number;
}

/** R8 — deteção de duplicados antes de submeter um reporte (mesma categoria + raio + 7 dias). */
export interface ReportDuplicadoCandidato {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  lat: number | null;
  lng: number | null;
  data: string;
  distancia_m: number;
}
export interface ReportsDuplicadosResponse {
  duplicado: boolean;
  candidatos: ReportDuplicadoCandidato[];
}

/** Pedidos de recolha de monos/entulho. */
export type RecolhaStatus = 'pendente' | 'agendado' | 'concluido'

export interface RecolhaRecord {
  id: string;
  tipo: string;
  subtipo: string;
  morada: string;
  status: RecolhaStatus;
  obs: string | null;
  data_pedido: string;
  data_prevista: string | null;
  user_id: string | null;
}

export interface ListRecolhasResponse {
  recolhas: RecolhaRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateRecolhaRequest {
  tipo: string;
  subtipo: string;
  morada: string;
  obs?: string;
}

export interface CreateRecolhaResponse {
  recolha: RecolhaRecord;
}

/** Geocoding (pesquisa de morada/rua no concelho de Aveiro via Nominatim/OSM). */
export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Morada completa devolvida pelo serviço (display name). */
  label: string;
  /** Nome da rua, quando disponível. */
  rua: string | null;
  /** Código postal, quando disponível. */
  codigo_postal: string | null;
}

export interface GeocodeSearchResponse {
  results: GeocodeResult[];
}

/** Campanhas / mensagens institucionais. */
export type CampanhaEstado = 'rascunho' | 'publicada' | 'expirada'

export interface CampanhaRecord {
  id: string;
  titulo: string;
  corpo: string;
  estado: CampanhaEstado;
  data_criacao: string;
  data_validade: string;
  autor: string;
}

export interface ListCampanhasResponse {
  campanhas: CampanhaRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateCampanhaRequest {
  titulo: string;
  corpo: string;
  dataValidade: string;
}

export interface UpdateCampanhaRequest {
  titulo?: string;
  corpo?: string;
  estado?: CampanhaEstado;
  data_validade?: string;
}

export interface ListCampanhasQuery {
  estado?: CampanhaEstado;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** Audit logs. */
export type AuditAcao = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'config'

export interface AuditLogRecord {
  id: string;
  utilizador: string;
  papel: string;
  acao: AuditAcao;
  descricao: string;
  ip: string;
  data: string;
  hora: string;
}

export interface ListAuditLogsResponse {
  logs: AuditLogRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListAuditLogsQuery {
  acao?: AuditAcao | 'login_logout';
  q?: string;
  page?: number;
  pageSize?: number;
}

/** Rotas de recolha. */
export type RotaEstado = 'ativa' | 'concluida' | 'pendente'

/** Paragem (ecoponto) de uma rota, na ordem de visita calculada. */
export interface RotaParagem {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  ocupacao: number;
  ordem: number;
}

export interface RotaRecord {
  id: string;
  nome: string;
  operador: string;
  /** Operador (User) a quem a rota está atribuída; `null` se não atribuída. */
  operadorId: string | null;
  /** Equipa a que a rota pertence; `null` se não atribuída. */
  equipaId: string | null;
  estado: RotaEstado;
  ecopontos: number;
  distancia: string;
  duracao: string;
  /** Coordenadas das paragens (ecopontos) na ordem de visita — markers numerados. */
  waypoints: [number, number][];
  /** Geometria do trajeto por estradas (OSRM); vazio em rotas antigas/seed (cai p/ waypoints). */
  geometria: [number, number][];
  /** Paragens enriquecidas (id/nome/ocupação) na ordem; vazio em rotas antigas/seed. */
  paragens: RotaParagem[];
  /** Zona de recolha da rota; `null` quando não definida. */
  zona: string | null;
  cor: string;
}

export interface ListRotasResponse {
  rotas: RotaRecord[];
  total: number;
}

export interface UpdateRotaRequest {
  estado?: RotaEstado;
  operador?: string;
  /** Atribuir/desatribuir operador (gestor/admin). `null` para desatribuir. */
  operadorId?: string | null;
  /** Atribuir/desatribuir equipa (gestor/admin). `null` para desatribuir. */
  equipaId?: string | null;
}

/** Pedido de criação/gravação de uma rota gerada (gestor/admin). */
export interface CreateRotaRequest {
  nome: string;
  zona?: string | null;
  cor?: string;
  distancia: string;
  duracao: string;
  waypoints: [number, number][];
  geometria: [number, number][];
  paragens: RotaParagem[];
  ecopontoIds: string[];
}

/* ── Rota-sugestão (OP4 — cálculo OSM/TSP no serviço analytics) ── */

/** Motor de cálculo usado: `osrm` (estradas reais) ou `greedy` (fallback linha-reta). */
export type RotaMotor = 'osrm' | 'greedy'

/**
 * Resposta de `GET /operacional/rota-sugestao` (serviço analytics).
 * snake_case para espelhar a saída do FastAPI (igual a `PrioridadeRecord`/`EcopontoProximo`).
 */
export interface RotaSugestaoResponse {
  motor: RotaMotor;
  zona: string | null;
  distancia_m: number;
  duracao_s: number;
  distancia_label: string;
  duracao_label: string;
  paragens: RotaParagem[];
  geometria: [number, number][];
}

/* ── Equipas (gestão de rotas pelo gestor) ── */

/** Operador disponível para atribuição a equipas/rotas. */
export interface OperadorOption {
  id: string;
  email: string;
}

export interface ListOperadoresResponse {
  operadores: OperadorOption[];
}

/** Membro (colaborador/operador) de uma equipa. */
export interface EquipaMembroRecord {
  id: string;
  userId: string;
  email: string;
}

/** Rota resumida associada a uma equipa (para o painel do gestor). */
export interface EquipaRotaRecord {
  id: string;
  nome: string;
  estado: RotaEstado;
  operadorId: string | null;
}

export interface EquipaRecord {
  id: string;
  nome: string;
  membros: EquipaMembroRecord[];
  rotas: EquipaRotaRecord[];
}

export interface ListEquipasResponse {
  equipas: EquipaRecord[];
  total: number;
}

export interface CreateEquipaRequest {
  nome: string;
}

export interface UpdateEquipaRequest {
  nome: string;
}

export interface AddEquipaMembroRequest {
  userId: string;
}

/** Resposta para a página /quiz (Desafio da Semana) baseada em dados do utilizador. */
export interface QuizHero {
  titulo: string;
  bonus_xp: number;
  tempo_limite_seconds: number;
}

export interface QuizUserStats {
  pontos: number;
  nivel: string;
  proximoNivel: string;
  xp: number; // percentagem 0-100
  faltam_pts: number;
  streak: number; // dias/atividade consecutiva (derivado de reports resolvidos)
  posicao: number; // posição no ranking da zona/bairro (derivado)
}

export interface QuizRankingEntry {
  id: string;
  nome: string;
  pontos: number;
  avatar: string; // iniciais
  isMe: boolean;
}

export type QuizAchievementKey =
  | 'eco_sabio'
  | 'olho_vivo'
  | 'reciclagem_pro'
  | 'mestre_da_rua'
  | 'lenda_urbana'
  | 'benfeitor';

export interface QuizAchievement {
  key: QuizAchievementKey;
  nome: string;
  desc: string;
  unlocked: boolean;
}

export interface QuizMeResponse {
  hero: QuizHero;
  userStats: QuizUserStats;
  ranking: QuizRankingEntry[];
  conquistas: QuizAchievement[];
  /** Se o cidadão aderiu à gamificação (RF-18). Necessário para jogar o quiz. */
  optedIn: boolean;
}

// ── Quiz jogável (RF-19) ──────────────────────────────────────────────────

export type QuizTipo = 'SEMANAL' | 'DIARIO';
export type QuizCategoria = 'ORGANICOS' | 'RECICLAGEM' | 'LEGISLACAO' | 'GERAL';

/** Opção mostrada ao cidadão durante o jogo — NUNCA inclui `correta`. */
export interface QuizOpcaoPublic {
  id: string;
  ordem: number;
  texto: string;
}

/** Pergunta servida durante o jogo — sem indicação da resposta correta. */
export interface QuizQuestionPublic {
  id: string;
  ordem: number;
  texto: string;
  categoria: QuizCategoria;
  pontos: number;
  imagemUrl: string | null;
  opcoes: QuizOpcaoPublic[];
}

/** Resposta de `POST /v1/gamification/quiz/iniciar`. */
export interface StartQuizResponse {
  sessaoId: string;
  tipo: QuizTipo;
  tempoLimiteSeconds: number;
  expiraEm: string; // ISO timestamp
  perguntas: QuizQuestionPublic[];
}

export interface SubmitQuizAnswer {
  perguntaId: string;
  opcaoId: string;
}

/** Corpo de `POST /v1/gamification/quiz/sessao/:sessaoId/responder`. */
export interface SubmitQuizRequest {
  respostas: SubmitQuizAnswer[];
}

/** Feedback educativo por pergunta — devolvido apenas no resultado (RF-19). */
export interface QuizResultItem {
  perguntaId: string;
  texto: string;
  opcaoEscolhidaId: string | null;
  opcaoCorretaId: string;
  correta: boolean;
  pontos: number;
  explicacaoEducativa: string;
}

export interface QuizResultResponse {
  sessaoId: string;
  scoreObtido: number;
  pontosGanhos: number;
  totalPerguntas: number;
  acertos: number;
  itens: QuizResultItem[];
}

export interface QuizHistoryEntry {
  id: string;
  tipo: QuizTipo;
  scoreObtido: number;
  totalPerguntas: number;
  acertos: number;
  concluidoEm: string; // ISO timestamp
}

export interface QuizHistoryResponse {
  itens: QuizHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/** Resposta dos endpoints de opt-in (G1/G2). */
export interface GamificationOptInResponse {
  optedIn: boolean;
}

// ── Gestão de perguntas do quiz (GESTOR/ADMIN) ────────────────────────────
// CRUD de perguntas sobre o pool ativo ("Banco de Perguntas EcoBairro").
// Ao contrário das vistas do cidadão, estas EXPÕEM `correta` (é vista de gestão).

/** Opção enviada pelo gestor ao criar/editar uma pergunta. */
export interface AdminQuizOptionInput {
  texto: string;
  correta: boolean;
}

/** Opção tal como devolvida na vista de gestão (inclui `id`/`ordem`/`correta`). */
export interface AdminQuizOption {
  id: string;
  ordem: number;
  texto: string;
  correta: boolean;
}

/** Pergunta na vista de gestão — inclui a opção correta. */
export interface AdminQuizQuestion {
  id: string;
  ordem: number;
  textoPergunta: string;
  explicacaoEducativa: string;
  categoria: QuizCategoria;
  pontos: number;
  imagemUrl: string | null;
  opcoes: AdminQuizOption[];
}

/** Resposta de `GET /v1/admin/quiz/perguntas`. */
export interface ListAdminQuizQuestionsResponse {
  itens: AdminQuizQuestion[];
  total: number;
}

/** Corpo de `POST /v1/admin/quiz/perguntas`. */
export interface CreateQuizQuestionRequest {
  textoPergunta: string;
  explicacaoEducativa: string;
  categoria: QuizCategoria;
  pontos?: number;
  imagemUrl?: string | null;
  opcoes: AdminQuizOptionInput[];
}

/** Corpo de `PATCH /v1/admin/quiz/perguntas/:id` (campos parciais). */
export interface UpdateQuizQuestionRequest {
  textoPergunta?: string;
  explicacaoEducativa?: string;
  categoria?: QuizCategoria;
  pontos?: number;
  imagemUrl?: string | null;
  /** Quando presente, substitui todas as opções da pergunta. */
  opcoes?: AdminQuizOptionInput[];
}

// ────────────────────────────────────────────────────────────────────────────
// SEGURANÇA / 2FA / SESSÕES
// ────────────────────────────────────────────────────────────────────────────

export type TwoFactorType = 'NONE' | 'TOTP_APP' | 'EMAIL';

export interface VerifyTwoFactorRequest {
  pre_auth_token: string;
  code: string;
}

export interface SetupTwoFactorResponse {
  secret: string;
  otpauth_url: string;
  qr_code_data_url: string;
}

export interface EnableTwoFactorRequest {
  code: string;
}

export interface EnableTwoFactorResponse {
  enabled: true;
  backup_codes: string[];
}

export interface DisableTwoFactorRequest {
  password: string;
}

export interface RegenerateBackupCodesRequest {
  password: string;
}

export interface RegenerateBackupCodesResponse {
  backup_codes: string[];
}

export interface RevealBackupCodesRequest {
  password: string;
}

export interface RevealBackupCodesResponse {
  backup_codes: string[];
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
  type: TwoFactorType;
  backup_codes_remaining: number;
}

export interface ActiveSessionRecord {
  id: string;
  ip_address: string;
  user_agent: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  criado_em: string;
  expires_at: string;
  current: boolean;
}

export interface ListActiveSessionsResponse {
  sessions: ActiveSessionRecord[];
}

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGED'
  | 'TWO_FACTOR_ENABLED'
  | 'TWO_FACTOR_DISABLED'
  | 'ACCOUNT_LOCKED'
  | 'DEVICE_REVOKED';

export interface SecurityLogRecord {
  id: string;
  event: SecurityEventType;
  ip_address: string;
  user_agent: string | null;
  criado_em: string;
}

export interface ListSecurityLogsResponse {
  logs: SecurityLogRecord[];
  page: number;
  pageSize: number;
  total: number;
}

