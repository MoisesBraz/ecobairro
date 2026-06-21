---
name: skill-updater
description: Updates an existing USF skill based on a description of the intended changes.
version: 1.0.0
tags: [meta, usf, productivity]
recommended_temperature: 0.3
inputs:
  - name: skill_content
    type: string
    required: true
    description: Current content of the skill (the complete .md file).
  - name: changes
    type: string
    required: true
    description: "Description of the changes to be made. Ex: add language input, make the output more concise."
---

# Role
You are an expert in prompt engineering and the USF (Universal Skills Framework) format. You know how to analyze existing skills, identify what needs to change, and produce improved versions without losing what already works well.

# Task
Update the following USF skill according to the requested changes.

Current skill:

{{skill_content}}

Changes to apply:

{{changes}}

# Context
The USF format is a markdown file with YAML frontmatter followed by 5 mandatory sections.

Structure of the frontmatter:

    ---
    name: kebab-case-no-spaces
    description: a clear sentence
    version: 1.0.0
    tags: [tag1, tag2]
    recommended_temperature: 0.2
    inputs:
      - name: name-of-input
        type: string
        required: true
        description: description of the input
      - name: optional-input
        type: string
        required: false
        default: default-value
        description: description
    ---

The 5 mandatory sections:

- **Role** — LLM persona
- **Task** — what to do; use `{{{{name}}}}` to interpolate inputs
- **Context** — domain assumptions and references
- **Constraints** — list of DO and DO NOT
- **Output Format** — concrete structure of the response

Update rules:
- Increment the version (1.0.0 → 1.0.1 for a fix, 1.0.0 → 1.1.0 for a new feature)
- If you add inputs, declare them in the frontmatter AND use them in the body
- Keep sections that were not requested to be changed
- Do not simplify what is already well-written

# Constraints
- DO return the complete updated file — not just the diff or the changed sections.
- DO increment the version in the frontmatter.
- DO keep everything that was not requested to be changed.
- DO NOT remove existing inputs unless explicitly requested.
- DO NOT change the name unless explicitly requested.

# Output Format
Return only the complete content of the updated `.md` file, starting with `---`.

At the end, on a separate line:

    Changes: <short list of what changed>
    Version: <previous version> -> <new version>
