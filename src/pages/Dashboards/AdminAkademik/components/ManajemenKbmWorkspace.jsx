import { useEffect, useState } from 'react';
import { Clock3, Filter, RefreshCw, Search } from 'lucide-react';
import { adminAkademikAPI } from '../../../../utils/api';
import { useAcademicYears } from '../../../../utils/useAcademicYears';
import MasterDataTab from './MasterDataTab';
import AttendanceTab from './AttendanceTab';
import TransisiDanArsipTab from './Transition/TransisiDanArsipTab';

const tabs = [
  { id: 'akademik', label: 'Akademik', activeClass: 'bg-indigo-600 text-white shadow-indigo-100', idleClass: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
  { id: 'kehadiran', label: 'Kehadiran', activeClass: 'bg-amber-500 text-white shadow-amber-100', idleClass: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { id: 'transisi', label: 'Transisi TA & Arsip Alumni', activeClass: 'bg-emerald-600 text-white shadow-emerald-100', idleClass: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { id: 'riwayat', label: 'Riwayat Aktivitas', activeClass: 'bg-red-600 text-white shadow-red-100', idleClass: 'bg-red-50 text-red-700 hover:bg-red-100' },
];

const actionLabel = { tambah: 'Menambahkan', ubah: 'Memperbarui', hapus: 'Menghapus' };
const moduleLabel = { akademik: 'Akademik', fasilitas: 'Fasilitas', kehadiran: 'Kehadiran' };

function ActivityHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await adminAkademikAPI.getKbmLogs({ per_page: 50, ...(filter ? { modul: filter } : {}), ...(search ? { search } : {}) });
      setLogs(response.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, [filter]);

  const formatDate = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-';

  return (
    <section className="space-y-5 p-5 sm:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">Riwayat Aktivitas</h2>
          <p className="mt-1 text-sm text-slate-500">Semua penambahan, perubahan, dan penghapusan pada workspace KBM.</p>
        </div>
        <button onClick={loadLogs} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={15} /> Muat ulang
        </button>
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row">
        <label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && loadLogs()} placeholder="Cari aktivitas atau nama pengguna..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" /></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600"><Filter size={15} /><select value={filter} onChange={(event) => setFilter(event.target.value)} className="bg-transparent py-2 outline-none"><option value="">Semua modul</option><option value="akademik">Akademik</option><option value="fasilitas">Fasilitas</option><option value="kehadiran">Kehadiran</option></select></label>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? <div className="p-10 text-center text-sm text-slate-400">Memuat riwayat aktivitas...</div> : logs.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">Belum ada aktivitas yang tercatat.</div> : <div className="divide-y divide-slate-100">{logs.map((log) => <article key={log.id} className="flex gap-4 p-4 sm:p-5"><div className="mt-1 rounded-xl bg-indigo-50 p-2 text-indigo-600"><Clock3 size={17} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">{moduleLabel[log.modul] || log.modul}</span><span className="text-xs font-bold text-slate-500">{actionLabel[log.aksi] || log.aksi}</span></div><p className="mt-2 text-sm font-semibold text-slate-800">{log.user_name || 'Pengguna sistem'}: {log.deskripsi}</p><p className="mt-1 text-xs text-slate-400">{formatDate(log.created_at)}</p></div></article>)}</div>}
      </div>
    </section>
  );
}

export default function ManajemenKbmWorkspace({ user, academicData, saranaData, teachersList, studentsList, staffList, pusatJurusanList, onSync }) {
  const [activeTab, setActiveTab] = useState('akademik');
  // Single source of truth for the Tahun Ajaran dropdown: read the official
  // list from academic_calendars (active term first) instead of hard-coded rows.
  const { terms: academicYears, activeTerm } = useAcademicYears();
  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-white">
      <div className="border-b border-slate-200 px-5 py-5 text-center sm:px-8">
        <h2 className="text-base font-black tracking-wide text-slate-900 sm:text-lg">MANAJEMEN KBM SEKOLAH SMK CERDAS SATU BANGSA</h2>
      </div>
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-5"><div className="flex gap-2 overflow-x-auto">{tabs.map((tab) => { const selected = activeTab === tab.id; return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`min-w-max rounded-xl px-4 py-3 text-sm font-black transition shadow-sm ${selected ? `${tab.activeClass} shadow-md` : tab.idleClass}`}>{tab.label}</button>; })}</div></div>
      {activeTab === 'akademik' && <div className="p-2 sm:p-5"><MasterDataTab kbmPreview={academicData} teachersList={teachersList} staffList={staffList} pusatJurusanList={pusatJurusanList} studentsList={studentsList} onSync={onSync} academicYearList={academicYears} activeTerm={activeTerm} /></div>}
      {activeTab === 'kehadiran' && <div className="p-2 sm:p-5"><AttendanceTab user={user} teachersList={teachersList} studentsList={studentsList} staffList={staffList} loading={false} /></div>}
      {activeTab === 'transisi' && <TransisiDanArsipTab />}
      {activeTab === 'riwayat' && <ActivityHistory />}
    </div>
  );
}
