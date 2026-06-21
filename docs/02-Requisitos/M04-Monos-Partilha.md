# Módulo 4 — Monos/Entulhos (informação e pedidos)

> Parte de [[02-Requisitos]] · [[Home]]. Cobre RF-13 a RF-15. Convenção de prioridade: **Alta (A) / Média (M) / Baixa (B) / Futuro (F)**.

Apoia o cidadão na gestão de **monos e entulhos**: um guia com as regras locais de Aveiro e contactos, um **pedido de recolha** que chega ao operador de terreno, e um quadro de **partilha cidadão-a-cidadão** de materiais de obra com salvaguardas legais e de privacidade.

## Atores envolvidos

| Ator | Papel neste módulo |
|------|--------------------|
| 👤 **Cidadão** | Consulta o guia, submete pedidos de recolha, publica/responde a partilhas. |
| 🚚 **Operador** | Recebe e executa o pedido de recolha em terreno (RF-14). |
| 🧑‍💼 **Gestor** | Encaminha/atribui pedidos ao operador. |

## Requisitos

| RF | Prio. | Descrição | Critérios de aceitação |
|----|:----:|-----------|------------------------|
| **RF-13** | A | **Guia de deposição de monos/entulhos.** Regras locais, locais de entrega, custos e **contactos das empresas**. | Ações rápidas **"Ligar / Email / Visitar site"**. |
| **RF-14** | M | **Pedido de recolha.** Formulário com morada, tipo/volume e foto opcional. | Gera **número de pedido** e envia ao **operador** responsável. |
| **RF-15** | M | **Partilha Cidadão-Cidadão (materiais de obra).** Quadro de anúncios para doar/ceder, **com disclaimers legais**. | Sem geolocalização exata pública por defeito; **mensagens mediadas**. |

## Fluxograma — pedido de recolha e partilha

```mermaid
flowchart TB
    C(["👤 Cidadão"])
    G(["🧑‍💼 Gestor"])
    O(["🚚 Operador"])

    subgraph GUIA["Guia (RF-13)"]
        INFO["Regras · custos · contactos<br/>Ligar / Email / Site"]
    end

    subgraph REC["Pedido de recolha (RF-14)"]
        N1["NestJS POST /recolhas/monos"]
        WK["Worker → notifica operador"]
    end

    subgraph PART["Partilha (RF-15)"]
        N2["NestJS POST /partilhas<br/>valida disclaimer"]
        MSG["Mensagens mediadas<br/>(sem GPS exato público)"]
    end

    PGP[("PG Primário")]

    C --> INFO
    C --> N1 --> PGP
    N1 --> WK --> G --> O
    C --> N2 --> PGP
    C --> MSG --> PGP

    classDef svc fill:#388E3C,color:#fff,stroke:#1B5E20;
    classDef store fill:#1B5E20,color:#fff,stroke:#1B5E20;
    classDef cli fill:#C8E6C9,color:#000,stroke:#388E3C;
    class N1,N2,WK svc;
    class PGP store;
    class C,G,O cli;
```

## Ciclo de vida — pedido de recolha (RF-14)

```mermaid
stateDiagram-v2
    [*] --> SUBMETIDO: cidadão cria pedido (nº gerado)
    SUBMETIDO --> AGENDADO: gestor atribui operador + data
    AGENDADO --> EM_RECOLHA: operador a caminho
    EM_RECOLHA --> CONCLUIDO: material recolhido
    SUBMETIDO --> CANCELADO: cidadão/gestor cancela
    AGENDADO --> CANCELADO: cancelado
    CONCLUIDO --> [*]
    CANCELADO --> [*]
```

## Regras de negócio

- **Número de pedido (RF-14)** — gerado na submissão; o pedido é encaminhado por zona ao **operador** responsável pela recolha de terreno ([[02-Requisitos/M11-Frota-Equipas|Módulo 11]]).
- **Privacidade na partilha (RF-15)** — a localização exata **não** é pública por defeito; só se mostra a zona aproximada. As mensagens entre cidadãos são **mediadas** pela plataforma (sem troca direta de contactos).
- **Disclaimers legais (RF-15)** — a publicação exige aceitação de um disclaimer (responsabilidade do cedente; materiais de obra não perigosos).
- **Guia estático com ações (RF-13)** — contactos das empresas com *deep links* `tel:` / `mailto:` / `https:`.

## Ver também

- [[03-Casos-de-Uso]] — pacote *Monos e Partilha*
- [[02-Requisitos/M11-Frota-Equipas|Módulo 11 — Operador / terreno]]
- [[models/Reports, Recolhas, Comunicação e Operacional/init|Domínio Reports, Recolhas, Comunicação e Operacional]]
- [[07-Modelo-de-Dados]]
