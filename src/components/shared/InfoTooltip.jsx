import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Ikon (i) dengan bubble keterangan.
 * Bubble dirender lewat portal ke document.body supaya tidak terpotong
 * oleh card yang punya `overflow-hidden` / `backdrop-blur`.
 */
export default function InfoTooltip({ text }) {
  const btnRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const BUBBLE_WIDTH = 300;

  const show = useCallback(() => {
    if (!btnRef.current) return;

    const rect = btnRef.current.getBoundingClientRect();
    // Jaga bubble tetap di dalam viewport (jangan sampai keluar layar kanan).
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - BUBBLE_WIDTH - 8),
    );

    setCoords({ top: rect.bottom + 10, left });
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={show}
        aria-label="Keterangan"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-600 transition-colors hover:bg-slate-900 hover:text-white"
      >
        i
      </button>

      {visible && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 9999,
            width: BUBBLE_WIDTH,
          }}
          className="rounded-xl bg-slate-900 px-4 py-3 text-[13px] font-medium leading-relaxed text-white shadow-2xl pointer-events-none"
        >
          <span
            style={{
              position: 'absolute',
              top: -5,
              left: 12,
              width: 10,
              height: 10,
              background: '#0f172a',
              transform: 'rotate(45deg)',
              borderRadius: 2,
            }}
          />
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}
