# CodeGraphContext Local Setup (macOS)

This repository is running locally in editable mode with the CLI, MCP server, indexing pipeline, and tests verified.

## 1) Install and run (exact commands)

```bash
cd ~/.openclaw/workspace-codegraph
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Verify CLI:

```bash
source ~/.openclaw/workspace-codegraph/.venv/bin/activate
cgc --help
```

Index this repo’s source tree:

```bash
source ~/.openclaw/workspace-codegraph/.venv/bin/activate
cgc index ~/.openclaw/workspace-codegraph/src
```

Check graph stats:

```bash
source ~/.openclaw/workspace-codegraph/.venv/bin/activate
cgc stats
```

Observed successful output:
- Database backend used: **FalkorDB Lite** (loaded from `~/.openclaw/.env`)
- Indexing completed in ~14.6s for `src/`
- Stats after indexing:
  - Repositories: 1
  - Files: 72
  - Functions: 673
  - Classes: 63
  - Modules: 178

## 2) MCP server startup

Command:

```bash
source ~/.openclaw/workspace-codegraph/.venv/bin/activate
cgc mcp start
```

Observed startup log:
- `Starting CodeGraphContext Server...`
- `Loaded configuration from: /Users/drewmattie/.openclaw/.env`
- `Using database: FalkorDB Lite`
- `MCP Server is running. Waiting for requests...`

### MCP config snippet (Claude/OpenClaw stdio)

Use this in your MCP client config (example `mcpServers` block):

```json
{
  "mcpServers": {
    "CodeGraphContext": {
      "command": "/Users/drewmattie/.openclaw/workspace-codegraph/.venv/bin/cgc",
      "args": ["mcp", "start"],
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

If you want Neo4j instead of FalkorDB Lite, provide Neo4j env vars (or run `cgc neo4j setup`) and include:
- `NEO4J_URI`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`

## 3) Test results summary

Executed:

```bash
source ~/.openclaw/workspace-codegraph/.venv/bin/activate
pytest tests/ -x --tb=short 2>&1 | tail -40
```

Final result:
- **63 passed, 2 skipped**
- Total runtime ~4.45s

## 4) Issues found and fixes

### Issue: one failing unit test on DB backend auto-detection
- Failing test: `tests/unit/core/test_database_falkordb_remote.py::TestFactoryFalkorDBRemote::test_auto_detect_remote_via_host`
- Symptom: when `FALKORDB_HOST` is set (without explicit `DATABASE_TYPE`), factory returned local `FalkorDBManager` instead of `FalkorDBRemoteManager`.

### Fix applied
- Updated backend selection order in:
  - `src/codegraphcontext/core/__init__.py`
- Change:
  - Prioritize remote auto-detection via `FALKORDB_HOST` **before** implicit local embedded defaults.
- Result:
  - Targeted test passes.
  - Full suite passes (`63 passed, 2 skipped`).

## 5) Codebase structure notes (for SaaSquach ERP layer planning)

High-level architecture:

- `src/codegraphcontext/cli/`
  - Typer CLI entry and command orchestration.
  - `main.py` exposes `cgc` command surface.
  - Includes setup wizards and MCP-related CLI config helpers.

- `src/codegraphcontext/core/`
  - Database abstraction/factory and backend managers.
  - Key backends:
    - `database_kuzu.py` (embedded KùzuDB)
    - `database_falkordb.py` (FalkorDB Lite)
    - `database_falkordb_remote.py` (hosted FalkorDB)
    - `database.py` (Neo4j)
  - Job handling (`jobs.py`) and file watching (`watcher.py`).

- `src/codegraphcontext/tools/`
  - Indexing and graph-construction logic (`graph_builder.py`, `scip_indexer.py`).
  - Query/exploration logic (`code_finder.py`, language query toolkits).
  - Language-specific parsers in `tools/languages/`.
  - MCP handler split by concern under `tools/handlers/`:
    - indexing, query, analysis, management, watcher.

- `src/codegraphcontext/server.py`
  - MCP server wiring and tool exposure.

- `src/codegraphcontext/tool_definitions.py`
  - MCP tool definitions/metadata for client interaction.

ERP extension guidance:
- Keep ERP intelligence as a layer on top of existing graph primitives (do not fork parser/query fundamentals initially).
- Add ERP-specific analyzers as new tools/handlers, reusing indexed symbols, call chains, dependency traversals.
- Preserve database backend abstraction to avoid coupling ERP logic to one graph engine.
- Maintain compatibility with KùzuDB constraints documented in `KUZUDB_FIXES.md` when adding new Cypher patterns.

## 6) KùzuDB note

`KUZUDB_FIXES.md` already captures Kùzu-specific query/schema workarounds (polymorphic MERGE, DISTINCT+ORDER BY aliasing, variable-length path syntax, schema properties). Use those patterns directly when extending query logic.
