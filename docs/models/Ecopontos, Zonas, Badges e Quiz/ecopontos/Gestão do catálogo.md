| #   | Método   | Rota                         | Descrição                                                                  | Auth                     | Fluxo                                                       |
| --- | -------- | ---------------------------- | -------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| E6  | `POST`   | `/ecopontos`                 | Criar ecoponto — **zona derivada por proximidade** (não vem no corpo)      | OPERADOR, GESTOR, ADMIN | NestJS → deriva `zona` (≤50 m) → PG write                   |
| E7  | `PUT`/`PATCH` | `/ecopontos/:id`        | Actualizar dados (nome, tipologias, acessibilidade, horário, localização)  | OPERADOR, GESTOR, ADMIN | NestJS → se `lat`/`lng` mudam, **recalcula `zona`** → PG write |
| E8  | —        | (mover ecoponto)             | Sem endpoint separado: `lat`/`lng` vão no `PATCH /ecopontos/:id` e a zona recalcula automaticamente | OPERADOR, GESTOR, ADMIN | NestJS → recalcula `zona` por **haversine (50 m)**, não `ST_Within` |
| E9  | `DELETE` | `/ecopontos/:id`             | Soft delete — só se sem reports abertos                                    | ADMIN                    | NestJS → verifica dependências → PG write eliminado_em      |
| E10 | `PATCH`  | `/ecopontos/:id/sensor`      | Associar/desassociar sensor IoT                                            | GESTOR, ADMIN | NestJS → PG write tem_sensor + device_id config             |

**Corpo de E6/E7 (criar/actualizar ecoponto):**

> O corpo **não inclui `zona`** — é derivada pelo backend a partir de `lat`/`lng`
> (herda a do vizinho mais próximo a ≤ 50 m; se isolado, usa a morada como nome da
> zona nova). Qualquer `zona` enviado pelo cliente é ignorado.
> Lógica: `apps/api/src/ecopontos/zona.helper.ts` (`resolveZona`, `ZONA_RAIO_METROS`).

```
{
  nome: string (required),
  descricao: string (optional),
  localizacao: { lat: float, lng: float } (required para E6),
  morada_textual: string (optional),
  tipologias: ("VIDRO"|"PAPEL"|"EMBALAGENS"|"ORGANICO"|"GERAL"|"OUTROS")[] (required),
  acessibilidade: {
    rampa: boolean,
    cobertura: boolean,
    iluminacao: boolean,
    piso_nivelado: boolean
  },
  horario: {
    seg: { abre: "HH:MM", fecha: "HH:MM" } | null,
    ter: ..., qua: ..., qui: ..., sex: ...,
    sab: { abre: "HH:MM", fecha: "HH:MM" } | null,
    dom: null
  } | null  (null = 24h sem restrição)
}
```