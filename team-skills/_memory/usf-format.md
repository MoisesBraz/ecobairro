---
usf: false
name: usf-format
description: Complete reference of the USF format to create and update skills.
---

# USF Skill Format

A USF skill is a markdown file with YAML frontmatter. Each skill lives in `skills/<name>.md`.

## File structure

```
---
name: <kebab-case-no-spaces>
description: <a clear sentence of what the skill does>
version: 1.0.0
tags: [tag1, tag2]
recommended_temperature: 0.2
max_tokens: 2048
model_hints:
  openai: gpt-4o
  anthropic: claude-sonnet-4-6
  gemini: gemini-1.5-pro
  ollama: llama3.1:8b
inputs:
  - name: <input-name>
    type: string
    required: true
    description: <description of what this input represents>
  - name: <optional-input>
    type: string
    required: false
    default: <default-value>
    description: <description>
---

# Role
<Who the LLM is — persona, expertise, tone>

# Task
<What to do exactly. Use {{variable}} to interpolate inputs.>

# Context
<Assumptions, domain notes, references. Use [[note-name]] to inject vault memory.>

# Constraints
- DO <do X>
- DO NOT <do Y>

# Output Format
<Exact structure of the response — headers, lists, format, language>
```

## Rules

- `name` in kebab-case, same as the filename without `.md`
- The 5 sections (Role, Task, Context, Constraints, Output Format) are mandatory
- Inputs used in the body with `{{name}}` must be declared in the frontmatter
- `[[note]]` resolves to the content of `_memory/note.md` at runtime
- `recommended_temperature`: 0.0–0.3 for exact tasks, 0.4–0.8 for creative tasks

## Minimal example

```markdown
---
name: summary
description: Summarizes a long text into bullet points.
version: 1.0.0
tags: [writing]
recommended_temperature: 0.3
inputs:
  - name: text
    type: string
    required: true
    description: The text to summarize.
---

# Role
You are a senior technical editor specialized in information synthesis.

# Task
Summarize the following text into concise bullet points:

{{text}}

# Context
Prioritize facts, decisions, and concrete actions. Ignore filler sentences.

# Constraints
- DO keep each bullet under 20 words.
- DO NOT include opinions or interpretations that are not in the original text.

# Output Format
- Bullet 1
- Bullet 2
- ...

Maximum 10 bullets.
```
