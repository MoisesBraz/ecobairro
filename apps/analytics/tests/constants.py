from __future__ import annotations

# Segredo HS256 usado nos testes — partilhado entre conftest e os testes de proximidade.
JWT_SECRET = "test-secret-analytics"

# Ponto de pesquisa em Aveiro, (lat, lng). `geom` é gerada de (lng, lat) como na migração.
CENTER = (40.6405, -8.6538)

# (nome, lat, lng, ativo) — distâncias aproximadas ao CENTER:
#   Perto    ~200 m   (dentro de 1000 m)
#   Medio    ~500 m   (dentro de 1000 m)
#   Inativo  ~55 m mas ativo=false  → excluído pelo filtro ativo
#   Longe    ~57 km   (fora de 1000 m)
# (nome, lat, lng, ativo, ocupacao, zona, sensor_estado)
SEED = [
    ("Perto", 40.6423, -8.6538, True, 90, "Centro", "alerta"),
    ("Medio", 40.6450, -8.6538, True, 40, "Centro", "online"),
    ("Inativo", 40.6410, -8.6538, False, 100, "Centro", "offline"),
    ("Longe", 41.1500, -8.6100, True, 60, "Norte", "online"),
]

# Reports geo (R2/R8/R12) — (titulo, tipo, status, lat, lng, idade_dias, horas_resolucao).
# horas_resolucao = atualizado_em - criado_em (só relevante para RESOLVIDO).
# Distâncias ao CENTER: dup ~44 m, resolvido ~55 m, antigo ~66 m, outro_tipo ~77 m,
# perto ~200 m, analise ~500 m, longe ~57 km.
REPORTS_SEED = [
    ("dup",          "Ecoponto Cheio",   "PENDENTE",  40.6409, -8.6538, 0, 0),
    ("perto",        "Ecoponto Cheio",   "PENDENTE",  40.6423, -8.6538, 0, 0),
    ("analise",      "Ecoponto Cheio",   "ANALISE",   40.6450, -8.6538, 0, 0),
    ("resolvido",    "Ecoponto Cheio",   "RESOLVIDO", 40.6410, -8.6538, 0, 5),
    ("resolvido2",   "Ecoponto Cheio",   "RESOLVIDO", 40.6412, -8.6538, 1, 15),
    ("outro_tipo",   "Deposição Ilegal", "PENDENTE",  40.6412, -8.6538, 0, 0),
    ("antigo",       "Ecoponto Cheio",   "PENDENTE",  40.6411, -8.6538, 10, 0),
    ("longe",        "Ecoponto Cheio",   "PENDENTE",  41.1500, -8.6100, 0, 0),
]
