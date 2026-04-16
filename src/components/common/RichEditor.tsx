// ═══ RICH EDITOR — Simple formatting: bold, italic, list ═══
import { useRef, useEffect } from 'preact/hooks';
import { Icon } from './Icon';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichEditor({ value, onChange, placeholder = 'Escribe aquí…' }: RichEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Sync external value changes (only if not from our own edits)
  useEffect(() => {
    if (!ref.current || isInternalChange.current) { isInternalChange.current = false; return; }
    if (ref.current.innerHTML !== value) ref.current.innerHTML = value || '';
  }, [value]);

  const handleInput = () => {
    if (!ref.current) return;
    isInternalChange.current = true;
    onChange(ref.current.innerHTML);
  };

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    ref.current?.focus();
    handleInput();
  };

  const btnStyle = (active: boolean) => ({
    width: 28, height: 28, borderRadius: 6, border: 'none',
    background: active ? '#007AFF15' : 'transparent',
    color: active ? '#007AFF' : '#86868B',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <div style={{ border: '1.5px solid #E5E5EA', borderRadius: 10, overflow: 'hidden', background: '#FAFAFA' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 2, padding: '4px 6px', borderBottom: '1px solid #F2F2F7', background: '#FFF' }}>
        <button type="button" onClick={() => exec('bold')} style={btnStyle(document.queryCommandState('bold'))} title="Negrita">
          <Icon name="Bold" size={13} color="currentColor" />
        </button>
        <button type="button" onClick={() => exec('italic')} style={btnStyle(document.queryCommandState('italic'))} title="Cursiva">
          <Icon name="Italic" size={13} color="currentColor" />
        </button>
        <button type="button" onClick={() => exec('insertUnorderedList')} style={btnStyle(document.queryCommandState('insertUnorderedList'))} title="Lista">
          <Icon name="List" size={13} color="currentColor" />
        </button>
        <div style={{ width: 1, background: '#F2F2F7', margin: '2px 4px' }} />
        <button type="button" onClick={() => exec('removeFormat')} style={btnStyle(false)} title="Limpiar formato">
          <Icon name="RemoveFormatting" size={13} color="currentColor" />
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        style={{
          minHeight: 80, padding: '10px 12px', fontSize: 13, lineHeight: 1.6,
          outline: 'none', color: '#1D1D1F', fontFamily: 'inherit',
          overflowY: 'auto', maxHeight: 200,
        }}
        dangerouslySetInnerHTML={{ __html: value || '' }}
      />

      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #C7C7CC;
          pointer-events: none;
        }
        [contenteditable] ul, [contenteditable] ol { padding-left: 20px; margin: 4px 0; }
        [contenteditable] li { margin-bottom: 2px; }
      `}</style>
    </div>
  );
}
