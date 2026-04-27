import { useRef, useCallback } from 'react'
import { Bold, Italic, List, Link2, Code, Heading2 } from 'lucide-react'

// ── Rich text display (renders HTML safely) ──
export function RichTextDisplay({ html, className }: { html: string; className?: string }) {
  if (!html) return null
  // Sanitize: only allow basic tags
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}

// ── Rich text editor with toolbar ──
interface RichEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: number
}

export function RichEditor({ value, onChange, placeholder, className, minHeight = 80 }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    if (editorRef.current) onChange(editorRef.current.innerHTML)
    editorRef.current?.focus()
  }, [onChange])

  const handleLink = () => {
    const url = prompt('URL del enlace:')
    if (url) exec('createLink', url)
  }

  const ToolBtn = ({ icon: Icon, cmd, title }: { icon: typeof Bold; cmd: string; title: string }) => (
    <button type="button" onMouseDown={e => { e.preventDefault(); exec(cmd) }} title={title}
      className="w-6 h-6 rounded flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C] transition-colors">
      <Icon className="w-3 h-3" />
    </button>
  )

  return (
    <div className={`rounded-lg border border-revelio-border dark:border-revelio-dark-border overflow-hidden ${className || ''}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-revelio-border/50 dark:border-revelio-dark-border/50 bg-[#FAFAFA] dark:bg-[#2C2C2E]">
        <ToolBtn icon={Bold} cmd="bold" title="Negrita (Ctrl+B)" />
        <ToolBtn icon={Italic} cmd="italic" title="Cursiva (Ctrl+I)" />
        <div className="w-px h-3.5 bg-revelio-border dark:bg-revelio-dark-border mx-0.5" />
        <ToolBtn icon={List} cmd="insertUnorderedList" title="Lista" />
        <ToolBtn icon={Heading2} cmd="formatBlock" title="Título" />
        <div className="w-px h-3.5 bg-revelio-border dark:bg-revelio-dark-border mx-0.5" />
        <button type="button" onMouseDown={e => { e.preventDefault(); handleLink() }} title="Enlace"
          className="w-6 h-6 rounded flex items-center justify-center text-[#8E8E93] hover:text-[#007AFF] hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C] transition-colors">
          <Link2 className="w-3 h-3" />
        </button>
        <button type="button" onMouseDown={e => { e.preventDefault(); exec('formatBlock', 'pre') }} title="Código"
          className="w-6 h-6 rounded flex items-center justify-center text-[#8E8E93] hover:text-[#AF52DE] hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C] transition-colors">
          <Code className="w-3 h-3" />
        </button>
      </div>

      {/* Editable area */}
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        className="px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text [&_b]:font-semibold [&_i]:italic [&_a]:text-[#007AFF] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1 [&_pre]:bg-[#F2F2F7] [&_pre]:dark:bg-[#3A3A3C] [&_pre]:rounded [&_pre]:px-2 [&_pre]:py-1 [&_pre]:text-[#AF52DE] [&_pre]:font-mono [&_pre]:text-[10px] [&_pre]:my-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1"
        style={{ minHeight }}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML) }}
        onFocus={() => { if (editorRef.current && !editorRef.current.innerHTML && placeholder) editorRef.current.dataset.empty = 'true' }}
        data-placeholder={placeholder}
      />

      <style>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #8E8E93; pointer-events: none; }
      `}</style>
    </div>
  )
}
