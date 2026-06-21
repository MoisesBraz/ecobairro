# 05 · Diagrama de Classes

Vista **técnica** das classes do domínio: atributos tipados e métodos de serviço, alinhados com as tabelas PostgreSQL ([[07-Modelo-de-Dados]]) e os endpoints REST. Complementa o [[04-Modelo-de-Conceitos|modelo conceptual]] com a perspetiva de implementação (NestJS/TypeORM).

```mermaid
classDiagram
    direction LR

    class Utilizador {
        +UUID id
        +string email
        +string~null~ phone
        +Papel role
        +bool email_verified
        +Date~null~ eliminado_em
        +autenticar(credenciais) JWT
        +temPapel(p Papel) bool
    }
    class Papel {
        <<enumeration>>
        CIDADAO
        OPERADOR
        GESTOR
        ADMIN
    }
    class CidadaoPerfil {
        +UUID user_id
        +string~null~ nome_completo
        +bool gamificacao_optin
        +json preferencias_notif
    }
    class GestorPerfil {
        +UUID user_id
        +string entidade_empregadora
        +string~null~ cargo
        +UUID[] zonas_responsabilidade
    }
    class OperadorPerfil {
        +UUID user_id
        +string~null~ carta_conducao
        +UUID~null~ zona_base_id
        +bool disponivel
    }

    class Zona {
        +string nome
        +derivada por proximidade (50 m)
        +etiqueta em ecopontos.zona — sem tabela/CRUD
    }
    class Ecoponto {
        +UUID id
        +float lat
        +float lng
        +Tipologia tipologia
        +EstadoEcoponto estado
        +string zona (derivada por proximidade)
        +reportarProblema(report) Reporte
    }
    class DispositivoIoT {
        +UUID id
        +UUID ecoponto_id
        +Date ultima_leitura_em
        +ingerir(leitura) LeituraSensor
    }
    class Reporte {
        +UUID id
        +UUID cidadao_id
        +UUID~null~ ecoponto_id
        +UUID zona_id
        +Categoria categoria
        +EstadoReporte estado
        +UUID~null~ atribuido_a
        +mudarEstado(novo, gestor) ReporteTimeline
    }
    class PedidoRecolha {
        +UUID id
        +UUID cidadao_id
        +UUID~null~ operador_id
        +string tipo_material
        +EstadoPedido estado
        +atribuirOperador(op) void
    }

    class Carrinha {
        +UUID id
        +string matricula
        +TipoCarrinha tipo
        +int capacidade_kg
        +UUID zona_base_id
        +EstadoCarrinha estado
        +estaDisponivel() bool
    }
    class EquipaRota {
        +UUID id
        +UUID gestor_id
        +UUID carrinha_id
        +UUID[] operadores
        +UUID zona_id
        +UUID~null~ rota_id
        +EstadoEquipa estado
        +adicionarOperador(op) void
    }
    class RotaExecucao {
        +UUID id
        +UUID zona_id
        +UUID equipa_id
        +UUID[] ecopontos_planeados
        +UUID[] ecopontos_visitados
        +Geography~null~ geometria_rota
        +EstadoRota estado
        +Date~null~ iniciada_em
        +Date~null~ concluida_em
        +aceitar() void
        +iniciar() void
        +registarVisita(ecoponto) void
        +concluir() void
    }
    class AuditLog {
        +UUID id
        +UUID~null~ actor_id
        +string acao
        +json dados_anteriores
        +json dados_novos
        +Date timestamp
    }

    Utilizador "1" --> "0..1" CidadaoPerfil
    Utilizador "1" --> "0..1" GestorPerfil
    Utilizador "1" --> "0..1" OperadorPerfil
    Utilizador --> Papel : role

    Ecoponto "N" --> "1" Zona
    DispositivoIoT "0..1" --> "1" Ecoponto
    Reporte "N" --> "1" Ecoponto
    Reporte "N" --> "1" Zona
    PedidoRecolha "N" --> "0..1" OperadorPerfil : operador_id

    GestorPerfil "1" --> "N" EquipaRota : cria
    Carrinha "1" --> "N" EquipaRota : carrinha_id
    EquipaRota "1" --> "0..1" RotaExecucao : rota_id
    RotaExecucao "N" --> "1" Zona
    AuditLog "N" --> "0..1" Utilizador : actor_id
```

## Enumerações principais

| Enum | Valores |
|------|---------|
| `Papel` | `CIDADAO`, `OPERADOR`, `GESTOR`, `ADMIN` |
| `EstadoEcoponto` | `DISPONIVEL`, `CHEIO`, `SEM_SENSOR` |
| `EstadoReporte` | `RECEBIDO`, `EM_ANALISE`, `EM_RESOLUCAO`, `RESOLVIDO`, `REJEITADO` |
| `EstadoCarrinha` | `DISPONIVEL`, `EM_ROTA`, `MANUTENCAO` |
| `EstadoEquipa` | `PLANEADA`, `ATIVA`, `CONCLUIDA`, `CANCELADA` |
| `EstadoRota` | `ACEITE`, `EM_CURSO`, `CONCLUIDA`, `CANCELADA` |

## Ver também

- [[04-Modelo-de-Conceitos]] — vista conceptual
- [[07-Modelo-de-Dados]] — schemas SQL detalhados
- [[models/Reports, Recolhas, Comunicação e Operacional/rotas operacionais/Gestão de Frota e Equipas (Gestor)|Endpoints de frota e equipas]]
