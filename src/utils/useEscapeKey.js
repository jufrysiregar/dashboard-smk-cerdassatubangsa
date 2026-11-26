import { useEffect } from 'react';

/**
 * Daftarkan listener keydown global yang memanggil `onEscape` saat tombol Escape ditekan,
 * hanya selama `active` bernilai benar. Handler memakai ref agar tidak perlu di-rebind
 * tiap render (menghindari stale closure tanpa memicu re-registrasi listener).
 */
export default function useEscapeKey(active, onEscape) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, onEscape]);
}
