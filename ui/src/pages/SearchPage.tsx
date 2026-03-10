import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlass,
  File,
  GitBranch,
  CaretDown,
  Code,
  Function as FnIcon,
  FileText,
  ClockCounterClockwise,
  CodeBlock,
} from '@phosphor-icons/react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchType = 'code' | 'symbols' | 'files' | 'commits'
type Language = 'All' | 'Python' | 'TypeScript' | 'Go' | 'Rust' | 'Java'
type Scope = 'All Repos' | 'Current Repo'

interface CodeLine {
  num: number
  text: string
}

interface SnippetResult {
  lines: CodeLine[]
  matchRanges: { line: number; start: number; end: number }[]
}

interface FileResult {
  filePath: string
  repo: string
  branch: string
  language: string
  snippets: SnippetResult[]
}

// ---------------------------------------------------------------------------
// Syntax highlighting (regex-based, Python-focused)
// ---------------------------------------------------------------------------

function highlightSyntax(text: string, matchRanges: { start: number; end: number }[]): React.ReactNode[] {
  // First, build a char-level annotation array
  const len = text.length
  const annotations: ('keyword' | 'string' | 'comment' | 'function' | 'number' | 'match' | null)[] = new Array(len).fill(null)

  // Mark search-match ranges first (highest visual priority for background)
  for (const r of matchRanges) {
    for (let i = r.start; i < r.end && i < len; i++) {
      annotations[i] = 'match'
    }
  }

  // We'll do token-based coloring but overlay match background
  const tokens: React.ReactNode[] = []

  // Comment detection
  const commentIdx = text.indexOf('#')
  const isFullComment = commentIdx !== -1

  // Tokenize with regex
  const tokenRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:def|class|import|from|return|if|else|elif|for|in|try|except|with|as|not|and|or|is|None|True|False|raise|yield|while|break|continue|pass|lambda|self|async|await)\b)|(#.*$)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*(?=\s*\())|([a-zA-Z_]\w*)|(\s+)|(.)/gm

  let match: RegExpExecArray | null
  let lastIndex = 0

  const parts: { text: string; type: string; start: number }[] = []

  while ((match = tokenRegex.exec(text)) !== null) {
    const m = match[0]
    const idx = match.index
    if (idx > lastIndex) {
      parts.push({ text: text.slice(lastIndex, idx), type: 'default', start: lastIndex })
    }
    let type = 'default'
    if (match[1]) type = 'string'
    else if (match[2]) type = 'keyword'
    else if (match[3]) type = 'comment'
    else if (match[4]) type = 'number'
    else if (match[5]) type = 'function'
    parts.push({ text: m, type, start: idx })
    lastIndex = idx + m.length
  }
  if (lastIndex < len) {
    parts.push({ text: text.slice(lastIndex), type: 'default', start: lastIndex })
  }

  // If we found a comment marker, re-tag everything from commentIdx onward as comment
  // (unless it's inside a string)
  if (isFullComment) {
    let inString = false
    let stringChar = ''
    for (let i = 0; i < commentIdx; i++) {
      if (!inString && (text[i] === '"' || text[i] === "'")) {
        inString = true
        stringChar = text[i]
      } else if (inString && text[i] === stringChar && text[i - 1] !== '\\') {
        inString = false
      }
    }
    if (!inString) {
      for (const p of parts) {
        if (p.start >= commentIdx) {
          p.type = 'comment'
        }
      }
    }
  }

  const colorMap: Record<string, string> = {
    keyword: '#ff7b72',
    string: '#a5d6ff',
    comment: 'var(--text-tertiary)',
    function: '#d2a8ff',
    number: '#79c0ff',
    default: 'var(--text-primary)',
  }

  let keyIdx = 0
  for (const part of parts) {
    // Split this part into match vs non-match sub-spans
    const partEnd = part.start + part.text.length
    let cursor = part.start
    while (cursor < partEnd) {
      // Find if there's a match range overlapping
      let inMatch = false
      let segEnd = partEnd
      for (const r of matchRanges) {
        if (r.start <= cursor && cursor < r.end) {
          inMatch = true
          segEnd = Math.min(partEnd, r.end)
          break
        }
        if (r.start > cursor && r.start < segEnd) {
          segEnd = r.start
        }
      }
      const segText = text.slice(cursor, segEnd)
      if (segText) {
        const style: React.CSSProperties = {
          color: part.type === 'match' ? 'var(--accent-insight)' : colorMap[part.type] || colorMap.default,
          fontStyle: part.type === 'comment' ? 'italic' : undefined,
        }
        if (inMatch) {
          style.backgroundColor = 'rgba(255,184,77,0.2)'
          style.color = 'var(--accent-insight)'
          style.borderRadius = '2px'
        }
        tokens.push(
          <span key={keyIdx++} style={style}>
            {segText}
          </span>
        )
      }
      cursor = segEnd
    }
  }

  return tokens
}

