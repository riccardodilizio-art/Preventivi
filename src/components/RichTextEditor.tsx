import { useRef, useCallback, useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  Palette,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  RemoveFormatting,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const COLORS = [
  '#000000', '#DC2626', '#EA580C', '#CA8A04',
  '#16A34A', '#2563EB', '#7C3AED', '#DB2777',
] as const;

const HIGHLIGHT_COLORS = [
  '#FEF08A', '#BBF7D0', '#BFDBFE', '#E9D5FF',
  '#FECDD3', '#FED7AA', '#FFFFFF',
] as const;

type CommandArg = string | undefined;

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
}

function ColorPicker({
  colors,
  onSelect,
  title,
  icon,
}: {
  colors: readonly string[];
  onSelect: (color: string) => void;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        title={title}
        className="p-1.5 rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      >
        {icon}
      </button>
      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 hidden group-hover:grid grid-cols-4 gap-1 z-50 min-w-[120px]">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(color)}
            className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  // Imposta il contenuto HTML solo al primo mount
  useEffect(() => {
    if (editorRef.current && value) {
      editorRef.current.innerHTML = value;
      updateIsEmpty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateIsEmpty = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.textContent ?? '';
    setIsEmpty(text.trim() === '');
  };

  const execCommand = useCallback((command: string, arg?: CommandArg) => {
    // Ripristina il focus sull'editor prima di eseguire il comando
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      updateIsEmpty();
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      updateIsEmpty();
    }
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, html || text);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      updateIsEmpty();
    }
  }, [onChange]);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <ToolbarButton onClick={() => execCommand('bold')} title="Grassetto">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('italic')} title="Corsivo">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('underline')} title="Sottolineato">
          <Underline className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ColorPicker
          colors={COLORS}
          onSelect={(color) => execCommand('foreColor', color)}
          title="Colore testo"
          icon={<Palette className="w-4 h-4" />}
        />
        <ColorPicker
          colors={HIGHLIGHT_COLORS}
          onSelect={(color) => execCommand('hiliteColor', color)}
          title="Evidenzia"
          icon={<Highlighter className="w-4 h-4" />}
        />

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="Elenco puntato">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="Elenco numerato">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton onClick={() => execCommand('justifyLeft')} title="Allinea a sinistra">
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('justifyCenter')} title="Allinea al centro">
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('justifyRight')} title="Allinea a destra">
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton onClick={() => execCommand('undo')} title="Annulla">
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('redo')} title="Ripeti">
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('removeFormat')} title="Rimuovi formattazione">
          <RemoveFormatting className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div className="relative">
        {isEmpty && placeholder && (
          <div className="absolute top-0 left-0 px-4 py-3 text-gray-400 pointer-events-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          className="min-h-[120px] px-4 py-3 outline-none text-sm leading-relaxed"
        />
      </div>
    </div>
  );
}
