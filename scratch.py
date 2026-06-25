import re

with open("apps/api/tests/ecopontos/ecopontos.service.test.ts", "r", encoding="utf-8") as f:
    code = f.read()

# Replace FakeEcopontoRow
old_fake_row = """interface FakeEcopontoRow {
  id: string;
  nome: string;
  codigo: string | null;
  morada: string;
  zona: string | null;
  distanciaLabel: string;
  ocupacao: number;
  tipos: unknown;
  sensorEstado: string;
  ultimaRecolha: string | null;
  ultimaAtualizacao: string | null;
  lat: number;
  lng: number;
  bateria: number | null;
  temperatura: number | null;
  ativo: boolean;
  ordem: number;
}"""
new_fake_row = """interface FakeEcopontoRow {
  id: string;
  nome: string;
  codigo: string | null;
  morada: string;
  zona: string | null;
  distanciaLabel: string;
  contentores: any[];
  ultimaAtualizacao: string | null;
  lat: number;
  lng: number;
  temperatura: number | null;
  ativo: boolean;
  ordem: number;
}"""
code = code.replace(old_fake_row, new_fake_row)

# Replace applyWhere
old_applyWhere = """  private applyWhere(where?: {
    ativo?: boolean;
    ocupacao?: { gte?: number; lt?: number };
  }): FakeEcopontoRow[] {
    let rows = [...this.store];
    if (where?.ativo === true) rows = rows.filter((r) => r.ativo);
    if (where?.ocupacao) {
      const { gte, lt } = where.ocupacao;
      rows = rows.filter(
        (r) =>
          (gte === undefined || r.ocupacao >= gte) &&
          (lt === undefined || r.ocupacao < lt),
      );
    }
    return rows;
  }"""
new_applyWhere = """  private applyWhere(where?: any): FakeEcopontoRow[] {
    let rows = [...this.store];
    if (where?.ativo === true) rows = rows.filter((r) => r.ativo);
    
    if (where?.contentores?.some?.ocupacao) {
      const op = where.contentores.some.ocupacao;
      rows = rows.filter(r => r.contentores.some((c: any) => 
        (op.gte === undefined || c.ocupacao >= op.gte) && 
        (op.lt === undefined || c.ocupacao < op.lt)
      ));
    }
    if (where?.contentores?.none?.ocupacao) {
      const op = where.contentores.none.ocupacao;
      rows = rows.filter(r => !r.contentores.some((c: any) => 
        (op.gte === undefined || c.ocupacao >= op.gte) && 
        (op.lt === undefined || c.ocupacao < op.lt)
      ));
    }
    
    return rows;
  }"""
code = code.replace(old_applyWhere, new_applyWhere)

# Replace args.data in create
old_create_args = """    create: async (args: {
      data: {
        nome: string;
        codigo: string | null;
        morada: string;
        zona: string | null;
        ocupacao: number;
        tipos: unknown;
        sensorEstado: string;
        ultimaRecolha: string | null;
        lat: number;
        lng: number;
        ordem: number;
      };
    }) => {"""
new_create_args = """    create: async (args: {
      data: any;
    }) => {"""
code = code.replace(old_create_args, new_create_args)

old_row_create = """      const row: FakeEcopontoRow = {
        id: `eco-${this.nextId++}`,
        nome: args.data.nome,
        codigo: args.data.codigo,
        morada: args.data.morada,
        zona: args.data.zona,
        distanciaLabel: '',
        ocupacao: args.data.ocupacao,
        tipos: args.data.tipos,
        sensorEstado: args.data.sensorEstado,
        ultimaRecolha: args.data.ultimaRecolha,
        ultimaAtualizacao: null,
        lat: args.data.lat,
        lng: args.data.lng,
        bateria: null,
        temperatura: null,
        ativo: true,
        ordem: args.data.ordem,
      };"""
new_row_create = """      const row: FakeEcopontoRow = {
        id: `eco-${this.nextId++}`,
        nome: args.data.nome,
        codigo: args.data.codigo,
        morada: args.data.morada,
        zona: args.data.zona,
        distanciaLabel: '',
        contentores: args.data.contentores?.create || [],
        ultimaAtualizacao: null,
        lat: args.data.lat,
        lng: args.data.lng,
        temperatura: args.data.temperatura,
        ativo: true,
        ordem: args.data.ordem,
      };"""
code = code.replace(old_row_create, new_row_create)

# Replace baseRow
old_baseRow = """function baseRow(overrides: Partial<FakeEcopontoRow> = {}): FakeEcopontoRow {
  return {
    id: overrides.id ?? 'eco-1',
    nome: overrides.nome ?? 'Teste',
    codigo: overrides.codigo ?? 'EP-99',
    morada: overrides.morada ?? 'Rua A',
    zona: overrides.zona ?? 'Centro',
    distanciaLabel: '',
    ocupacao: overrides.ocupacao ?? 30,
    tipos: overrides.tipos ?? ['Papel'],
    sensorEstado: overrides.sensorEstado ?? 'online',
    ultimaRecolha: null,
    ultimaAtualizacao: null,
    lat: 40.64,
    lng: -8.65,
    bateria: overrides.bateria ?? 80,
    temperatura: overrides.temperatura ?? 14,
    ativo: overrides.ativo ?? true,
    ordem: overrides.ordem ?? 0,
  };
}"""
new_baseRow = """function baseRow(overrides: any = {}): FakeEcopontoRow {
  return {
    id: overrides.id ?? 'eco-1',
    nome: overrides.nome ?? 'Teste',
    codigo: overrides.codigo ?? 'EP-99',
    morada: overrides.morada ?? 'Rua A',
    zona: overrides.zona ?? 'Centro',
    distanciaLabel: '',
    contentores: overrides.contentores ?? [{ ocupacao: overrides.ocupacao ?? 30 }],
    ultimaAtualizacao: null,
    lat: 40.64,
    lng: -8.65,
    temperatura: overrides.temperatura ?? 14,
    ativo: overrides.ativo ?? true,
    ordem: overrides.ordem ?? 0,
  };
}"""
code = code.replace(old_baseRow, new_baseRow)

# Replace new FakePrismaEcopontos usages inside tests
code = code.replace("ocupacao: 10", "contentores: [{ ocupacao: 10 }]")
code = code.replace("ocupacao: 55", "contentores: [{ ocupacao: 55 }]")
code = code.replace("ocupacao: 90", "contentores: [{ ocupacao: 90 }]")
code = code.replace("tipos: ['Vidro'],", "")
code = code.replace("assert.equal(row.sensor_estado, 'online');", "")

with open("apps/api/tests/ecopontos/ecopontos.service.test.ts", "w", encoding="utf-8") as f:
    f.write(code)
