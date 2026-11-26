import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Printer, Search, Trophy, X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { alumniAPI } from '../../../../../utils/api';
import ModalCloseControl from '../../../../../components/dashboard/shared/ModalCloseControl';
import useEscapeKey from '../../../../../utils/useEscapeKey';
import TranscriptPrintModal from './TranscriptPrintModal';

const emptyRow = () => ({ nama_kegiatan: '', capaian: '', tingkat: '', tahun: '' });

const AlumniDirectoryPanel = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [jurusan, setJurusan] = useState('');
  const [tahun, setTahun] = useState('');
  const [printId, setPrintId] = useState(null);
  const [editRow, setEditRow] = useState(null); // alumni object for achievements editor

  const reload = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (jurusan) params.jurusan = jurusan;
      if (tahun) params.tahun_lulus = tahun;
      const { data } = await alumniAPI.list(params);
      setRows(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal memuat direktori alumni.');
    } finally {
      setLoading(false);
    }
  };

  const reloadRef = reload;
  useEffect(() => { reloadRef(); }, []); // eslint-disable-line

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && reload()}
            placeholder="Cari Nama / NISN…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" />
        </label>
        <input value={jurusan} onChange={(e) => setJurusan(e.target.value)} placeholder="Jurusan" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" />
        <input value={tahun} onChange={(e) => setTahun(e.target.value)} placeholder="Tahun Lulus" inputMode="numeric" className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" />
      </div>
      <button onClick={reload} className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-md hover:opacity-95">Terapkan</button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400 italic">Belum ada data alumni.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Nama</th><th className="px-4 py-3">NISN</th>
                <th className="px-4 py-3">Jurusan</th><th className="px-4 py-3">Tahun</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-800">{r.nama_lengkap}</td>
                  <td className="px-4 py-3 text-slate-600">{r.nisn || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.jurusan_nama || r.jurusan || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.tahun_lulus || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditRow(r)} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-amber-700 hover:bg-amber-100"><Trophy size={12} /> Prestasi</button>
                      <button onClick={() => setPrintId(r.id)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-indigo-700 hover:bg-indigo-100"><Printer size={12} /> Transkrip</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {editRow && <AchievementsEditor row={editRow} onClose={() => setEditRow(null)} onSaved={() => { setEditRow(null); reload(); }} />}
      </AnimatePresence>

      {printId && createPortal(
        <TranscriptPrintModal alumniId={printId} onClose={() => setPrintId(null)} />,
        document.body
      )}
    </section>
  );
};

/** Kelola daftar Program / Prestasi Lomba (PUT /alumni/{id}/achievements). */
const AchievementsEditor = ({ row, onClose, onSaved }) => {
  const [items, setItems] = useState(Array.isArray(row.prestasi_lomba) ? row.prestasi_lomba : []);
  const [saving, setSaving] = useState(false);
  useEscapeKey(onClose, true);

  const set = (i, key, val) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));

  const save = async () => {
    setSaving(true);
    try {
      await alumniAPI.updateAchievements(row.id, { prestasi_lomba: items.filter((it) => it.nama_kegiatan.trim()) });
      toast.success('Riwayat prestasi/lomba alumni tersimpan.');
      onSaved?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan prestasi alumni.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-sm font-black text-slate-700">Kelola Prestasi / Lomba — {row.nama_lengkap}</span>
          <ModalCloseControl onClose={onClose} />
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
          {items.length === 0 && <p className="text-xs italic text-slate-400">Belum ada riwayat. Tambahkan program/prestasi resmi.</p>}
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-2">
              <input value={it.nama_kegiatan} onChange={(e) => set(i, 'nama_kegiatan', e.target.value)} placeholder="Nama Program / Lomba" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input value={it.capaian} onChange={(e) => set(i, 'capaian', e.target.value)} placeholder="Capaian / Predikat" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input value={it.tingkat} onChange={(e) => set(i, 'tingkat', e.target.value)} placeholder="Tingkat" className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input value={it.tahun} onChange={(e) => set(i, 'tahun', e.target.value)} placeholder="Tahun" inputMode="numeric" className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <button onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="rounded-lg p-2 text-rose-400 hover:bg-rose-50"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => setItems((prev) => [...prev, emptyRow()])} className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-indigo-600"><Plus size={14} /> Tambah</button>
        </div>

        <div className="border-t border-slate-200 bg-[#F1F5F9] px-5 py-4">
          <button onClick={save} disabled={saving} className="w-full rounded-xl bg-amber-500 py-3 text-xs font-black uppercase tracking-widest text-white disabled:bg-slate-200">
            {saving ? 'Menyimpan…' : 'Simpan Prestasi'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default AlumniDirectoryPanel;
