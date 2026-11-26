import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Package, Building2, Undo2 } from 'lucide-react';
import ModalCloseControl from './ModalCloseControl';

/**
 * FasilitasItemDetail — komponen presentasi BERSAMA untuk daftar item Fasilitas
 * (dipakai Admin Akademik/Operator & Pusat Jurusan) agar desain item identik:
 *  - QtyBadges: 5 badge rincian kuantitas (Baik, Rusak, Dipinjam, Perbaikan, Hilang).
 *  - FasilitasDetailModal: rincian lengkap 1 barang + daftar peminjam aktif + aksi Kembalikan.
 * 100% data DB nyata — tidak ada nilai dummy.
 */

const QTY_META = [
  { key: 'qty_baik', label: 'Baik', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  { key: 'qty_rusak', label: 'Rusak', cls: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  { key: 'qty_dipinjam', label: 'Dipinjam', cls: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  { key: 'qty_perbaikan', label: 'Perbaikan', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { key: 'qty_hilang', label: 'Hilang', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
];

/** 5 badge rincian kuantitas. `size` = 'sm' (kartu) | 'md' (modal). */
export function QtyBadges({ item, size = 'sm' }) {
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {QTY_META.map((m) => (
        <span key={m.key} className={`inline-flex items-center gap-1.5 rounded-lg ${m.cls} ${pad} font-black uppercase tracking-wide`}>
          <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
          {m.label}: <span className="tabular-nums">{Number(item?.[m.key] ?? 0)}</span>
        </span>
      ))}
    </div>
  );
}

/** Baris catatan kondisi/peminjam (satu sumber teks nyata: status_note > peminjam aktif > notes). */
export function ItemCatatan({ item, activeCount }) {
  const note = item?.status_note;
  if (note) return <p className="text-[11px] font-semibold italic text-slate-500">Catatan: {note}</p>;
  if (activeCount > 0) return <p className="text-[11px] font-semibold italic text-slate-500">{activeCount} peminjaman aktif pada barang ini.</p>;
  if (item?.notes) return <p className="text-[11px] font-semibold italic text-slate-500">Catatan: {item.notes}</p>;
  return null;
}

const fmtTanggal = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * Modal DETAIL satu barang: identitas + Jenis Pengadaan + Total Unit + Catatan +
 * 5 badge rincian + daftar peminjam aktif (dengan aksi Kembalikan bila diizinkan).
 *
 * @param item            baris inventaris (formatInventory).
 * @param borrowings      seluruh baris peminjaman (formatBorrowing) — difilter per item di sini.
 * @param canKembalikan   (borrowing)=>boolean — otorisasi tombol Kembalikan (diserahkan ke induk).
 * @param onKembalikan    async (borrowing)=>void.
 * @param savingId        id peminjaman yang sedang diproses (untuk spinner).
 */
export function FasilitasDetailModal({ item, type = 'inventaris', borrowings = [], canKembalikan, onKembalikan, savingId, onClose }) {
  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [item, onClose]);

  if (!item) return null;

  const loanKey = type === 'ruangan' ? 'learning_room_id' : 'inventory_id';
  const aktif = (borrowings || []).filter((b) => String(b[loanKey]) === String(item.id) && b.status !== 'dikembalikan');

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl" />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4" style={{ backgroundColor: '#F1F5F9' }}>
          <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
            {type === 'ruangan' ? <Building2 className="h-4 w-4 text-indigo-600" /> : <Package className="h-4 w-4 text-indigo-600" />} Detail {type === 'ruangan' ? 'Ruangan' : 'Barang'}
          </h3>
          <div className="flex items-center gap-2">
            <ModalCloseControl onClose={onClose} />
          </div>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          <div>
            <p className="text-lg font-black text-slate-900">{item.nama}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold text-slate-500">
              {type === 'ruangan' ? (
                <>
                  <span>{item.tipe || 'Ruangan'}</span>
                  <span className="text-slate-300">·</span>
                  <span>Kapasitas: {Number(item.kapasitas ?? 0)} orang</span>
                </>
              ) : (
                <>
                  <span>Jenis Pengadaan: {item.funding_source_label || item.kategori || '—'}</span>
                  <span className="text-slate-300">·</span>
                  <span>Total Unit: {Number(item.jumlah ?? 0)} {item.unit || 'unit'}</span>
                </>
              )}
              <span className="text-slate-300">·</span>
              <span>{item.kepemilikan === 'umum' ? 'Fasilitas Umum' : (item.jurusan ? `Jurusan ${item.jurusan}` : 'Fasilitas Jurusan')}</span>
            </div>
          </div>

          {type === 'ruangan' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Isi / Peletakan Ruangan</p>
              {(item.contents || []).length === 0 ? (
                <p className="text-[12px] font-bold text-slate-400">Belum ada fasilitas di dalam ruangan ini.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(item.contents || []).map((c, idx) => <span key={idx} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{c.name} × {c.quantity}</span>)}
                </div>
              )}
              {item.notes && <p className="mt-2 text-[11px] font-semibold italic text-slate-500">Catatan: {item.notes}</p>}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Rincian Kondisi</p>
              <QtyBadges item={item} size="md" />
              {item.status_note && <p className="mt-2 text-[11px] font-semibold italic text-slate-500">Catatan: {item.status_note}</p>}
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-500">Peminjaman Aktif ({aktif.length})</p>
            {aktif.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-bold text-slate-400">Tidak ada peminjaman aktif pada item ini.</p>
            ) : (
              <div className="space-y-2">
                {aktif.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-slate-800">
                        Dipinjam {b.jurusan || 'Operator'}: <span className="tabular-nums">{Number(b.jumlah || 0)}</span> unit
                      </p>
                      <p className="text-[11px] font-bold text-slate-500">
                        PJ: {b.peminjam_nama || '—'} · Pinjam {fmtTanggal(b.tanggal_pinjam)} · Kembali {fmtTanggal(b.tanggal_kembali)}
                      </p>
                      {b.keperluan && <p className="text-[11px] font-semibold italic text-slate-400">Keperluan: {b.keperluan}</p>}
                    </div>
                    {b.inventory_id && canKembalikan?.(b) && (
                      <button
                        onClick={() => onKembalikan?.(b)}
                        disabled={savingId === b.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-[11px] font-black uppercase text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                      >
                        {savingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                        Kembalikan
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 px-6 py-4" style={{ backgroundColor: '#F1F5F9' }}>
          <button onClick={onClose} className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50">Tutup</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
