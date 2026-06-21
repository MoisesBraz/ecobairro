# EcoBairro Digital — Wiki do Projeto

> Plataforma cívica de gestão de resíduos urbanos para o concelho de Aveiro: mapa de ecopontos com estado em tempo real (IoT), reports georreferenciados do cidadão, operação de recolha (frota + equipas) e comunicação institucional.

Este é o **índice-mestre** da documentação. As páginas estão numeradas para leitura sequencial; cada página abre com uma introdução ("o quê / porquê") e termina com uma secção **Ver também**.

## 1. Espinha conceptual

| # | Página | Conteúdo |
|---|--------|----------|
| 01 | [[01-Introducao]] | Visão, contexto de Aveiro, **glossário de papéis** (Cidadão / Operador / Gestor / Admin) |
| 02 | [[02-Requisitos]] | **Índice** dos requisitos — 11 módulos funcionais + RNF (ver sub-tabela abaixo) |
| 03 | [[03-Casos-de-Uso]] | Diagrama de casos de uso (Mermaid) + descrição por ator |
| 04 | [[04-Modelo-de-Conceitos]] | Modelo conceptual do domínio (Mermaid `classDiagram`) |
| 05 | [[05-Diagrama-de-Classes]] | Diagrama de classes técnico (Mermaid `classDiagram`) |
| 06 | [[06-Arquitetura]] | Arquitetura de software e dados (Mermaid `flowchart`) |
| 07 | [[07-Modelo-de-Dados]] | Índice do modelo físico (tabelas, relações, fluxos) |

### Requisitos por módulo (`02-Requisitos/`)

Cada módulo tem requisitos detalhados, regras de negócio e **fluxogramas** (flowchart + sequência + ciclos de estado).

| Módulo | Página | RF |
|--------|--------|----|
| 1 — Mapa de Ecopontos e Estado | [[02-Requisitos/M01-Mapa-Ecopontos]] | RF-01–03 |
| 2 — Sensores IoT e Operações | [[02-Requisitos/M02-IoT-Operacoes]] | RF-04–07 |
| 3 — Sistema de Reports | [[02-Requisitos/M03-Reports]] | RF-08–12 |
| 4 — Monos/Entulhos e Partilha | [[02-Requisitos/M04-Monos-Partilha]] | RF-13–15 |
| 5 — Comunicação e Feedback | [[02-Requisitos/M05-Comunicacao]] | RF-16–17 |
| 6 — Gamificação (opt-in) | [[02-Requisitos/M06-Gamificacao]] | RF-18–20 |
| 7 — Benefícios / porta-a-porta | [[02-Requisitos/M07-Beneficios]] | RF-21 |
| 8 — Dashboards Personalizáveis | [[02-Requisitos/M08-Dashboards]] | RF-22–23 |
| 9 — Utilizadores e Perfis | [[02-Requisitos/M09-Utilizadores-Perfis]] | RF-24–25 |
| 10 — Acesso inclusivo e IoT | [[02-Requisitos/M10-Acesso-Inclusivo-IoT]] | RF-26–27 |
| 11 — Frota e Equipas de Rota 🔧 | [[02-Requisitos/M11-Frota-Equipas]] | RF-28–30 |
| RNF — Não Funcionais | [[02-Requisitos/RNF-Nao-Funcionais]] | RNF-* |

## 2. Modelo de dados detalhado (`models/`)

Wiki técnico por domínio — schemas PostgreSQL e endpoints REST.

- [[models/Cidadão/Init|Cidadão — Utilizadores, Perfis e Autenticação]]
- [[models/Ecopontos, Zonas, Badges e Quiz/Init|Ecopontos, Zonas, Badges e Quiz]]
- [[models/IoT e Dispositivos/Init|IoT e Dispositivos]]
- [[models/Reports, Recolhas, Comunicação e Operacional/init|Reports, Recolhas, Comunicação e Operacional]]
- [[models/init e conclusao|Mapa completo de relacionamentos e fluxos]]

## 3. Guias de implementação (`_playbooks/`)

Notas operacionais de desenvolvimento (runtime, scaffolds, RGPD, demo).

- [[_playbooks/05-local-runtime-bootstrap|Arranque do runtime local]]
- [[_playbooks/06-frontend-scaffold|Scaffold do frontend (Vite + React + TanStack)]]
- [[_playbooks/07-web-implementation-playbook|Playbook de implementação web]]
- [[_playbooks/08-api-implementation-playbook|Playbook de implementação da API (NestJS)]]
- [[_playbooks/09-error-handling|Tratamento de erros (API → Web)]]
- [[_playbooks/cookies-rgpd-implementation|Cookies e RGPD]]
- [[_playbooks/demo-script|Guião de demonstração]]

## Convenções desta wiki

- **Papéis** (RBAC): `CIDADAO`, `OPERADOR` (terreno/recolha), `GESTOR` (backoffice operacional), `ADMIN`. Ver [[01-Introducao#Glossário de papéis]].
- **Diagramas** são sempre código **Mermaid** (renderizam no Obsidian e em repowiki), nunca imagens.
- **Navegação** por wikilinks Obsidian `[[Página|alias]]`; esta Home é o hub central.
- **Idioma**: pt-PT, terminologia contextualizada para Aveiro.

## Ver também

- [[02-Requisitos]] · [[06-Arquitetura]] · [[07-Modelo-de-Dados]]
