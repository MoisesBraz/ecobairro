import re

# 1. tests/ecopontos/ecopontos.service.test.ts
with open("apps/api/tests/ecopontos/ecopontos.service.test.ts", "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace("contentores: [{ ocupacao: 10 }]", "contentores: [{ tipo: 'Papel', ocupacao: 10 }]")
code = code.replace("contentores: [{ ocupacao: 55 }]", "contentores: [{ tipo: 'Papel', ocupacao: 55 }]")
code = code.replace("contentores: [{ ocupacao: 90 }]", "contentores: [{ tipo: 'Papel', ocupacao: 90 }]")

with open("apps/api/tests/ecopontos/ecopontos.service.test.ts", "w", encoding="utf-8") as f:
    f.write(code)


# 2. src/ecopontos/ecopontos.controller.ts
with open("apps/api/src/ecopontos/ecopontos.controller.ts", "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace("sensor_estado: body.sensor_estado,", "")
with open("apps/api/src/ecopontos/ecopontos.controller.ts", "w", encoding="utf-8") as f:
    f.write(code)

# 3. src/cidadaos/cidadaos.service.ts
with open("apps/api/src/cidadaos/cidadaos.service.ts", "r", encoding="utf-8") as f:
    code = f.read()

# Fix `findMany({ include: { ecoponto: true } })` mapping
# It maps `ecoponto` to something. We need to add `include: { ecoponto: { include: { contentores: true } } }`
old_include = "include: { ecoponto: true },"
new_include = "include: { ecoponto: { include: { contentores: true } } },"
code = code.replace(old_include, new_include)

old_map = """      ecopontos: favoritos.map((f) => ({
        id: f.ecoponto.id,
        nome: f.ecoponto.nome,
        distanciaLabel: f.ecoponto.distanciaLabel,
        ocupacao: f.ecoponto.ocupacao,
        lat: f.ecoponto.lat,
        lng: f.ecoponto.lng,
        mapTileUrl: f.ecoponto.mapTileUrl,
      })),"""
new_map = """      ecopontos: favoritos.map((f: any) => ({
        id: f.ecoponto.id,
        nome: f.ecoponto.nome,
        distanciaLabel: f.ecoponto.distanciaLabel,
        ocupacao: f.ecoponto.contentores && f.ecoponto.contentores.length > 0 ? Math.max(...f.ecoponto.contentores.map((c: any) => c.ocupacao)) : 0,
        lat: f.ecoponto.lat,
        lng: f.ecoponto.lng,
        mapTileUrl: f.ecoponto.mapTileUrl,
      })),"""
code = code.replace(old_map, new_map)

with open("apps/api/src/cidadaos/cidadaos.service.ts", "w", encoding="utf-8") as f:
    f.write(code)


# 4. src/home/home.service.ts
with open("apps/api/src/home/home.service.ts", "r", encoding="utf-8") as f:
    code = f.read()

old_home_include = """    const limit = 4;
    const proximosRows = await this.prisma.ecoponto.findMany({
      where: { ativo: true },"""
new_home_include = """    const limit = 4;
    const proximosRows = await this.prisma.ecoponto.findMany({
      where: { ativo: true },
      include: { contentores: true },"""
code = code.replace(old_home_include, new_home_include)

# Replace all f.ocupacao with f.contentores logic
# The easiest way is to compute maxOcupacao at the beginning of the loop
old_loop = """    for (const f of proximosRows) {
      const d = calcDist(lat, lng, f.lat, f.lng);
      proximos.push({
        id: f.id,
        nome: f.nome,
        distanciaLabel: formatDist(d),
        ocupacao: f.ocupacao,
        lat: f.lat,
        lng: f.lng,
        mapTileUrl: f.mapTileUrl,
        distMeters: d,
      });
    }"""
new_loop = """    for (const f of proximosRows as any[]) {
      const d = calcDist(lat, lng, f.lat, f.lng);
      const ocupacao = f.contentores && f.contentores.length > 0 ? Math.max(...f.contentores.map((c: any) => c.ocupacao)) : 0;
      proximos.push({
        id: f.id,
        nome: f.nome,
        distanciaLabel: formatDist(d),
        ocupacao,
        lat: f.lat,
        lng: f.lng,
        mapTileUrl: f.mapTileUrl,
        distMeters: d,
      });
    }"""
code = code.replace(old_loop, new_loop)

# There is another `f.ocupacao` check:
old_filter = "    const empty = proximos.filter((e) => e.ocupacao < 50);"
new_filter = "    const empty = proximos.filter((e) => e.ocupacao < 50);"
code = code.replace(old_filter, new_filter)

with open("apps/api/src/home/home.service.ts", "w", encoding="utf-8") as f:
    f.write(code)
