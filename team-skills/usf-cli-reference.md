# USF CLI — Referência de Comandos

**Universal Skills Framework** — escrever skills uma vez, sincronizar para todos os tools de IA.

Instalar: `pip install usf-skills`

---

## `skill list [path]`

Lista todas as skills numa pasta com nome, descrição e tags.

```bash
skill list skills/
```

Útil para ter uma visão geral do que está disponível no vault.

---

## `skill show <name>`

Mostra o frontmatter e todas as secções de uma skill.

```bash
skill show code-reviewer --path skills/
```

Útil para inspecionar uma skill antes de a correr ou exportar.

---

## `skill validate [path]`

Valida skills contra o schema USF — frontmatter, secções obrigatórias, variáveis de template.

```bash
skill validate skills/
skill validate skills/code-reviewer.md
```

Usar em CI para garantir que nenhuma skill está partida.

---

## `skill render <name> --provider X`

Gera o payload que seria enviado ao provider, **sem fazer chamada à API**.

```bash
skill render code-reviewer --provider anthropic --input code=@app.py --path skills/
```

Providers: `openai`, `anthropic`, `gemini`, `ollama`. Útil para depurar o prompt antes de gastar tokens.

---

## `skill run <name> --provider X`

Corre a skill contra o LLM e imprime o resultado.

```bash
skill run code-reviewer --provider anthropic --input code=@app.py
skill run code-reviewer --provider ollama --input code=@app.py    # offline, sem key
skill run code-reviewer --provider anthropic --dry-run            # igual ao render
skill run code-reviewer --provider openai --stream                # streaming
```

Requer variável de ambiente com a API key: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.

---

## `skill diff <name> --provider X --provider Y`

Compara os payloads de dois providers lado a lado (verde = adições, vermelho = remoções).

```bash
skill diff code-reviewer --provider openai --provider anthropic --input code=x
```

Útil para perceber como o formato do prompt muda entre providers.

---

## `skill export <name> --format FORMAT`

Exporta uma skill para o formato de um tool específico.

```bash
skill export code-reviewer --format claude       # .claude/skills/
skill export code-reviewer --format cursor       # .cursor/rules/
skill export code-reviewer --format windsurf     # .windsurf/rules/
skill export code-reviewer --format roo          # .roo/rules[-<modo>]/
skill export code-reviewer --format trae         # .trae/rules/
skill export code-reviewer --format opencode     # .opencode/
skill export code-reviewer --format antigravity  # .gemini/antigravity/skills/
skill export code-reviewer --all                 # todos os formatos de uma vez
```

Usar `--out <dir>` para escrever numa pasta específica em vez do path global.

---

## `skill init`

Cria o `.usf.json` na pasta do projecto e faz o sync inicial.

```bash
cd meu-projecto
skill init
```

Pergunta o caminho da pasta `skills/` (memorizado em `~/.usf.json` após a primeira vez) e que formatos activar. Fazer commit do `.usf.json` para que a equipa tenha a mesma configuração.

---

## `skill sync`

Re-exporta todas as skills para todos os tools configurados no `.usf.json`.

```bash
skill sync                   # tools do projecto (cursor, vscode, windsurf…)
skill sync --global          # inclui claude, antigravity, verdent nos paths de ~/ 
skill sync --team            # actualiza a partir do repositório git da equipa
skill sync --project <dir>   # usa o .usf.json de outra pasta
```

Correr sempre após editar uma skill para manter todos os tools actualizados.

---

## Formats suportados (9 no total)

| Format | Ficheiro gerado |
|---|---|
| `claude` | `.claude/skills/<name>/SKILL.md` |
| `antigravity` | `.gemini/antigravity/skills/<name>/SKILL.md` |
| `verdent` | `.claude/skills/<name>/SKILL.md` |
| `cursor` | `.cursor/rules/<name>.mdc` |
| `windsurf` | `.windsurf/rules/<name>.md` |
| `roo` | `.roo/rules[-<modo>]/<name>.md` |
| `trae` | `.trae/rules/<name>.md` |
| `opencode` | `.opencode/<name>.md` |
