import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Printer, ShieldCheck, Clock, GraduationCap } from 'lucide-react';
import { informationCenterAPI, schoolAPI } from '../../../utils/api';
import TranscriptPrintModal from '../AdminAkademik/components/Transition/TranscriptPrintModal';

/**
 * Read-only alumni portal shown while an alumnus is still inside the 6-month
 * grace window. No access to attendance, KBM, CBT, or chat — only the
 * graduation card, remaining portal time, alumni announcements and the
 * temporary transcript download/print.
 */
const AlumniPortal = ({ user }) => {
  const [school, setSchool] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [printOpen, setPrintOpen] = useState(false);

  const daysRemaining = Number.isFinite(user?.alumni_days_remaining) ? user.alumni_days_remaining : null;

  useEffect(() => {
    schoolAPI.getProfile().then(({ data }) => setSchool(data?.data ?? data ?? null)).catch(() => {});
    informationCenterAPI.getInfos({ per_page: 5 })
      .then(({ data }) => setAnnouncements(Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 animate-fadeIn">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Banner sisa masa aktif */}
        <div className="flex items-center gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><Clock size={28} /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Portal Alumni (Read-Only)</p>
            <p className="text-lg font-black text-amber-900">
              {daysRemaining !== null ? `Sisa masa aktif akses portal: ${daysRemaining} hari` : 'Akses portal alumni aktif'}
            </p>
            <p className="mt-1 text-xs font-medium text-amber-700">
              Setelah masa tenggang 6 bulan berakhir, akses portal ditutup. Transkrip resmi dapat diminta ke Tata Usaha / Admin Akademik.
            </p>
          </div>
        </div>

        {/* Kartu identitas kelulusan */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white"><GraduationCap size={22} /></div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Identitas Kelulusan</h2>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field label="Nama" value={user?.name} />
            <Field label="NISN" value={user?.nisn_nip || user?.nisn} />
            <Field label="Kompetensi Keahlian" value={user?.study_program} />
            <Field label="Tahun Lulus" value={user?.enrollment_year} />
          </dl>
        </div>

        {/* Tombol transkrip */}
        <button onClick={() => setPrintOpen(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700">
          <Printer size={16} /> Lihat & Unduh Transkrip Sementara
        </button>

        {/* Pengumuman alumni */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><ShieldCheck size={22} /></div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Pengumuman</h2>
          </div>
          {announcements.length === 0 ? (
            <p className="text-xs italic text-slate-400">Belum ada pengumuman.</p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id} className="border-b border-slate-100 pb-3">
                  <p className="text-sm font-bold text-slate-800">{a.title}</p>
                  {a.created_at && <p className="text-[11px] text-slate-400">{new Date(a.created_at).toLocaleDateString('id-ID')}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {printOpen && user?.alumni_id
        ? <TranscriptPrintModal alumniId={user.alumni_id} onClose={() => setPrintOpen(false)} />
        : (printOpen
          ? <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 p-4">
              <div className="rounded-2xl bg-white p-6 text-center text-sm font-bold text-slate-600">
                Transkrip alumni tidak tersedia untuk akun ini.
                <button onClick={() => setPrintOpen(false)} className="mt-4 block w-full rounded-xl bg-slate-100 py-2">Tutup</button>
              </div>
            </div>
          : null)}
    </div>
  );
};

const Field = ({ label, value }) => (
  <div className="flex gap-2">
    <dt className="w-40 shrink-0 text-slate-500">{label}</dt>
    <dd className="font-bold text-slate-800">: {value || '—'}</dd>
  </div>
);

export default AlumniPortal;
