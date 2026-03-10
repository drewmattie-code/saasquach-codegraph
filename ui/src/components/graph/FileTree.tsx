import { useEffect, useMemo, useState } from 'react'

interface FileTreeNode {
  folders: Map<string, FileTreeNode>
  files: Map<string, string> // fileName → fullPath
}

interface ApiNode {
  id: number
  name: string
  type: string
  path?: string
  line_number?: number
}

interface FileTreeProps {
  nodes: ApiNode[]
  selectedFilePath?: string
  onSelectFile: (filePath: string) => void
}

function createNode(): FileTreeNode {
  return { folders: new Map(), files: new Map() }
}

function insertPath(root: FileTreeNode, filePath: string): void {
  const normalized = filePath.replace(/^\/+/, '')
  if (!normalized) return
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0) return

  let current = root
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!current.folders.has(part)) {
      current.folders.set(part, createNode())
    }
    current = current.folders.get(part)!
  }
  current.files.set(parts[parts.length - 1], filePath)
}

function collectFolderPaths(node: FileTreeNode, prefix = ''): string[] {
  const paths: string[] = []
  for (const [name, child] of node.folders.entries()) {
    const path = prefix ? `${prefix}/${name}` : name
    paths.push(path)
    paths.push(...collectFolderPaths(child, path))
  }
  return paths
}

export function FileTree({ nodes, selectedFilePath, onSelectFile }: FileTreeProps) {
  const { root, fileCounts } = useMemo(() => {
    const treeRoot = createNode()
    const counts = new Map<string, number>()

    for (const node of nodes) {
      const path = node.path ?? ''
      if (!path) continue
      insertPath(treeRoot, path)
      counts.set(path, (counts.get(path) ?? 0) + 1)
    }

    return { root: treeRoot, fileCounts: counts }
  }, [nodes])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const allFolders = collectFolderPaths(root)
    setExpanded(prev => {
      if (prev.size > 0) return prev
      // Auto-expand top-level folders
      return new Set(allFolders.filter(p => !p.includes('/')))
    })
  }, [root])

  const toggleFolder = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderNode = (node: FileTreeNode, prefix = '', depth = 0): React.ReactNode => {
    const folderEntries = Array.from(node.folders.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    const fileEntries = Array.from(node.files.entries()).sort((a, b) => a[0].localeCompare(b[0]))

    return (
      <div>
        {folderEntries.map(([folderName, child]) => {
          const path = prefix ? `${prefix}/${folderName}` : folderName
          const isOpen = expanded.has(path)
          return (
            <div key={`folder-${path}`}>
              <button
                type="button"
                onClick={() => toggleFolder(path)}
                className="w-full text-left text-[var(--text-secondary)] hover:text-[var(--accent-graph)] text-xs py-0.5 transition-colors"
                style={{ paddingLeft: `${depth * 12 + 4}px` }}
              >
                <span className="inline-block w-3.5 text-[10px]">{isOpen ? '▾' : '▸'}</span>
                <span className="font-medium">{folderName}</span>
              </button>
              {isOpen && renderNode(child, path, depth + 1)}
            </div>
          )
        })}

        {fileEntries.map(([fileName, fullPath]) => {
          const isSelected = selectedFilePath === fullPath
          const count = fileCounts.get(fullPath) ?? 0
          return (
            <button
              key={`file-${fullPath}`}
              type="button"
              onClick={() => onSelectFile(fullPath)}
              className={`w-full text-left text-xs py-0.5 rounded px-1 transition-colors ${
                isSelected
                  ? 'bg-[var(--accent-graph)]/20 text-[var(--accent-graph)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
              style={{ paddingLeft: `${depth * 12 + 18}px` }}
              title={fullPath}
            >
              <span className="mr-1.5 opacity-40">•</span>
              <span>{fileName}</span>
              {count > 0 && (
                <span className="ml-1.5 rounded-full border border-[var(--border-subtle)] px-1.5 py-0 text-[9px] text-[var(--text-tertiary)]">{count}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  const totalFiles = new Set(nodes.map(n => n.path).filter(Boolean)).size

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
        {nodes.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] px-1">No files loaded</p>
        ) : (
          renderNode(root)
        )}
      </div>
      <div className="border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-tertiary)] space-y-0.5">
        <div>{nodes.length} symbols</div>
        <div>{totalFiles} files</div>
      </div>
    </div>
  )
}
