# 04 · Modelo de Conceitos

Modelo conceptual do domínio EcoBairro Digital: as entidades de negócio e as suas relações, independentes da implementação. Migrado do antigo `uml_modelo_conceitos.puml` e **retificado** com a separação `Gestor`/`Operador`, a **`Carrinha`** (frota) e a **`EquipaRota`**.

```mermaid
classDiagram
    direction LR

    class Utilizador {
        +email
        +papel : CIDADAO|OPERADOR|GESTOR|ADMIN
        +autenticação (JWT)
    }
    class CidadaoPerfil {
        +preferências
        +notificações
        +gamificação (opt-in)
    }
    class GestorPerfil {
        +entidade empregadora
        +cargo
        +zonas de responsabilidade
    }
    class OperadorPerfil {
        +carta de condução
        +zona-base
        +disponível
    }

    class Zona {
        +nome (= morada do 1.º ecoponto)
        +derivada por proximidade (50 m)
        +sem geometria / sem gestão manual
    }
    class Ecoponto {
        +localização (GPS)
        +tipologia
        +estado (cheio/disponível/sem sensor)
        +acessibilidade
    }
    class DispositivoIoT {
        +identificador
        +ecoponto associado
        +última leitura
    }
    class LeituraSensor {
        +timestamp
        +nível de enchimento (%)
        +origem
    }

    class Reporte {
        +localização georreferenciada
        +categoria
        +descrição
        +fotografia (opcional)
        +estado (Recebido→Resolvido)
    }
    class ReporteTimeline {
        +estado anterior → novo
        +responsável
        +timestamp
    }

    class PedidoRecolha {
        +morada
        +tipo de material
        +volume estimado
        +número de processo
    }
    class PartilhaMateriais {
        +tipo de material
        +localização aproximada
        +contacto anónimo
    }

    class Notificacao {
        +canal (push/email/SMS)
        +tema
        +timestamp
    }
    class MensagemInstitucional {
        +título
        +conteúdo
        +segmentação (zona/freguesia)
    }

    class Badge {
        +nome
        +critério de atribuição
    }
    class Quiz {
        +pergunta semanal
        +resposta correta
        +ranking anónimo por zona
    }

    class Carrinha {
        +matrícula
        +tipo (ligeira/pesada)
        +capacidade (kg)
        +zona-base
        +estado (disponível/em rota/manutenção)
    }
    class EquipaRota {
        +zona
        +ecopontos planeados
        +estado
        +criada pelo gestor
    }
    class RotaExecucao {
        +trajeto realizado
        +ecopontos visitados
        +início/fim
        +estado
    }
    class AuditLog {
        +ação
        +utilizador
        +timestamp
        +dados anteriores/novos
    }

    %% ── Identidade ──
    Utilizador "1" --> "0..1" CidadaoPerfil : tem
    Utilizador "1" --> "0..1" GestorPerfil : tem
    Utilizador "1" --> "0..1" OperadorPerfil : tem

    %% ── Território / IoT ──
    Ecoponto "N" --> "1" Zona : pertence a
    DispositivoIoT "0..1" --> "1" Ecoponto : monitoriza
    DispositivoIoT "1" --> "N" LeituraSensor : gera

    %% ── Participação cívica ──
    Reporte "N" --> "1" Ecoponto : refere-se a
    Reporte "N" --> "1" CidadaoPerfil : submetido por
    Reporte "1" --> "N" ReporteTimeline : tem histórico
    Reporte "N" --> "1" Zona : encaminhado por zona

    %% ── Monos e partilha ──
    PedidoRecolha "N" --> "1" CidadaoPerfil : submetido por
    PedidoRecolha "N" --> "0..1" OperadorPerfil : recolhido por
    PartilhaMateriais "N" --> "1" CidadaoPerfil : publicado por

    %% ── Comunicação ──
    Notificacao "N" --> "1" Utilizador : enviada a
    MensagemInstitucional "N" --> "1" Zona : segmentada por
    MensagemInstitucional "N" --> "1" GestorPerfil : publicada por

    %% ── Gamificação ──
    CidadaoPerfil "N" --> "N" Ecoponto : favoritos
    CidadaoPerfil "N" --> "N" Badge : conquista
    CidadaoPerfil "N" --> "N" Quiz : participa

    %% ── Operacional: frota, equipas e rotas ──
    GestorPerfil "N" --> "N" Zona : responsável por
    GestorPerfil "1" --> "N" EquipaRota : cria
    Carrinha "1" --> "N" EquipaRota : atribuída a
    EquipaRota "N" --> "N" OperadorPerfil : composta por
    EquipaRota "1" --> "1" RotaExecucao : executa
    RotaExecucao "N" --> "1" Zona : na zona
```

## Notas de domínio

- **Zona derivada (novo)** — a `Zona` deixou de ser gerida à mão. É uma etiqueta
  derivada automaticamente: um `Ecoponto` novo herda a zona de um vizinho a ≤ 50 m; se
  isolado, forma zona nova com o nome da sua morada. Não tem polígono nem CRUD; as
  relações `--> Zona` representam agrupamento pela etiqueta, não FK para uma tabela.
- **Anti-spam** — uma `Zona` limita a **2 reportes por utilizador / 24 h** (RF-09).
- **Estado cacheado** — as `LeituraSensor` são processadas e o estado atual é cacheado para carregamento <2 s no mapa (RNF-PERF-01).
- **Frota e equipas (novo)** — o `GestorPerfil` cria uma `EquipaRota` associando `OperadorPerfil`(es) + uma `Carrinha` + uma `Zona`; a `RotaExecucao` está ligada à equipa, não diretamente a um utilizador. O `OperadorPerfil` executa fisicamente.
- **Recolha de monos** — o `PedidoRecolha` do cidadão é executado em terreno por um `OperadorPerfil` (RF-14).
- **Auditoria** — o `AuditLog` regista operações sensíveis (reports, rotas, frota, equipas) com retenção ≥ 24 meses (RNF-SEG-03).

## Ver também

- [[05-Diagrama-de-Classes]] — versão técnica com tipos e métodos
- [[07-Modelo-de-Dados]] — tabelas físicas correspondentes
- [[03-Casos-de-Uso]]
