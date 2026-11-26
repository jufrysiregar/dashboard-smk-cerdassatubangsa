import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

/** Parse "DD/MM/YYYY" → Date or null */
function parseDisplay(str) {
  if (!str || str.length !== 10) return null;
  const [d, m, y] = str.split('/').map(Number);
  if (!d || !m || !y || y < 1900) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** Parse "YYYY-MM-DD" → Date or null */
function parseISO(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Date → "YYYY-MM-DD" */
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Date → "DD/MM/YYYY" */
function toDisplay(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

// Clamp day ke akhir bulan target (31 Agu + 6 bulan → 28/29 Feb, bukan rollover ke Mar)
function addMonthsClamped(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
  d.setDate(Math.min(date.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

/** Build calendar grid for a given month/year */
function buildCalendar(year, month) {
  const first = new Date(year, month, 1).getDay(); // 0=Sun
  const days  = new Date(year, month + 1, 0).getDate();
  const grid  = [];
  let row = [];

  // Leading empty cells
  for (let i = 0; i < first; i++) row.push(null);

  for (let d = 1; d <= days; d++) {
    row.push(d);
    if (row.length === 7) { grid.push(row); row = []; }
  }
  if (row.length) {
    while (row.length < 7) row.push(null);
    grid.push(row);
  }
  return grid;
}

export default function DatePickerInput({
  value      = '',
  onChange,
  placeholder = 'dd/mm/yyyy',
  disabled   = false,
  minYear    = 1900,
  maxYear    = new Date().getFullYear(),
  popup      = true,
  minDate    = '',
  durationFrom,
}) {
  const today  = new Date();
  const init   = parseISO(value) || today;
  const initViewY = Math.min(Math.max(init.getFullYear(), minYear), maxYear);

  const [text,   setText]   = useState(value ? toDisplay(parseISO(value)) : '');
  const [open,   setOpen]   = useState(false);
  const [viewY,  setViewY]  = useState(initViewY);
  const [viewM,  setViewM]  = useState(init.getMonth());
  const [mode,   setMode]   = useState('day'); // 'day' | 'month' | 'year'

  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Sync external value → text
  useEffect(() => {
    const d = parseISO(value);
    setText(d ? toDisplay(d) : '');
    if (d) { setViewY(Math.min(Math.max(d.getFullYear(), minYear), maxYear)); setViewM(d.getMonth()); }
  }, [value]);

  // Close on outside click (popup lives in a portal, so check both refs)
  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && wrapRef.current.contains(e.target)) return;
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  // Fixed positioning via portal: escape the modal's overflow clipping.
  // Flip above the input when there's no room below, clamp to the viewport,
  // and follow the input while any ancestor scrolls.
  useLayoutEffect(() => {
    if (!open || disabled) return;
    const update = () => {
      const wrap = wrapRef.current;
      const popup = popupRef.current;
      if (!wrap || !popup) return;
      const rect = wrap.getBoundingClientRect();
      const w = popup.offsetWidth;
      const h = popup.offsetHeight;
      const m = 8, gap = 8;
      const left = Math.min(Math.max(rect.left, m), Math.max(m, window.innerWidth - w - m));
      let top = rect.bottom + gap;
      if (top + h > window.innerHeight - m) {
        const above = rect.top - h - gap;
        top = above >= m ? above : Math.max(m, window.innerHeight - h - m);
      }
      setPos(prev => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, disabled, mode, viewY, viewM]);

  // ── Text input ──────────────────────────────────────────────────────────────
  const handleTextChange = (e) => {
    let v = e.target.value.replace(/[^\d/]/g, '');
    // Auto-slash
    if (/^\d{2}$/.test(v) && !text.endsWith('/'))  v += '/';
    if (/^\d{2}\/\d{2}$/.test(v) && !text.endsWith('/')) v += '/';
    if (v.length > 10) return;
    setText(v);
    if (v.length === 10) {
      const d = parseDisplay(v);
      if (d && d.getFullYear() >= minYear && d.getFullYear() <= maxYear && (!minD || d >= minD)) { onChange(toISO(d)); setViewY(d.getFullYear()); setViewM(d.getMonth()); }
    }
    if (v === '') onChange('');
  };

  // ── Day picker ───────────────────────────────────────────────────────────────
  const selectDay = useCallback((d) => {
    const date = new Date(viewY, viewM, d);
    if (date.getFullYear() < minYear || date.getFullYear() > maxYear) return;
    const min = parseISO(minDate);
    if (min && date < min) return;
    setText(toDisplay(date));
    onChange(toISO(date));
    setOpen(false);
  }, [viewY, viewM, onChange, minYear, maxYear, minDate]);

  const atMin = viewY < minYear || (viewY === minYear && viewM === 0);
  const atMax = viewY > maxYear || (viewY === maxYear && viewM === 11);
  const prevMonth = () => { if (atMin) return; if (viewM === 0) { setViewM(11); setViewY(y => y - 1); } else setViewM(m => m - 1); };
  const nextMonth = () => { if (atMax) return; if (viewM === 11) { setViewM(0); setViewY(y => y + 1); } else setViewM(m => m + 1); };

  const selected = parseISO(value);
  const grid     = buildCalendar(viewY, viewM);
  const minD     = parseISO(minDate);

  // Year range for year picker
  const yearStart = Math.floor(viewY / 12) * 12;
  const years     = Array.from({ length: 12 }, (_, i) => yearStart + i);

  return (
    <div ref={wrapRef} className="relative">
      {/* Input */}
      <div className={`flex items-center w-full px-4 py-3.5 rounded-xl border text-[13px] font-bold transition-all ${
        disabled ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
          : open   ? 'bg-white border-blue-500 ring-2 ring-blue-500/20'
          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
      }`}>
        {popup && (
        <Calendar
          className={`w-4 h-4 mr-3 shrink-0 ${disabled ? 'text-slate-300' : 'text-blue-500 cursor-pointer'}`}
          onClick={() => !disabled && setOpen(o => !o)}
        />
        )}
        <input
          type="text"
          value={text}
          disabled={disabled}
          onChange={handleTextChange}
          onFocus={() => !disabled && popup && setOpen(true)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-bold text-[#0f172a] placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
      </div>

      {/* Popup — portal ke body supaya tidak terpotong overflow modal */}
      {open && !disabled && popup && createPortal(
        <div
          ref={popupRef}
          className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-[280px] select-none"
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
        >

          {/* ── DAY VIEW ── */}
          {mode === 'day' && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={prevMonth} disabled={atMin} className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMode('month')}
                  className="text-sm font-black text-slate-900 hover:text-blue-600 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
                >
                  {MONTHS[viewM]} {viewY}
                </button>
                <button type="button" onClick={nextMonth} disabled={atMax} className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day names */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[9px] font-black uppercase text-slate-400 py-1">{d}</div>
                ))}
              </div>

              {/* Cells */}
              {grid.map((row, ri) => (
                <div key={ri} className="grid grid-cols-7">
                  {row.map((d, ci) => {
                    const isSelected = selected && d &&
                      selected.getDate() === d &&
                      selected.getMonth() === viewM &&
                      selected.getFullYear() === viewY;
                    const isToday = d &&
                      today.getDate() === d &&
                      today.getMonth() === viewM &&
                      today.getFullYear() === viewY;
                    const beforeMin = d && minD && new Date(viewY, viewM, d) < minD;
                    return (
                      <button
                        key={ci}
                        type="button"
                        disabled={!d || beforeMin}
                        onClick={() => d && selectDay(d)}
                        className={`h-9 w-full rounded-xl text-[12px] font-bold transition-colors ${
                          !d ? 'invisible'
                            : beforeMin ? 'text-slate-300 cursor-not-allowed'
                            : isSelected ? 'bg-blue-600 text-white'
                            : isToday    ? 'ring-2 ring-blue-400 text-blue-700 hover:bg-blue-50'
                            : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                      >
                        {d || ''}
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* ── MONTH VIEW ── */}
          {mode === 'month' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setViewY(y => Math.max(minYear, y - 1))} disabled={viewY <= minYear} className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"><ChevronLeft className="w-4 h-4" /></button>
                <button type="button" onClick={() => setMode('year')} className="text-sm font-black text-slate-900 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50">{viewY}</button>
                <button type="button" onClick={() => setViewY(y => Math.min(maxYear, y + 1))} disabled={viewY >= maxYear} className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setViewM(i); setMode('day'); }}
                    className={`py-2 rounded-xl text-[11px] font-bold transition-colors ${
                      viewM === i ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-slate-700'
                    }`}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── YEAR VIEW ── */}
          {mode === 'year' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setViewY(y => Math.max(minYear, y - 12))} disabled={yearStart <= minYear} className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-black text-slate-900">{yearStart} – {yearStart + 11}</span>
                <button type="button" onClick={() => setViewY(y => Math.min(maxYear, y + 12))} disabled={yearStart + 11 >= maxYear} className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {years.map(y => (
                  <button
                    key={y}
                    type="button"
                    disabled={y < minYear || y > maxYear}
                    onClick={() => { setViewY(y); setMode('month'); }}
                    className={`py-2 rounded-xl text-[11px] font-bold transition-colors ${
                      y < minYear || y > maxYear ? 'text-slate-300 cursor-not-allowed'
                        : viewY === y ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-slate-700'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Shortcut durasi kontrak */}
          {durationFrom !== undefined && (
            <div className="mt-3 grid grid-cols-3 gap-1">
              {[{ label: '+6 Bulan', months: 6 }, { label: '+1 Tahun', months: 12 }, { label: '+2 Tahun', months: 24 }].map(s => {
                const target = addMonthsClamped(parseISO(durationFrom) || today, s.months);
                const ok = target.getFullYear() >= minYear && target.getFullYear() <= maxYear && (!minD || target >= minD);
                return (
                  <button
                    key={s.label}
                    type="button"
                    disabled={!ok}
                    onClick={() => { setText(toDisplay(target)); onChange(toISO(target)); setViewY(target.getFullYear()); setViewM(target.getMonth()); setOpen(false); }}
                    className="py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 text-[10px] font-black text-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-50"
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer: Hari ini */}
          {today.getFullYear() >= minYear && today.getFullYear() <= maxYear && (!minD || today >= minD) && (
          <button
            type="button"
            onClick={() => {
              setText(toDisplay(today));
              onChange(toISO(today));
              setViewY(today.getFullYear());
              setViewM(today.getMonth());
              setOpen(false);
            }}
            className="mt-3 w-full py-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-[11px] font-black text-slate-500 hover:text-blue-700 transition-colors border border-slate-100"
          >
            Hari Ini
          </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
