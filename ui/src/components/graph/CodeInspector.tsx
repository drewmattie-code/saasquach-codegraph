import { useCallback, useEffect, useRef, useState } from 'react'
import { Code, Copy, ArrowSquareOut } from '@phosphor-icons/react'

interface CodeInspectorProps {
  filePath: string | null
  highlightLine?: number
  onSymbolClick?: (name: string) => void
  className?: string
}

/* ── regex tokenizer ───────────────────────────────────────── */
type Token = { text: string; color: string; italic?: boolean; clickable?: string }
type Span = { start: number; end: number; color: string; italic?: boolean; clickable?: string }

const KW = /\b(def|class|import|from|return|if|else|elif|for|while|async|await|const|let|function|export|try|except|with|as|in|not|and|or|raise|yield|pass|break|continue|None|True|False|self)\b/g
const STR = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g
const COMMENT = /(#.*|\/\/.*)/g
const NUM = /\b(\d+(?:\.\d+)?)\b/g
const DECO = /(@\w+)/g
const DEF_NAME = /\b(def|function)\s+(\w+)/g
const CLASS_NAME = /\bclass\s+(\w+)/g
const TYPE_ANN = /:\s*(\w+)(?:\s*[=,)\]])/g

function tokenizeLine(line: string): Token[] {
  const spans: Span[] = []
  const add = (rx: RegExp, color: string, opts?: { italic?: boolean; group?: number; clickable?: boolean }) => {
    rx.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = rx.exec(line)) !== null) {
      const g = opts?.group ?? 0
      const idx = g > 0 ? line.indexOf(m[g], m.index) : m.index
      spans.push({ start: idx, end: idx + m[g].length, color, italic: opts?.italic, clickable: opts?.clickable ? m[g] : undefined })
    }
  }
  add(COMMENT, '#555568', { italic: true }); add(STR, '#a5d6ff'); add(DECO, '#ff9100')
  add(CLASS_NAME, '#e040fb', { group: 1, clickable: true })
  add(DEF_NAME, '#d2a8ff', { group: 2, clickable: true })
  add(KW, '#ff7b72'); add(TYPE_ANN, '#a371f7', { group: 1 }); add(NUM, '#79c0ff')

  spans.sort((a, b) => a.start - b.start)
  const merged: Span[] = []; let cursor = 0
  for (const s of spans) { if (s.start < cursor) continue; merged.push(s); cursor = s.end }

  const tokens: Token[] = []; let pos = 0
  for (const s of merged) {
    if (s.start > pos) tokens.push({ text: line.slice(pos, s.start), color: '#e0e0e8' })
    tokens.push({ text: line.slice(s.start, s.end), color: s.color, italic: s.italic, clickable: s.clickable })
    pos = s.end
  }
  if (pos < line.length) tokens.push({ text: line.slice(pos), color: '#e0e0e8' })
  return tokens
}

/* ── mock files ────────────────────────────────────────────── */
const MOCK_MAIN = [
  '"""FastAPI application entry point."""', 'import os',
  'from fastapi import FastAPI, HTTPException', 'from fastapi.middleware.cors import CORSMiddleware',
  '', 'from .indexer import build_index', 'from .search import SearchEngine', '',
  'app = FastAPI(title="CodeGraph", version="0.1.0")', '',
  'app.add_middleware(CORSMiddleware, allow_origins=["*"])', '',
  'engine: SearchEngine = None  # type: ignore', '',
  '@app.on_event("startup")', 'async def startup():',
  '    global engine', '    index = build_index(os.getenv("REPO_PATH", "."))',
  '    engine = SearchEngine(index)', '',
  '@app.get("/api/nodes")', 'async def list_nodes(limit: int = 500):',
  '    """Return all indexed code symbols."""', '    return engine.all_nodes(limit)', '',
  '@app.get("/api/search")', 'async def search(q: str, top_k: int = 20):',
  '    if not q:', '        raise HTTPException(400, "query required")',
  '    return engine.query(q, top_k)', '',
  '@app.get("/api/health")', 'async def health():',
  '    return {"status": "ok", "nodes": engine.node_count}',
].join('\n')

const MOCK_SEARCH = [
  '"""Search engine over the code index."""', 'from dataclasses import dataclass',
  'from typing import List', 'import re', '', '@dataclass', 'class SearchResult:',
  '    name: str', '    path: str', '    line_number: int',
  '    score: float', '    kind: str = "function"', '',
  'class SearchEngine:', '    """BM25-style search over code symbols."""', '',
  '    def __init__(self, index: dict):', '        self._index = index',
  '        self._names = list(index.keys())', '        self.node_count = len(self._names)', '',
  '    def query(self, q: str, top_k: int = 20) -> List[SearchResult]:',
  '        pattern = re.compile(re.escape(q), re.IGNORECASE)',
  '        hits = []', '        for name, meta in self._index.items():',
  '            if pattern.search(name):', '                hits.append(SearchResult(',
  '                    name=name, path=meta["path"],',
  '                    line_number=meta["line"], score=1.0,',
  '                ))', '        return hits[:top_k]',
].join('\n')

