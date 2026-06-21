# 02 · Requisitos — Índice

Levantamento de requisitos do EcoBairro Digital, **retificado** para o modelo de papéis `CIDADAO / OPERADOR / GESTOR / ADMIN` (ver [[01-Introducao#Glossário de papéis]]). Convenção de prioridade: **Alta (A) / Média (M) / Baixa (B) / Futuro (F)**.

## Módulos funcionais

| Módulo | Página | RF | Prioridade dominante |
|--------|--------|----|----------------------|
| 1 — Mapa de Ecopontos e Estado | [[02-Requisitos/M01-Mapa-Ecopontos]] | RF-01–03 | Alta |
| 2 — Sensores IoT e Operações | [[02-Requisitos/M02-IoT-Operacoes]] | RF-04–07 | Alta |
| 3 — Sistema de Reports | [[02-Requisitos/M03-Reports]] | RF-08–12 | Alta |
| 4 — Monos/Entulhos e Partilha | [[02-Requisitos/M04-Monos-Partilha]] | RF-13–15 | Média |
| 5 — Comunicação e Feedback | [[02-Requisitos/M05-Comunicacao]] | RF-16–17 | Alta |
| 6 — Gamificação (opt-in) | [[02-Requisitos/M06-Gamificacao]] | RF-18–20 | Média |
| 7 — Benefícios / porta-a-porta | [[02-Requisitos/M07-Beneficios]] | RF-21 | Média |
| 8 — Dashboards Personalizáveis | [[02-Requisitos/M08-Dashboards]] | RF-22–23 | Alta |
| 9 — Utilizadores e Perfis | [[02-Requisitos/M09-Utilizadores-Perfis]] | RF-24–25 | Alta |
| 10 — Acesso inclusivo e IoT | [[02-Requisitos/M10-Acesso-Inclusivo-IoT]] | RF-26–27 | Alta |
| 11 — Frota e Equipas de Rota 🔧 | [[02-Requisitos/M11-Frota-Equipas]] | RF-28–30 | Alta |
| RNF — Não Funcionais | [[02-Requisitos/RNF-Nao-Funcionais]] | RNF-* | Alta |

## Tabela-resumo dos requisitos funcionais

| RF     | Prio. | Título                              | Módulo                                          |
| ------ | :---: | ----------------------------------- | ----------------------------------------------- |
| RF-01  |   A   | Mapa de ecopontos                   | [[02-Requisitos/M01-Mapa-Ecopontos\|M1]]        |
| RF-02  |   A   | Detalhe do ecoponto                 | [[02-Requisitos/M01-Mapa-Ecopontos\|M1]]        |
| RF-03  |   M   | Filtrar e navegar                   | [[02-Requisitos/M01-Mapa-Ecopontos\|M1]]        |
| RF-04  |   A   | Ingestão de telemetria              | [[02-Requisitos/M02-IoT-Operacoes\|M2]]         |
| RF-05  |   A   | Dashboard operacional (Gestor)      | [[02-Requisitos/M02-IoT-Operacoes\|M2]]         |
| RF-06  |   M   | Gestão de zonas operacionais        | [[02-Requisitos/M02-IoT-Operacoes\|M2]]         |
| RF-07  |   F   | Controlo de acesso/NFC              | [[02-Requisitos/M02-IoT-Operacoes\|M2]]         |
| RF-08  |   A   | Criar report georreferenciado       | [[02-Requisitos/M03-Reports\|M3]]               |
| RF-09  |   A   | Limite anti-spam por zona           | [[02-Requisitos/M03-Reports\|M3]]               |
| RF-10  |   A   | Triagem e encaminhamento (Gestor)   | [[02-Requisitos/M03-Reports\|M3]]               |
| RF-11  |   A   | Estado do report e transparência    | [[02-Requisitos/M03-Reports\|M3]]               |
| RF-12  |   M   | Deteção de duplicados               | [[02-Requisitos/M03-Reports\|M3]]               |
| RF-13  |   A   | Guia de deposição de monos/entulhos | [[02-Requisitos/M04-Monos-Partilha\|M4]]        |
| RF-14  |   M   | Pedido de recolha                   | [[02-Requisitos/M04-Monos-Partilha\|M4]]        |
| RF-15  |   M   | Partilha Cidadão-Cidadão            | [[02-Requisitos/M04-Monos-Partilha\|M4]]        |
| RF-16  |   A   | Notificações                        | [[02-Requisitos/M05-Comunicacao\|M5]]           |
| RF-17  |   M   | Mensagens institucionais (Gestor)   | [[02-Requisitos/M05-Comunicacao\|M5]]           |
| RF-18  |   M   | Opt-in de gamificação               | [[02-Requisitos/M06-Gamificacao\|M6]]           |
| RF-19  |   M   | Quiz semanal de separação           | [[02-Requisitos/M06-Gamificacao\|M6]]           |
| RF-20  |   B   | Recompensas educativas              | [[02-Requisitos/M06-Gamificacao\|M6]]           |
| RF-21  |   M   | Campanhas de benefício (Gestor)     | [[02-Requisitos/M07-Beneficios\|M7]]            |
| RF-22  |   A   | Widgets por perfil                  | [[02-Requisitos/M08-Dashboards\|M8]]            |
| RF-23  |   M   | KPIs e histórico                    | [[02-Requisitos/M08-Dashboards\|M8]]            |
| RF-24  |   A   | Registo/Autenticação                | [[02-Requisitos/M09-Utilizadores-Perfis\|M9]]   |
| RF-25  |   A   | Dados pessoais sensíveis (futuro)   | [[02-Requisitos/M09-Utilizadores-Perfis\|M9]]   |
| RF-26  |   A   | Cobertura por sensores              | [[02-Requisitos/M10-Acesso-Inclusivo-IoT\|M10]] |
| RF-27  |   M   | Alertas automáticos sem app (SMS)   | [[02-Requisitos/M10-Acesso-Inclusivo-IoT\|M10]] |
| RF-28  |   A   | Gestão de frota (carrinhas)         | [[02-Requisitos/M11-Frota-Equipas\|M11]]        |
| RF-29  |   A   | Criação de equipas de rota          | [[02-Requisitos/M11-Frota-Equipas\|M11]]        |
| RF-30  |   A   | Execução de rota pelo operador      | [[02-Requisitos/M11-Frota-Equipas\|M11]]        |

> **Requisitos não funcionais** — Segurança, Privacidade & RGPD, Performance, Usabilidade & Acessibilidade, Confiabilidade/Escala/Legal: ver [[02-Requisitos/RNF-Nao-Funcionais|RNF — Não Funcionais]].

## Ver também

- [[03-Casos-de-Uso]] — RFs mapeados a casos de uso por ator
- [[07-Modelo-de-Dados]] — tabelas que materializam estes requisitos
- [[models/Reports, Recolhas, Comunicação e Operacional/init|Domínio operacional (reports, recolhas, rotas)]]
