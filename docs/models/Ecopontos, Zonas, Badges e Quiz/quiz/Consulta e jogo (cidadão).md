| #   | Método | Rota                               | Descrição                                                         | Auth             | Fluxo                                                                                         |
| --- | ------ | ---------------------------------- | ----------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| Q1  | `GET`  | `/quiz/disponivel`                 | Quiz actualmente disponível — semanal e/ou diário `?tipo=SEMANAL` | CIDADAO (opt-in) | NestJS → Redis `quiz:atual:SEMANAL` ou PG                                                     |
| Q2  | `GET`  | `/quiz/:id`                        | Detalhe do quiz: perguntas e opções (SEM indicar qual é correcta) | CIDADAO (opt-in) | NestJS → Redis `quiz:{id}:perguntas` ou PG                                                    |
| Q3  | `POST` | `/quiz/:id/iniciar`                | Criar sessão de jogo — devolve `sessao_id` com TTL                | CIDADAO (opt-in) | NestJS → verifica quota diária/semanal → Redis `quiz:sessao:{sessao_id}` TTL 30min            |
| Q4  | `POST` | `/quiz/sessao/:sessaoId/responder` | Submeter todas as respostas de uma sessão                         | CIDADAO (opt-in) | NestJS → valida sessão Redis → INSERT quiz_sessoes PG → calcula score → BullMQ badge.evaluate |
| Q5  | `GET`  | `/quiz/sessao/:sessaoId/resultado` | Resultado com respostas correctas e explicações educativas        | CIDADAO (opt-in) | NestJS → PG réplica quiz_sessoes JOIN opcoes                                                  |
| Q6  | `GET`  | `/cidadaos/me/quiz/historico`      | Histórico de sessões do cidadão paginado                          | CIDADAO (opt-in) | NestJS → PG réplica `quiz_sessoes` paginado                                                   |
**Corpo de Q3 (iniciar sessão):**

O endpoint não recebe body — apenas verifica se o cidadão pode jogar:

```
Verificações antes de criar sessão:
  1. gamificacao_ativo = true (opt-in activo)
  2. Quiz ainda disponível: now() BETWEEN disponivel_de AND disponivel_ate
  3. Cidadão não jogou este quiz já (SELECT FROM quiz_sessoes WHERE cidadao_id AND quiz_id)
  4. Quota diária: para DIARIO, max 1 sessão por quiz por dia

Resposta:
{
  sessao_id: uuid,
  quiz_id: uuid,
  expira_em: ISO8601 (now() + 30 min),
  numero_perguntas: integer
}
```

**Corpo de Q4 (submeter respostas):**

```
{
  respostas: [
    { pergunta_id: uuid, opcao_id: uuid },
    { pergunta_id: uuid, opcao_id: uuid },
    ...
  ]
}
```

A validação acontece no NestJS: compara cada `opcao_id` com o índice parcial `WHERE correta=true` em `quiz_opcoes`. O score é calculado na camada de aplicação — nunca devolvido antes de todas as respostas serem submetidas.

**Resposta de Q5 (resultado):**

```
{
  score_obtido: integer,
  score_maximo: integer,
  percentagem: float,
  perguntas: [
    {
      pergunta_id: uuid,
      texto_pergunta: string,
      opcao_escolhida: uuid,
      opcao_correta: uuid,
      acertou: boolean,
      pontos_obtidos: integer,
      explicacao_educativa: string  ← sempre mostrada (RF-19)
    }
  ],
  badges_ganhos: Badge[]  ← lista de badges atribuídos nesta sessão
}
```