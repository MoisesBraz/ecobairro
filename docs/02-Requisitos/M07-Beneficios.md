# Módulo 7 — Benefícios / recolha porta-a-porta

> Parte de [[02-Requisitos]] · [[Home]]. Cobre RF-21. Convenção de prioridade: **Alta (A) / Média (M) / Baixa (B) / Futuro (F)**.

Permite ao **Gestor** lançar **campanhas de benefício** assentes em comportamentos observáveis e **não pessoais** — sem usar NIF ou morada para *scoring*, em respeito pela minimização de dados (RGPD). 

## Atores envolvidos

| Ator | Papel neste módulo |
|------|--------------------|
| 🧑‍💼 **Gestor** | Cria e ativa campanhas; define critérios de elegibilidade não pessoais. |
| 👤 **Cidadão** | Vê campanhas da sua zona e a sua elegibilidade. |

## Requisitos

| RF | Prio. | Descrição | Critérios de aceitação |
|----|:----:|-----------|------------------------|
| **RF-21** 🔧 | M | **Campanhas de benefício (Gestor).** Campanhas baseadas em comportamentos observáveis não pessoais. | Elegibilidade clara; **sem NIF/morada** para scoring. |

## Fluxograma — criação e elegibilidade de campanhas

```mermaid
flowchart TB
    G(["🧑‍💼 Gestor"])
    C(["👤 Cidadão"])

    subgraph CRIA["Criar campanha (RF-21)"]
        N1["NestJS POST /campanhas"]
        AT["PATCH /campanhas/:id/ativar"]
        FAN["Worker fan-out notif zona"]
    end

    subgraph ELEG["Elegibilidade"]
        FAST["NestJS GET /campanhas/elegibilidade<br/>(comportamento agregado · SEM PII)"]
    end

    PGP[("PG Primário<br/>campanhas_beneficio")]
    PGR[("PG Réplica")]

    G --> N1 --> PGP
    G --> AT --> PGP
    AT --> FAN --> C
    C --> FAST --> PGR

    classDef svc fill:#388E3C,color:#fff,stroke:#1B5E20;
    classDef store fill:#1B5E20,color:#fff,stroke:#1B5E20;
    classDef cli fill:#C8E6C9,color:#000,stroke:#388E3C;
    class N1,AT,FAN,FAST svc;
    class PGP,PGR store;
    class C,G cli;
```

## Ciclo de vida — campanha de benefício (RF-21)

```mermaid
stateDiagram-v2
    [*] --> RASCUNHO: gestor cria
    RASCUNHO --> ATIVA: ativar (fan-out notif zona)
    ATIVA --> ENCERRADA: data fim / encerrada pelo gestor
    RASCUNHO --> CANCELADA: descartada
    ENCERRADA --> [*]
    CANCELADA --> [*]
```

## Regras de negócio

- **Sem PII no scoring (RF-21)** — a elegibilidade usa **comportamentos observáveis agregados** (ex.: frequência de uso de ecopontos numa zona), nunca NIF ou morada (RNF-PRIV-01/04). O endpoint de elegibilidade lê da réplica sem expor identificadores pessoais.
- **Segmentação por zona** — a campanha é criada para uma zona e a ativação dispara fan-out de notificação ([[02-Requisitos/M05-Comunicacao|Módulo 5]]).
- **Distinto da gamificação** — benefícios podem ter valor material; o quiz/badges ([[02-Requisitos/M06-Gamificacao|Módulo 6]]) são apenas educativos.

## Ver também

- [[03-Casos-de-Uso]] — pacote *Backoffice Operacional (Gestor)*
- [[02-Requisitos/M05-Comunicacao|Módulo 5]] · [[02-Requisitos/M06-Gamificacao|Módulo 6]]
- [[models/Reports, Recolhas, Comunicação e Operacional/init|Domínio Campanhas de Benefício]]
- [[07-Modelo-de-Dados]]
