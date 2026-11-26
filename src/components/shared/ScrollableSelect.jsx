import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

export default function ScrollableSelect({ value, onChange, options = [], placeholder = '-- Pilih --' }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const updateScrollState = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setCanUp(el.scrollTop > 0);
    setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = 0;
    updateScrollState();
  }, [open, updateScrollState]);

  const openList = () => {
    setActive(options.findIndex(o => o.value === value));
    setOpen(true);
  };

  const choose = (o) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const scrollList = (dir) => listRef.current?.scrollBy({ top: dir * 120, behavior: 'smooth' });

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(Math.max(active + (e.key === 'ArrowDown' ? 1 : -1), 0), options.length - 1);
      setActive(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
    }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) choose(options[active]); }
  };

  const navBtn = 'w-full py-1.5 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400';

  return (
    <div ref={wrapRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        className={`w-full px-4 py-3.5 bg-white border rounded-xl text-[13px] font-bold text-[#0f172a] flex items-center justify-between gap-3 transition-all focus:outline-none ${open ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`flex items-center gap-2.5 min-w-0 ${selected ? '' : 'text-slate-400'}`}>
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/60 overflow-hidden" role="listbox">
          <button type="button" tabIndex={-1} onClick={() => scrollList(-1)} disabled={!canUp} className={`${navBtn} border-b border-slate-100`} aria-label="Geser ke atas">
            <ChevronUp className="w-4 h-4" />
          </button>
          <div
            ref={listRef}
            onScroll={updateScrollState}
            className="max-h-44 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent"
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                tabIndex={-1}
                onClick={() => choose(o)}
                onMouseEnter={() => setActive(i)}
                disabled={Boolean(o.disabled)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] font-bold transition-colors ${
                  o.disabled ? 'text-slate-300 cursor-not-allowed' : o.value === value ? 'bg-blue-50 text-blue-700' : i === active ? 'bg-blue-50/60 text-[#0f172a]' : 'text-[#0f172a]'
                }`}
              >
                <span className="flex-1">{o.label}</span>
                {o.value === value && <Check className="w-4 h-4 shrink-0 text-blue-600" />}
              </button>
            ))}
          </div>
          <button type="button" tabIndex={-1} onClick={() => scrollList(1)} disabled={!canDown} className={`${navBtn} border-t border-slate-100`} aria-label="Geser ke bawah">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
