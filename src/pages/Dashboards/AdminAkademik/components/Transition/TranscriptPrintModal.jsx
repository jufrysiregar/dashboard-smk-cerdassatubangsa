import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Loader2, Printer, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { alumniAPI, schoolAPI } from '../../../../../utils/api';
import useEscapeKey from '../../../../../utils/useEscapeKey';

const SEM_COLS = [1, 2, 3, 4, 5, 6];

/**
 * Official SMK transcript print view. Renders through a portal so it is never
 * trapped by a transformed/backdrop ancestor, and prints cleanly (only the
 * document shows; sidebar & navbar are hidden via @media print).
 */
const TranscriptPrintModal = ({ alumniId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState(null);

  useEscapeKey(true, onClose);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      alumniAPI.getTranscript(alumniId),
      schoolAPI.getProfile().catch(() => null),
    ])
      .then(([t, s]) => {
        if (!alive) return;
        setData(t?.data ?? null);
        setSchool(s?.data ?? s ?? null);
      })
      .catch((err) => toast.error(err?.response?.data?.message || 'Gagal memuat transkrip alumni.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [alumniId]);

  const profil = data?.profil || {};
  const nilai = Array.isArray(data?.nilai_semester) ? data.nilai_semester : [];
  const prestasi = Array.isArray(data?.prestasi_lomba) ? data.prestasi_lomba : [];
  const kepsek = data?.kepala_sekolah || null;

  const body = (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-slate-900/60 backdrop-blur-sm">
      <div className="m-auto flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl printDocument">
        {/* toolbar (not printed) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 no-print">
          <span className="text-sm font-black text-slate-700">Transkrip Nilai & Rekam Jejak Kompetensi</span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white disabled:bg-slate-200">
              <Printer size={14} /> Cetak / PDF
            </button>
            <button onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 printArea">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" /></div>
          ) : (
            <div className="mx-auto max-w-3xl text-[13px] text-slate-800">
              {/* KOP */}
              <header className="border-b-4 border-double border-slate-800 pb-4 text-center">
                <h1 className="text-lg font-black tracking-tight">{school?.school_name || 'SMK'}</h1>
                {school?.school_address && <p className="text-[11px] text-slate-600">{school.school_address}</p>}
                <p className="mt-2 text-sm font-black uppercase tracking-wide">Transkrip Nilai & Rekam Jejak Kompetensi Lulusan SMK</p>
              </header>

              {/* IDENTITAS */}
              <section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1">
                <Field label="Nama Lengkap" value={profil.nama_lengkap} />
                <Field label="NISN" value={profil.nisn} />
                <Field label="Kompetensi Keahlian / Jurusan" value={profil.jurusan_nama || profil.jurusan} />
                <Field label="Tahun Lulus" value={profil.tahun_lulus} />
              </section>

              {/* TABEL NILAI 6 SEMESTER */}
              <section className="mt-5">
                <h2 className="mb-1 text-xs font-black uppercase">Nilai Akademik 6 Semester</h2>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-center">
                      <th className="border border-slate-300 px-2 py-1">No</th>
                      <th className="border border-slate-300 px-2 py-1 text-left">Mata Pelajaran</th>
                      {SEM_COLS.map((c) => <th key={c} className="border border-slate-300 px-2 py-1">Smt {c}</th>)}
                      <th className="border border-slate-300 px-2 py-1">Rata-Rata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nilai.length === 0 && (
                      <tr><td className="border border-slate-300 px-2 py-3 text-center italic text-slate-400" colSpan={SEM_COLS.length + 3}>Tidak ada data nilai tersimpan.</td></tr>
                    )}
                    {nilai.map((r, i) => (
                      <tr key={i}>
                        <td className="border border-slate-300 px-2 py-1 text-center">{i + 1}</td>
                        <td className="border border-slate-300 px-2 py-1">{r.nama_mapel || '—'}</td>
                        {SEM_COLS.map((c) => <td key={c} className="border border-slate-300 px-2 py-1 text-center">{fmt(r['smt_' + c])}</td>)}
                        <td className="border border-slate-300 px-2 py-1 text-center font-bold">{fmt(r.rata_rata_mapel)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black">
                      <td className="border border-slate-300 px-2 py-1 text-center" colSpan={SEM_COLS.length + 2}>Nilai Rata-Rata Akhir Keseluruhan</td>
                      <td className="border border-slate-300 px-2 py-1 text-center">{fmt(data?.rata_rata_akhir)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* NILAI PLUS */}
              <section className="mt-5">
                <h2 className="mb-1 text-xs font-black uppercase">Nilai Plus — Riwayat Program & Prestasi Lomba (Bukti Resmi Sekolah)</h2>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-center">
                      <th className="border border-slate-300 px-2 py-1">No</th>
                      <th className="border border-slate-300 px-2 py-1 text-left">Nama Program / Lomba / Sertifikasi</th>
                      <th className="border border-slate-300 px-2 py-1">Capaian / Predikat</th>
                      <th className="border border-slate-300 px-2 py-1">Tahun</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prestasi.length === 0 && (
                      <tr><td className="border border-slate-300 px-2 py-3 text-center italic text-slate-400" colSpan={4}>Belum ada riwayat program/prestasi.</td></tr>
                    )}
                    {prestasi.map((p, i) => (
                      <tr key={i}>
                        <td className="border border-slate-300 px-2 py-1 text-center">{i + 1}</td>
                        <td className="border border-slate-300 px-2 py-1">{p.nama_kegiatan || '—'}</td>
                        <td className="border border-slate-300 px-2 py-1 text-center">{p.capaian || '—'}</td>
                        <td className="border border-slate-300 px-2 py-1 text-center">{p.tahun || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* PENGESAHAN — hanya Kepala Sekolah aktif */}
              <section className="mt-8 flex justify-end">
                <div className="w-72 text-center">
                  <p>Ditetapkan di Medan</p>
                  <p>Tanggal: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  <p className="mt-1 font-black">Kepala Sekolah,</p>
                  <div className="h-20" />
                  <p className="font-black underline">{kepsek?.name || '(Kepala Sekolah belum ditetapkan)'}</p>
                  <p className="text-[11px]">NIP. {kepsek?.nip || kepsek?.nip || '-'}</p>
                  {kepsek?.gelar && <p className="text-[11px] text-slate-600">{kepsek.gelar}</p>}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .printDocument, .printDocument * { visibility: visible !important; }
          .printDocument { position: absolute; inset: 0; margin: 0; max-height: none !important; max-width: none !important; border-radius: 0 !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>
    </div>
  );

  return createPortal(body, document.body);
};

const Field = ({ label, value }) => (
  <div className="flex gap-2">
    <span className="w-52 shrink-0 text-slate-500">{label}</span>
    <span className="font-bold">: {value || '—'}</span>
  </div>
);

const fmt = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));

export default TranscriptPrintModal;
