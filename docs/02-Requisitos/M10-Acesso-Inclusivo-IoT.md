# Módulo 10 — Acesso inclusivo e envelhecidas (IoT)

> Parte de [[02-Requisitos]] · [[Home]]. Cobre RF-26 a RF-27. Convenção de prioridade: **Alta (A) / Média (M) / Baixa (B) / Futuro (F)**.

Garante **equidade de serviço** em zonas com população envelhecida e baixa penetração de smartphones (<30–35%): o estado dos ecopontos é assegurado por **IoT** (não depende do reporte do cidadão) e os alertas críticos chegam por **SMS** a líderes locais e associações, sem necessidade de app.

## Atores envolvidos

| Ator | Papel neste módulo |
|------|--------------------|
| 📡 **Sensor IoT** | Assegura o estado em zonas marcadas como prioritárias. |
| 🧑‍💼 **Gestor** | Marca zonas prioritárias e gere a lista de contactos SMS. |
| 📱 **Líder local / associação** | Recebe alertas SMS opt-in (sem app). |

## Requisitos

| RF | Prio. | Descrição | Critérios de aceitação |
|----|:----:|-----------|------------------------|
| **RF-26** | A | **Cobertura por sensores** em áreas com <30–35% de smartphones. Estados "cheio/disponível" assegurados por IoT, garantindo equidade. | Zonas marcadas como **"prioritárias IoT"** no backoffice. |
| **RF-27** | M | **Alertas automáticos sem app.** Aviso por **SMS** a líderes locais/associações quando ecopontos críticos atingem limiar. | Lista de contactos **opt-in por zona**. |

## Fluxograma — cobertura IoT e alerta SMS

```mermaid
flowchart TB
    IOT(["📡 Sensor IoT"])
    G(["🧑‍💼 Gestor"])
    LL(["📱 Líder local / associação"])

    subgraph ZONA["Zonas prioritárias (RF-26)"]
        MARK["Gestor marca zona 'prioritária IoT'"]
    end

    subgraph PIPE["Pipeline IoT"]
        W["Worker iot.threshold-check"]
        LIM{"nível ≥ limiar<br/>e zona prioritária?"}
    end

    subgraph SMS["Alerta SMS (RF-27)"]
        DISP["Worker notification.dispatch"]
        OPT["contactos opt-in da zona"]
    end

    PGP[("PG Primário<br/>iot_contactos_sms · estado_atual")]

    G --> MARK --> PGP
    IOT -->|telemetria| W --> LIM
    LIM -->|sim| DISP --> OPT --> LL
    LIM -->|não| OK["atualiza estado (mapa)"]
    DISP --> PGP

    classDef svc fill:#388E3C,color:#fff,stroke:#1B5E20;
    classDef store fill:#1B5E20,color:#fff,stroke:#1B5E20;
    classDef cli fill:#C8E6C9,color:#000,stroke:#388E3C;
    class W,DISP svc;
    class PGP store;
    class IOT,G,LL cli;
```

## Fluxo crítico — alerta SMS por limiar (RF-27)

```mermaid
sequenceDiagram
    autonumber
    participant S as Sensor IoT
    participant W as Worker (threshold-check)
    participant PG as PG (iot_alertas · contactos)
    participant SMS as Gateway SMS
    actor LL as Líderes locais (opt-in)

    S->>W: leitura → nível ≥ limiar_cheio
    W->>PG: zona é prioritária IoT? + alerta aberto?
    alt sem alerta aberto e zona crítica
        W->>PG: INSERT iot_alertas (ECOPONTO_CHEIO)
        W->>PG: SELECT contactos opt-in da zona (RF-27)
        W->>SMS: enviar SMS a cada contacto
        SMS-->>LL: "Ecoponto X cheio na zona Y"
    end
```

## Regras de negócio

- **Equidade por IoT (RF-26)** — em zonas prioritárias, o estado **não** depende de reportes do cidadão; a marcação "prioritária IoT" é feita pelo Gestor no backoffice ([[02-Requisitos/M02-IoT-Operacoes|Módulo 2]]).
- **SMS opt-in (RF-27)** — só recebem SMS os contactos que deram consentimento, registados em `iot_contactos_sms` por zona. SMS reservado a alertas críticos (evita custo/ruído).
- **Escalonamento** — se o offline persistir além de 2× o timeout, o SMS é reforçado aos contactos da zona (ver offline-detector em [[models/IoT e Dispositivos/Init|Domínio IoT]]).
- **Canal partilhado** — o envio reutiliza o `notification.dispatch` do [[02-Requisitos/M05-Comunicacao|Módulo 5]].

## Ver também

- [[03-Casos-de-Uso]] — pacote *IoT / Telemetria*
- [[02-Requisitos/M02-IoT-Operacoes|Módulo 2]] · [[02-Requisitos/M05-Comunicacao|Módulo 5]]
- [[models/IoT e Dispositivos/Init|Domínio IoT — contactos SMS e offline-detector]]
- [[01-Introducao#Glossário de papéis]]