const MOCK_DEFAULT = [
  '"""Utility module for AST analysis."""', 'from typing import Dict, List, Optional',
  'import ast', 'import os', '', 'class ASTVisitor(ast.NodeVisitor):',
  '    """Walk Python AST and collect symbol definitions."""', '',
  '    def __init__(self):', '        self.symbols: List[Dict] = []',
  '        self._current_class: Optional[str] = None', '',
  '    def visit_FunctionDef(self, node: ast.FunctionDef):',
  '        self.symbols.append({', '            "name": node.name,',
  '            "kind": "method" if self._current_class else "function",',
  '            "line": node.lineno,', '        })', '        self.generic_visit(node)', '',
  '    def visit_ClassDef(self, node: ast.ClassDef):',
  '        self.symbols.append({"name": node.name, "kind": "class"})',
  '        prev = self._current_class', '        self._current_class = node.name',
  '        self.generic_visit(node)', '        self._current_class = prev', '', '',
  'def parse_file(path: str) -> List[Dict]:',
  '    """Parse a single Python file and return symbols."""',
  '    with open(path) as f:', '        tree = ast.parse(f.read(), filename=path)',
  '    visitor = ASTVisitor()', '    visitor.visit(tree)', '    return visitor.symbols',
].join('\n')

function getMockContent(p: string): string {
  const l = p.toLowerCase()
  if (l.includes('main.py')) return MOCK_MAIN
  if (l.includes('search') || l.includes('index')) return MOCK_SEARCH
  return MOCK_DEFAULT
}

function extBadge(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['py', 'ts', 'tsx', 'js'].includes(ext)) return { label: `.${ext}`, color: '#4fc3f7' }
  if (ext === 'md') return { label: '.md', color: '#f48fb1' }
  if (ext === 'yaml' || ext === 'yml') return { label: `.${ext}`, color: '#b39ddb' }
  return { label: `.${ext}`, color: '#9494ae' }
}

/* ── component ─────────────────────────────────────────────── */
export function CodeInspector({ filePath, highlightLine, onSymbolClick, className }: CodeInspectorProps) {
  const codeRef = useRef<HTMLDivElement>(null)
  const [selectedLine, setSelectedLine] = useState<number | null>(null)

  const scrollToLine = useCallback((n: number) => {
    const el = codeRef.current?.querySelector(`[data-line="${n}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (highlightLine != null) { setSelectedLine(highlightLine); scrollToLine(highlightLine) }
  }, [highlightLine, scrollToLine])

  if (!filePath) {
    return (
      <div className={`flex items-center justify-center h-full ${className ?? ''}`} style={{ background: 'var(--bg-raised)' }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Select a file to inspect</span>
      </div>
    )
  }

  const fileName = filePath.split('/').pop() ?? filePath
  const badge = extBadge(fileName)
  const content = getMockContent(filePath)
  const lines = content.split('\n')
  const mono = "'JetBrains Mono', monospace"

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className ?? ''}`} style={{ background: 'var(--bg-raised)', borderRight: '1px solid var(--border-default)' }}>
      {/* header */}
      <div className="flex items-center justify-between px-3 shrink-0" style={{ height: 36, borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-1.5">
          <Code size={14} weight="bold" style={{ color: 'var(--accent-graph)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em', fontFamily: 'var(--font-body)' }}>Code Inspector</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors" title="Copy" onClick={() => navigator.clipboard.writeText(content)}>
            <Copy size={13} style={{ color: 'var(--text-tertiary)' }} />
          </button>
          <button type="button" className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors" title="Open externally">
            <ArrowSquareOut size={13} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>
      </div>

      {/* tab bar */}
      <div className="flex items-end px-2 shrink-0" style={{ height: 30, borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-1.5 px-2" style={{ borderBottom: '2px solid var(--accent-change)', height: '100%' }}>
          <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-body)' }}>{fileName}</span>
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${badge.color}22`, color: badge.color, fontWeight: 600 }}>{badge.label}</span>
        </div>
      </div>

      {/* breadcrumb */}
      <div className="flex items-center justify-between px-3 shrink-0" style={{ height: 24, borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>{filePath}</span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{lines.length} lines</span>
      </div>

      {/* code viewer */}
      <div ref={codeRef} className="flex-1 overflow-auto" style={{ background: '#0a0a0f' }}>
        {lines.map((line, i) => {
          const num = i + 1
          const hl = num === selectedLine
          return (
            <div key={num} data-line={num} className="flex" style={{ minHeight: 20, background: hl ? 'rgba(78,205,196,0.07)' : undefined, borderLeft: hl ? '2px solid var(--accent-change)' : '2px solid transparent', cursor: 'pointer' }} onClick={() => setSelectedLine(num)}>
              <span className="shrink-0 select-none text-right pr-2" style={{ width: 40, fontSize: 12, lineHeight: '20px', fontFamily: mono, color: '#555568', background: '#0a0a0f', borderRight: '1px solid #2a2a3a' }}>{num}</span>
              <code className="pl-3 whitespace-pre" style={{ fontSize: 12, lineHeight: '20px', fontFamily: mono }}>
                {tokenizeLine(line).map((tok, j) => (
                  <span key={j} style={{ color: tok.color, fontStyle: tok.italic ? 'italic' : undefined, cursor: tok.clickable ? 'pointer' : undefined, textDecoration: tok.clickable ? 'underline' : undefined, textDecorationColor: tok.clickable ? `${tok.color}66` : undefined }} onClick={tok.clickable ? (e) => { e.stopPropagation(); onSymbolClick?.(tok.clickable!) } : undefined}>{tok.text}</span>
                ))}
              </code>
            </div>
          )
        })}
      </div>
    </div>
  )
}
