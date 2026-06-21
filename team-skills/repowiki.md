---
name: repowiki
description: Convert any code repository into a rich Obsidian wiki using multi-agent analysis
---

Convert the current repository into an Obsidian-compatible wiki by orchestrating a pipeline of specialized sub-agents. You are the **orchestrator** — you do NOT analyze code directly. You coordinate agents and pass information between them.

## Usage Examples

If the user types:
- `repowiki` — generate wiki for current repo → `.repowiki/`
- `repowiki --section "Database"` — regenerate one section only
- `repowiki --output docs/wiki` — custom output directory
- `repowiki --lang pt` — Portuguese output
- `repowiki --update` — only regenerate sections with changed files

## Step 0: Parse Arguments

Parse the user's request:
- `OUTPUT_DIR` = parsed value or `.repowiki`
- `LANG` = parsed value or `en`
- `SECTION_FILTER` = parsed value or null
- `UPDATE_MODE` = true if `--update` was passed

If `UPDATE_MODE` is true, run a command like `git diff --name-only HEAD` to get changed files. You'll use this later to filter which sections to regenerate.

Report to the user: `Starting repowiki... output → <OUTPUT_DIR>/`

## Step 1: Setup

Create the necessary directories using `run_command` or your file tools:
```bash
mkdir -p "<OUTPUT_DIR>/.tmp"
mkdir -p "<OUTPUT_DIR>/_meta"
```

## Step 2: Discovery Phase

Use `invoke_subagent` to spawn a sub-agent.
- `TypeName`: `self`
- `Role`: `Discovery Agent`
- `Workspace`: `share`
- `Prompt`: Read the `agents/discovery.md` file from this skill's directory to get the full prompt. Then combine it with:
  "Repo root: <current working directory>. Manifest output path: <OUTPUT_DIR>/.tmp/_manifest.json. When you are done writing the manifest, use `send_message` to send MANIFEST_COMPLETE back to me."

After the discovery agent completes, read `<OUTPUT_DIR>/.tmp/_manifest.json` and store the manifest content.

## Step 3: Architecture Phase

Use `invoke_subagent` to spawn a sub-agent.
- `TypeName`: `self`
- `Role`: `Architect Agent`
- `Workspace`: `share`
- `Prompt`: Read the `agents/architect.md` file from this skill's directory. Then combine it with:
  "Read the discovery manifest at: <OUTPUT_DIR>/.tmp/_manifest.json. Write the architecture JSON to: <OUTPUT_DIR>/.tmp/_architecture.json. When done, send me ARCHITECTURE_COMPLETE via `send_message`."

After the architect agent completes, read `<OUTPUT_DIR>/.tmp/_architecture.json` and parse the sections array.

If `SECTION_FILTER` is set, filter `sections` to only those whose `title` matches (case-insensitive).
If `UPDATE_MODE` is true, filter `sections` to only those whose `key_files` overlap with the git-changed files list.

## Step 4: Create Section Directories

For each section in the (possibly filtered) sections array, create the output directory using `run_command`:
```bash
mkdir -p "<OUTPUT_DIR>/<section.output_dir>"
```

## Step 5: Parallel Specialist Generation

**CRITICAL: Spawn ALL specialist agents IN PARALLEL by making multiple entries in the `Subagents` array of a single `invoke_subagent` tool call.**

For EACH section, prepare a sub-agent entry:
- `TypeName`: `self`
- `Role`: `Specialist Agent - <section.title>`
- `Workspace`: `share`
- `Prompt`: Read the `agents/specialist.md` file from this skill's directory. Combine it with the specific section data:
  "Section: <section.title>
  Output directory: <OUTPUT_DIR>/<section.output_dir>/
  Language: <LANG>
  Context: <section.context>
  Read these files completely: <section.key_files>
  Generate these wiki pages: <section.pages>
  Write each page as a .md file to <OUTPUT_DIR>/<section.output_dir>/<Page Name>.md.
  When done, send me 'SPECIALIST_COMPLETE: <section.title>' via `send_message`."

Wait for ALL specialist agents to send their complete messages before proceeding.

## Step 6: Finalization Phase

Use `invoke_subagent` to spawn a sub-agent.
- `TypeName`: `self`
- `Role`: `Finalizer Agent`
- `Workspace`: `share`
- `Prompt`: Read the `agents/finalizer.md` file from this skill's directory. Combine it with:
  "Output directory: <OUTPUT_DIR>/. Repository name: <repo_name from manifest>. Total sections: <count>. Build the index, fix WikiLinks, write index.md and metadata JSON. When done, send me FINALIZATION_COMPLETE."

## Step 7: Cleanup

Clean up the temporary directory:
```bash
rm -rf "<OUTPUT_DIR>/.tmp"
```

## Step 8: Report to User

After the finalizer completes, report:

```
✓ repowiki complete

Output:    <OUTPUT_DIR>/
Sections:  <n>
Pages:     <m>

Open in Obsidian:
  Settings → Open vault → select <OUTPUT_DIR>/

Start at:  <OUTPUT_DIR>/index.md
```

If any agent failed or returned an error, report which phase failed and the error message, then stop.
