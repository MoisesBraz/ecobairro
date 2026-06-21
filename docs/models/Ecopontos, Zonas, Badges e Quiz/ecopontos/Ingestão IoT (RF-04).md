| #   | Método | Rota                | Descrição                                         | Auth                     | Fluxo                                                                                                    |
| --- | ------ | ------------------- | ------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| E11 | `POST` | `/iot/telemetria`   | Ingerir leitura de sensor (alta frequência)       | API Key (sensor)         | NestJS → valida device_id → INSERT sensor_leituras + UPSERT estado_atual → NOTIFY → BullMQ threshold job |
| E12 | `GET`  | `/iot/dispositivos` | Listar dispositivos registados e último heartbeat | GESTOR, ADMIN | NestJS → PG réplica                                                                                      |
| E13 | `POST` | `/iot/dispositivos` | Registar novo dispositivo IoT                     | ADMIN                    | NestJS → PG write                                                                                        |
**Corpo de E11 (leitura IoT):**

```
{
  device_id: string (required),
  ecoponto_id: uuid (required — rejeita se ausente, RF-04),
  nivel_enchimento: integer 0-100 (optional),
  estado_reportado: "CHEIO" | "DISPONIVEL" | "AVARIADO" (optional),
  timestamp_leitura: ISO8601 (required),
  metadata: {
    battery_pct: integer,
    signal_rssi: integer,
    firmware: string
  } (optional)
}
```

**Nota de performance E11:** Este endpoint é o de maior volume do sistema (10.000 msg/min, RNF-ESC-01). O NestJS deve processar o INSERT em `sensor_leituras` de forma assíncrona — o response ao sensor é imediato (202 Accepted), e a escrita real vai para uma fila BullMQ de ingestão. Isto desacopla a latência de escrita do throughput do sensor.