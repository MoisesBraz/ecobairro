import re

with open("apps/web/src/routes/_layoutmain.ecopontos.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update schema
code = code.replace("""const ecopontoSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  codigo: z.string().optional(),
  morada: z.string().min(3, 'Morada obrigatória'),
  ocupacao: z.number().min(0).max(100),
  lat: z.number(),
  lng: z.number(),
})""", """const ecopontoSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  codigo: z.string().optional(),
  morada: z.string().min(3, 'Morada obrigatória'),
  contentores: z.array(z.object({
    tipo: z.string().min(1, 'Tipo obrigatório'),
    ocupacao: z.number().min(0).max(100),
  })),
  lat: z.number(),
  lng: z.number(),
})""")

# 2. Update import useFieldArray
if "useFieldArray" not in code:
    code = code.replace("useForm", "useForm, useFieldArray")

# 3. Update useForm hook and useFieldArray initialization
old_use_form = """  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EcopontoForm>({
    resolver: zodResolver(ecopontoSchema),
  })"""
new_use_form = """  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EcopontoForm>({
    resolver: zodResolver(ecopontoSchema),
  })
  const { fields, append, remove } = useFieldArray({
    control,
    name: "contentores"
  })"""
code = code.replace(old_use_form, new_use_form)

# 4. Update abrirNovo
old_abrir_novo = """    reset({ nome: '', codigo: '', morada: '', ocupacao: 0, lat: AVEIRO_CENTER.lat, lng: AVEIRO_CENTER.lng })"""
new_abrir_novo = """    reset({ nome: '', codigo: '', morada: '', contentores: [{ tipo: 'Papel', ocupacao: 0 }], lat: AVEIRO_CENTER.lat, lng: AVEIRO_CENTER.lng })"""
code = code.replace(old_abrir_novo, new_abrir_novo)

# 5. Update abrirEditar
old_abrir_editar = """      morada: ep.morada,
      ocupacao: ep.ocupacao,
      lat: ep.lat,"""
new_abrir_editar = """      morada: ep.morada,
      contentores: ep.contentores.map(c => ({ tipo: c.tipo, ocupacao: c.ocupacao })),
      lat: ep.lat,"""
code = code.replace(old_abrir_editar, new_abrir_editar)

# 6. Update onSubmit mapping
old_body_update = """          morada: data.morada,
          ocupacao: data.ocupacao,
          ...(coordsChanged ? { lat: data.lat, lng: data.lng } : {}),"""
new_body_update = """          morada: data.morada,
          contentores: data.contentores,
          ...(coordsChanged ? { lat: data.lat, lng: data.lng } : {}),"""
code = code.replace(old_body_update, new_body_update)

old_body_create = """          morada: data.morada,
          ocupacao: data.ocupacao,
          lat: data.lat,"""
new_body_create = """          morada: data.morada,
          contentores: data.contentores,
          lat: data.lat,"""
code = code.replace(old_body_create, new_body_create)

# 7. Update table row rendering
old_td_enchimento_sensor = """                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${ep.ocupacao}%`, backgroundColor: cfg.color }} />
                        </div>
                        <span className="text-[10px] font-medium" style={{ color: cfg.color }}>{ep.ocupacao}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1 text-[10px] font-medium w-fit px-2 py-0.5 rounded-full ${ep.sensor_estado === 'online' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-muted-foreground bg-muted'}`}>
                        {ep.sensor_estado === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {ep.sensor_estado === 'online' ? 'Online' : 'Offline'}
                      </div>
                    </td>"""

# Let's map over ep.contentores to display their ocupacao instead. And display their sensor status.
new_td_enchimento_sensor = """                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 min-w-[100px]">
                        {ep.contentores?.map(c => (
                          <div key={c.id} className="flex items-center gap-2 text-[10px]">
                            <span className="font-semibold w-12">{c.tipo}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${c.ocupacao}%` }} />
                            </div>
                            <span>{c.ocupacao}%</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-[10px] font-medium">
                        {ep.contentores?.map(c => (
                           <div key={c.id} className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full ${c.sensorEstado === 'online' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-muted-foreground bg-muted'}`}>
                             {c.sensorEstado === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                             {c.sensorEstado === 'online' ? 'Online' : 'Offline'}
                           </div>
                        ))}
                      </div>
                    </td>"""
code = code.replace(old_td_enchimento_sensor, new_td_enchimento_sensor)

# 8. Update form HTML
old_form_ocupacao = """                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Ocupação (%)</label>
                  <input type="number" min={0} max={100} {...register('ocupacao', { valueAsNumber: true })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30" />
                </div>"""

new_form_contentores = """                <div className="col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-muted-foreground block">Contentores</label>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ tipo: 'Papel', ocupacao: 0 })} className="h-6 px-2 text-[10px]">
                      + Adicionar
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-center border border-border p-2 rounded-xl">
                        <select {...register(`contentores.${index}.tipo`)} className="w-1/2 px-2 py-1 text-sm rounded border border-border bg-background text-foreground">
                          <option value="Papel">Papel / Azul</option>
                          <option value="Plastico">Plástico / Amarelo</option>
                          <option value="Vidro">Vidro / Verde</option>
                          <option value="Indiferenciado">Indiferenciado / Preto</option>
                        </select>
                        <input type="number" min={0} max={100} {...register(`contentores.${index}.ocupacao`, { valueAsNumber: true })} placeholder="%" className="w-1/3 px-2 py-1 text-sm rounded border border-border bg-background text-foreground" />
                        <button type="button" onClick={() => remove(index)} className="text-destructive hover:text-destructive/80 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>"""
code = code.replace(old_form_ocupacao, new_form_contentores)

with open("apps/web/src/routes/_layoutmain.ecopontos.tsx", "w", encoding="utf-8") as f:
    f.write(code)