// ---------------------------------------------------------------------------
// Mock data: 10 file groups, 30+ total snippets
// ---------------------------------------------------------------------------

const MOCK_RESULTS: FileResult[] = [
  {
    filePath: 'src/analysis/graph_query.py',
    repo: 'codegraph/core',
    branch: 'main',
    language: 'Python',
    snippets: [
      {
        lines: [
          { num: 14, text: 'from neo4j import GraphDatabase' },
          { num: 15, text: '' },
          { num: 16, text: 'def execute_cypher_query(driver, query, params=None):' },
          { num: 17, text: '    """Execute a Cypher query against the graph database."""' },
          { num: 18, text: '    with driver.session() as session:' },
        ],
        matchRanges: [{ line: 16, start: 4, end: 26 }],
      },
      {
        lines: [
          { num: 42, text: 'class GraphQuery:' },
          { num: 43, text: '    """Builder for composing complex graph queries."""' },
          { num: 44, text: '' },
          { num: 45, text: '    def __init__(self, root_node):' },
          { num: 46, text: '        self._root = root_node' },
        ],
        matchRanges: [{ line: 42, start: 6, end: 16 }],
      },
      {
        lines: [
          { num: 89, text: '    def find_by_variable(self, var_name, scope="module"):' },
          { num: 90, text: '        """Find all references to a variable in the given scope."""' },
          { num: 91, text: '        pattern = f"MATCH (v:Variable {{name: \'{var_name}\'}})"' },
          { num: 92, text: '        return self.execute_cypher_query(self._driver, pattern)' },
        ],
        matchRanges: [
          { line: 89, start: 8, end: 24 },
          { line: 92, start: 15, end: 37 },
        ],
      },
    ],
  },
  {
    filePath: 'src/analysis/code_analyzer.py',
    repo: 'codegraph/core',
    branch: 'main',
    language: 'Python',
    snippets: [
      {
        lines: [
          { num: 7, text: 'import ast' },
          { num: 8, text: 'from pathlib import Path' },
          { num: 9, text: '' },
          { num: 10, text: 'def analyze_code(source_path, config=None):' },
          { num: 11, text: '    """Run full static analysis on a Python source file."""' },
        ],
        matchRanges: [{ line: 10, start: 4, end: 16 }],
      },
      {
        lines: [
          { num: 34, text: '    tree = parse_ast(source_text)' },
          { num: 35, text: '    visitor = CodeGraphVisitor(config)' },
          { num: 36, text: '    visitor.visit(tree)' },
          { num: 37, text: '    return visitor.graph' },
        ],
        matchRanges: [{ line: 34, start: 11, end: 20 }],
      },
      {
        lines: [
          { num: 55, text: 'def analyze_code_batch(paths, max_workers=4):' },
          { num: 56, text: '    """Analyze multiple files concurrently."""' },
          { num: 57, text: '    from concurrent.futures import ThreadPoolExecutor' },
          { num: 58, text: '    with ThreadPoolExecutor(max_workers=max_workers) as pool:' },
          { num: 59, text: '        results = list(pool.map(analyze_code, paths))' },
        ],
        matchRanges: [
          { line: 55, start: 4, end: 22 },
          { line: 59, start: 38, end: 50 },
        ],
      },
    ],
  },
  {
    filePath: 'src/parser/ast_parser.py',
    repo: 'codegraph/core',
    branch: 'main',
    language: 'Python',
    snippets: [
      {
        lines: [
          { num: 22, text: 'def parse_ast(source_text, filename="<unknown>"):' },
          { num: 23, text: '    """Parse Python source into an AST with error recovery."""' },
          { num: 24, text: '    try:' },
          { num: 25, text: '        return ast.parse(source_text, filename=filename)' },
          { num: 26, text: '    except SyntaxError as e:' },
        ],
        matchRanges: [{ line: 22, start: 4, end: 13 }],
      },
      {
        lines: [
          { num: 61, text: 'class ASTNodeVisitor(ast.NodeVisitor):' },
          { num: 62, text: '    """Walk the AST and extract function/class definitions."""' },
          { num: 63, text: '' },
          { num: 64, text: '    def visit_FunctionDef(self, node):' },
          { num: 65, text: '        self.functions.append(node.name)' },
        ],
        matchRanges: [{ line: 61, start: 6, end: 20 }],
      },
      {
        lines: [
          { num: 78, text: '    def visit_ClassDef(self, node):' },
          { num: 79, text: '        self.classes.append(node.name)' },
          { num: 80, text: '        self.generic_visit(node)' },
        ],
        matchRanges: [{ line: 78, start: 8, end: 23 }],
      },
    ],
  },
  {
    filePath: 'src/indexer/file_scanner.py',
    repo: 'codegraph/core',
    branch: 'main',
    language: 'Python',
    snippets: [
      {
        lines: [
          { num: 3, text: 'import os' },
          { num: 4, text: 'from pathlib import Path' },
          { num: 5, text: 'from typing import Iterator' },
          { num: 6, text: '' },
          { num: 7, text: 'def scan_directory(root_path, extensions=None):' },
        ],
        matchRanges: [{ line: 7, start: 4, end: 18 }],
      },
      {
        lines: [
          { num: 28, text: '    for entry in os.scandir(root_path):' },
          { num: 29, text: '        if entry.is_file() and _matches_extension(entry.name, extensions):' },
          { num: 30, text: '            yield FileInfo(path=entry.path, size=entry.stat().st_size)' },
          { num: 31, text: '        elif entry.is_dir() and not _is_ignored(entry.name):' },
          { num: 32, text: '            yield from scan_directory(entry.path, extensions)' },
        ],
        matchRanges: [{ line: 32, start: 23, end: 37 }],
      },
    ],
  },
  {
    filePath: 'src/graph/dependency_resolver.py',
    repo: 'codegraph/core',
    branch: 'main',
    language: 'Python',
    snippets: [
      {
        lines: [
          { num: 11, text: 'from collections import defaultdict' },
          { num: 12, text: '' },
          { num: 13, text: 'class DependencyResolver:' },
          { num: 14, text: '    """Resolve and track import dependencies between modules."""' },
          { num: 15, text: '' },
        ],
        matchRanges: [{ line: 13, start: 6, end: 24 }],
      },
      {
        lines: [
          { num: 34, text: '    def resolve_imports(self, module_path):' },
          { num: 35, text: '        """Trace all import chains from a module."""' },
          { num: 36, text: '        tree = parse_ast(self._read_source(module_path))' },
          { num: 37, text: '        imports = self._extract_imports(tree)' },
          { num: 38, text: '        for imp in imports:' },
        ],
        matchRanges: [
          { line: 34, start: 8, end: 23 },
          { line: 36, start: 15, end: 24 },
        ],
      },
      {
        lines: [
          { num: 67, text: '    def build_dependency_graph(self, entry_points):' },
          { num: 68, text: '        """Build a full dependency graph from multiple entry points."""' },
          { num: 69, text: '        graph = defaultdict(set)' },
          { num: 70, text: '        visited = set()' },
          { num: 71, text: '        for entry in entry_points:' },
        ],
        matchRanges: [{ line: 67, start: 8, end: 30 }],
      },
    ],
  },
  {
    filePath: 'src/metrics/complexity.py',
    repo: 'codegraph/analysis',
    branch: 'main',
    language: 'Python',
    snippets: [
      {
        lines: [
          { num: 18, text: 'def compute_cyclomatic_complexity(func_node):' },
          { num: 19, text: '    """Calculate cyclomatic complexity of a function AST node."""' },
          { num: 20, text: '    complexity = 1  # base path' },
          { num: 21, text: '    for node in ast.walk(func_node):' },
          { num: 22, text: '        if isinstance(node, (ast.If, ast.For, ast.While)):' },
        ],
        matchRanges: [{ line: 18, start: 4, end: 33 }],
      },
      {
        lines: [
          { num: 41, text: '    # Count boolean operators as additional branches' },
          { num: 42, text: '    complexity += sum(1 for n in ast.walk(func_node)' },
          { num: 43, text: '                      if isinstance(n, ast.BoolOp))' },
          { num: 44, text: '    return complexity' },
        ],
        matchRanges: [{ line: 44, start: 11, end: 21 }],
      },
    ],
  },
  {
    filePath: 'src/graph/node_builder.py',
    repo: 'codegraph/core',
    branch: 'main',
    language: 'Python',
    snippets: [
      {
        lines: [
          { num: 5, text: 'from dataclasses import dataclass, field' },
          { num: 6, text: 'from typing import Optional, List' },
          { num: 7, text: '' },
          { num: 8, text: '@dataclass' },
          { num: 9, text: 'class GraphNode:' },
        ],
        matchRanges: [{ line: 9, start: 6, end: 15 }],
      },
      {
        lines: [
          { num: 10, text: '    """Represents a node in the code dependency graph."""' },
          { num: 11, text: '    name: str' },
          { num: 12, text: '    kind: str  # "function", "class", "module", "variable"' },
          { num: 13, text: '    file_path: str' },
          { num: 14, text: '    line_number: int' },
        ],
        matchRanges: [{ line: 12, start: 4, end: 8 }],
      },
      {
        lines: [
          { num: 32, text: 'def build_graph_node(ast_node, file_path, parent=None):' },
          { num: 33, text: '    """Create a GraphNode from an AST node."""' },
          { num: 34, text: '    kind = "function" if isinstance(ast_node, ast.FunctionDef) else "class"' },
          { num: 35, text: '    return GraphNode(' },
          { num: 36, text: '        name=ast_node.name,' },
        ],
        matchRanges: [{ line: 32, start: 4, end: 20 }],
      },
      {
        lines: [
          { num: 48, text: '    edges: List[GraphEdge] = field(default_factory=list)' },
          { num: 49, text: '' },
          { num: 50, text: '    def add_edge(self, target, edge_type="calls"):' },
          { num: 51, text: '        self.edges.append(GraphEdge(source=self, target=target, kind=edge_type))' },
        ],
        matchRanges: [{ line: 50, start: 8, end: 16 }],
      },
    ],
  },
  {
    filePath: 'src/search/code_search.py',
    repo: 'codegraph/search',
    branch: 'main',
    language: 'Python',
    snippets: [
      {
        lines: [
          { num: 1, text: '"""Full-text code search with regex support."""' },
          { num: 2, text: 'import re' },
          { num: 3, text: 'from typing import List, Optional' },
          { num: 4, text: '' },
          { num: 5, text: 'class CodeSearchEngine:' },
        ],
        matchRanges: [{ line: 5, start: 6, end: 22 }],
      },
      {
        lines: [
          { num: 19, text: '    def search(self, query, regex=False, case_sensitive=True):' },
          { num: 20, text: '        """Search indexed code for matches."""' },
          { num: 21, text: '        pattern = re.compile(query) if regex else None' },
          { num: 22, text: '        results = []' },
          { num: 23, text: '        for file_entry in self._index:' },
        ],
        matchRanges: [{ line: 19, start: 8, end: 14 }],
      },
      {
        lines: [
          { num: 38, text: '    def _rank_results(self, matches, query):' },
          { num: 39, text: '        """Rank search results by relevance score."""' },
          { num: 40, text: '        scored = [(m, self._compute_score(m, query)) for m in matches]' },
          { num: 41, text: '        scored.sort(key=lambda x: x[1], reverse=True)' },
          { num: 42, text: '        return [m for m, _ in scored]' },
        ],
        matchRanges: [{ line: 38, start: 8, end: 21 }],
      },
    ],
  },
  {
    filePath: 'src/export/json_exporter.py',
    repo: 'codegraph/core',
    branch: 'main',
    language: 'Python',
    snippets: [
      {
        lines: [
          { num: 12, text: 'def export_graph_to_json(graph, output_path):' },
          { num: 13, text: '    """Serialize the code graph to a JSON file."""' },
          { num: 14, text: '    nodes = [_serialize_node(n) for n in graph.nodes]' },
          { num: 15, text: '    edges = [_serialize_edge(e) for e in graph.edges]' },
          { num: 16, text: '    payload = {"nodes": nodes, "edges": edges, "metadata": graph.meta}' },
        ],
        matchRanges: [{ line: 12, start: 4, end: 24 }],
      },
      {
        lines: [
          { num: 30, text: 'def _serialize_node(node):' },
          { num: 31, text: '    return {' },
          { num: 32, text: '        "id": node.id,' },
          { num: 33, text: '        "name": node.name,' },
          { num: 34, text: '        "kind": node.kind,' },
          { num: 35, text: '        "file": node.file_path,' },
        ],
        matchRanges: [{ line: 30, start: 4, end: 19 }],
      },
    ],
  },
  {
    filePath: 'tests/test_graph_query.py',
    repo: 'codegraph/core',
    branch: 'main',
    language: 'Python',
    snippets: [
      {
        lines: [
          { num: 8, text: 'import pytest' },
          { num: 9, text: 'from analysis.graph_query import GraphQuery, execute_cypher_query' },
          { num: 10, text: '' },
          { num: 11, text: 'class TestGraphQuery:' },
          { num: 12, text: '    def test_find_by_variable(self):' },
        ],
        matchRanges: [
          { line: 9, start: 35, end: 45 },
          { line: 9, start: 47, end: 69 },
          { line: 12, start: 8, end: 28 },
        ],
      },
      {
        lines: [
          { num: 22, text: '    def test_execute_cypher_query_returns_records(self):' },
          { num: 23, text: '        driver = MockDriver()' },
          { num: 24, text: '        result = execute_cypher_query(driver, "MATCH (n) RETURN n")' },
          { num: 25, text: '        assert len(result) > 0' },
        ],
        matchRanges: [
          { line: 22, start: 8, end: 33 },
          { line: 24, start: 17, end: 39 },
        ],
      },
      {
        lines: [
          { num: 34, text: '    def test_graph_query_builder_chain(self):' },
          { num: 35, text: '        query = GraphQuery(root_node="app")' },
          { num: 36, text: '        query.filter_by("kind", "function").limit(10)' },
          { num: 37, text: '        result = query.execute()' },
          { num: 38, text: '        assert result is not None' },
        ],
        matchRanges: [{ line: 35, start: 16, end: 26 }],
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Dropdown component
// ---------------------------------------------------------------------------

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <span style={{ color: 'var(--text-tertiary)' }}>{label}:</span>
        <span style={{ color: 'var(--text-primary)' }}>{value}</span>
        <CaretDown size={12} weight="bold" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg py-1"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt)
                  setOpen(false)
                }}
                className="block w-full px-3 py-1.5 text-left text-xs transition-colors"
                style={{
                  color: opt === value ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: opt === value ? 'var(--bg-active)' : 'transparent',
                  fontFamily: 'var(--font-body)',
                }}
                onMouseEnter={(e) => {
                  if (opt !== value) (e.target as HTMLElement).style.background = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  if (opt !== value) (e.target as HTMLElement).style.background = 'transparent'
                }}
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toggle button group
// ---------------------------------------------------------------------------

const typeConfig: { key: SearchType; label: string; icon: React.ReactNode }[] = [
  { key: 'code', label: 'Code', icon: <Code size={14} weight="bold" /> },
  { key: 'symbols', label: 'Symbols', icon: <FnIcon size={14} weight="bold" /> },
  { key: 'files', label: 'Files', icon: <FileText size={14} weight="bold" /> },
  { key: 'commits', label: 'Commits', icon: <ClockCounterClockwise size={14} weight="bold" /> },
]

function TypeToggle({
  value,
  onChange,
}: {
  value: SearchType
  onChange: (v: SearchType) => void
}) {
  return (
    <div
      className="flex overflow-hidden rounded-lg"
      style={{ border: '1px solid var(--border-default)' }}
    >
      {typeConfig.map((t) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: active ? 'var(--accent-graph)' : 'var(--bg-elevated)',
              color: active ? '#ffffff' : 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              borderRight: t.key !== 'commits' ? '1px solid var(--border-default)' : undefined,
            }}
          >
            {t.icon}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Regex toggle pill
// ---------------------------------------------------------------------------

function RegexToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
      style={{
        background: active ? 'var(--accent-graph)' : 'var(--bg-elevated)',
        border: '1px solid ' + (active ? 'var(--accent-graph)' : 'var(--border-default)'),
        color: active ? '#ffffff' : 'var(--text-secondary)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <CodeBlock size={14} weight="bold" />
      Regex
    </button>
  )
}

// ---------------------------------------------------------------------------
// File result card
// ---------------------------------------------------------------------------

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

function FileResultCard({
  result,
  query,
  index,
}: {
  result: FileResult
  query: string
  index: number
}) {
  const totalMatches = result.snippets.reduce((acc, s) => acc + s.matchRanges.length, 0)

  return (
    <motion.div
      variants={card}
      initial="initial"
      animate="animate"
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden rounded-xl"
      style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-default)',
        marginBottom: '12px',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <File size={16} weight="duotone" style={{ color: 'var(--accent-graph)', flexShrink: 0 }} />
        <span
          className="truncate text-sm font-medium"
          style={{ color: 'var(--accent-graph)', fontFamily: 'var(--font-display)', fontSize: '13px' }}
        >
          {result.filePath}
        </span>
        <span
          className="ml-1 truncate text-xs"
          style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
        >
          {result.repo}
        </span>
        <span
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-display)',
          }}
        >
          <GitBranch size={10} weight="bold" />
          {result.branch}
        </span>
      </div>

      {/* Snippets */}
      <div>
        {result.snippets.map((snippet, sIdx) => {
          // Build per-line match ranges for highlighting
          const lineMatchMap = new Map<number, { start: number; end: number }[]>()
          for (const mr of snippet.matchRanges) {
            if (!lineMatchMap.has(mr.line)) lineMatchMap.set(mr.line, [])
            lineMatchMap.get(mr.line)!.push({ start: mr.start, end: mr.end })
          }

          // Also do inline text match highlighting for the query string
          const queryLower = query.toLowerCase()

          return (
            <div
              key={sIdx}
              style={{
                borderBottom:
                  sIdx < result.snippets.length - 1 ? '1px solid var(--border-subtle)' : undefined,
              }}
            >
              {snippet.lines.map((line) => {
                const ranges = lineMatchMap.get(line.num) || []

                // Also find query text matches in the line
                const textRanges = [...ranges]
                if (queryLower.length >= 2) {
                  const lineLower = line.text.toLowerCase()
                  let searchStart = 0
                  while (searchStart < lineLower.length) {
                    const idx = lineLower.indexOf(queryLower, searchStart)
                    if (idx === -1) break
                    // Only add if not overlapping an existing range
                    const overlaps = textRanges.some(
                      (r) => idx < r.end && idx + queryLower.length > r.start
                    )
                    if (!overlaps) {
                      textRanges.push({ start: idx, end: idx + queryLower.length })
                    }
                    searchStart = idx + 1
                  }
                }

                const hasMatch = textRanges.length > 0

                return (
                  <div
                    key={line.num}
                    className="flex"
                    style={{
                      background: hasMatch ? 'rgba(255,184,77,0.04)' : 'var(--bg-base)',
                      borderLeft: hasMatch ? '2px solid var(--accent-insight)' : '2px solid transparent',
                    }}
                  >
                    <span
                      className="select-none text-right"
                      style={{
                        width: '48px',
                        minWidth: '48px',
                        padding: '0 12px 0 0',
                        color: 'var(--text-tertiary)',
                        fontFamily: 'var(--font-display)',
                        fontSize: '12px',
                        lineHeight: '22px',
                        userSelect: 'none',
                      }}
                    >
                      {line.num}
                    </span>
                    <code
                      className="flex-1 overflow-hidden"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '13px',
                        lineHeight: '22px',
                        whiteSpace: 'pre',
                        paddingRight: '16px',
                      }}
                    >
                      {highlightSyntax(line.text, textRanges)}
                    </code>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2"
        style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}
      >
        <button
          className="text-xs transition-colors hover:underline"
          style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
        >
          {totalMatches} match{totalMatches !== 1 ? 'es' : ''} in this file
        </button>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Search page
// ---------------------------------------------------------------------------

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [language, setLanguage] = useState<Language>('All')
  const [scope, setScope] = useState<Scope>('All Repos')
  const [searchType, setSearchType] = useState<SearchType>('code')
  const [regexEnabled, setRegexEnabled] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Filter results
  const searchStart = performance.now()
  const filteredResults = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return []

    const q = debouncedQuery.toLowerCase()
    return MOCK_RESULTS.filter((file) => {
      // Language filter
      if (language !== 'All' && file.language !== language) return false
      // Scope filter
      if (scope === 'Current Repo' && file.repo !== 'codegraph/core') return false
      // Text match: check file path and snippet text
      const pathMatch = file.filePath.toLowerCase().includes(q)
      const codeMatch = file.snippets.some((s) =>
        s.lines.some((l) => l.text.toLowerCase().includes(q))
      )
      return pathMatch || codeMatch
    })
  }, [debouncedQuery, language, scope])
  const searchTime = ((performance.now() - searchStart) * 0.1 + 0.3).toFixed(1)

  const totalMatches = filteredResults.reduce(
    (acc, f) => acc + f.snippets.reduce((a, s) => a + s.matchRanges.length, 0),
    0
  )

  const showResults = debouncedQuery.length >= 2

  return (
    <div
      className="mx-auto w-full px-6 py-8"
      style={{ maxWidth: '1200px' }}
    >
      {/* Search input */}
      <div className="mb-4">
        <div
          className="flex items-center gap-3 rounded-xl px-5 transition-colors focus-within:border-[var(--accent-graph)]"
          style={{
            height: '56px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-default)',
          }}
        >
          <MagnifyingGlass
            size={22}
            weight="bold"
            style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start searching..."
            className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-[var(--text-tertiary)]"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontSize: '15px',
              letterSpacing: '-0.01em',
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="rounded-md px-2 py-1 text-xs transition-colors"
              style={{
                color: 'var(--text-tertiary)',
                background: 'var(--bg-elevated)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Dropdown
          label="Language"
          value={language}
          options={['All', 'Python', 'TypeScript', 'Go', 'Rust', 'Java']}
          onChange={(v) => setLanguage(v as Language)}
        />
        <Dropdown
          label="Scope"
          value={scope}
          options={['All Repos', 'Current Repo']}
          onChange={(v) => setScope(v as Scope)}
        />
        <TypeToggle value={searchType} onChange={setSearchType} />
        <RegexToggle active={regexEnabled} onToggle={() => setRegexEnabled(!regexEnabled)} />
      </div>

      {/* Results area */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        {showResults ? (
          <>
            {/* Results header */}
            <div className="mb-4 flex items-baseline gap-2">
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
              >
                {totalMatches} result{totalMatches !== 1 ? 's' : ''} in {filteredResults.length} file
                {filteredResults.length !== 1 ? 's' : ''}
              </span>
              <span
                className="text-xs"
                style={{
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                ({searchTime}ms)
              </span>
            </div>

            {/* Results list */}
            <AnimatePresence mode="wait">
              {filteredResults.length > 0 ? (
                <motion.div
                  key={debouncedQuery + language + scope}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {filteredResults.map((result, idx) => (
                    <FileResultCard
                      key={result.filePath}
                      result={result}
                      query={debouncedQuery}
                      index={idx}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-20"
                >
                  <MagnifyingGlass
                    size={48}
                    weight="thin"
                    style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }}
                  />
                  <p
                    className="text-sm"
                    style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
                  >
                    No results found for "{debouncedQuery}"
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <MagnifyingGlass
                size={64}
                weight="thin"
                style={{ color: 'var(--text-tertiary)' }}
              />
            </motion.div>
            <p
              className="mt-4 text-sm"
              style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
            >
              Search across all repositories and code
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['GraphQuery', 'parse_ast', 'execute_cypher', 'analyze_code', 'DependencyResolver'].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setQuery(suggestion)}
                    className="rounded-lg px-3 py-1.5 text-xs transition-colors"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-display)',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.target as HTMLElement).style.borderColor = 'var(--accent-graph)'
                      ;(e.target as HTMLElement).style.color = 'var(--text-primary)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.target as HTMLElement).style.borderColor = 'var(--border-default)'
                      ;(e.target as HTMLElement).style.color = 'var(--text-secondary)'
                    }}
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
