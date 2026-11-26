import React, { useEffect, useRef } from 'react';
import {
    Bold, Italic, Underline, List, ListOrdered,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from 'lucide-react';

// Editor teks ringkas berbasis contentEditable utk kolom "Jawaban Ketik Teks" tugas Esai Guru.
// Menyimpan HTML terformat (bold/italic/underline, bullet/nomor, alignment) — disanitasi backend.
const TOOLS = [
    { cmd: 'bold', icon: Bold, title: 'Tebal (Bold)' },
    { cmd: 'italic', icon: Italic, title: 'Miring (Italic)' },
    { cmd: 'underline', icon: Underline, title: 'Garis Bawah (Underline)' },
    { sep: true },
    { cmd: 'insertUnorderedList', icon: List, title: 'Daftar Bullet' },
    { cmd: 'insertOrderedList', icon: ListOrdered, title: 'Daftar Nomor' },
    { sep: true },
    { cmd: 'justifyLeft', icon: AlignLeft, title: 'Rata Kiri' },
    { cmd: 'justifyCenter', icon: AlignCenter, title: 'Rata Tengah' },
    { cmd: 'justifyRight', icon: AlignRight, title: 'Rata Kanan' },
    { cmd: 'justifyFull', icon: AlignJustify, title: 'Rata Kanan-Kiri (Justify)' },
];

const ToolButton = ({ cmd, icon: Icon, title, disabled, onExec }) => (
    <button type="button" title={title} disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onExec(cmd)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
        <Icon size={15} />
    </button>
);

const RichEssayEditor = ({ value, onChange, placeholder = 'Tulis jawabanmu di sini...', disabled = false, minHeight = 160 }) => {
    const ref = useRef(null);

    // Tulis innerHTML hanya dari LUAR (reset/resume) saat editor tidak sedang difokus,
    // supaya kursor tidak melompat ketika murid mengetik.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const next = value || '';
        if (document.activeElement !== el && el.innerHTML !== next) {
            el.innerHTML = next;
        }
    }, [value]);

    const emit = () => onChange?.(ref.current?.innerHTML || '');

    const exec = (cmd) => {
        if (disabled) return;
        ref.current?.focus();
        document.execCommand(cmd, false, null);
        emit();
    };

    return (
        <div className={`rounded-xl border bg-white transition ${disabled ? 'border-slate-200 opacity-70' : 'border-slate-200 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-50'}`}>
            <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 p-1.5">
                {TOOLS.flatMap((t, i) => t.sep
                    ? [<span key={`sep-${i}`} className="mx-1 h-5 w-px bg-slate-200" />]
                    : [<ToolButton key={t.cmd} cmd={t.cmd} icon={t.icon} title={t.title} disabled={disabled} onExec={exec} />])}
            </div>
            <div
                ref={ref}
                contentEditable={!disabled}
                suppressContentEditableWarning
                onInput={emit}
                onBlur={emit}
                data-placeholder={placeholder}
                style={{ minHeight }}
                className="rich-essay-content px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 outline-none"
            />
        </div>
    );
};

export default RichEssayEditor;
