import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Clock3, ClipboardList, GraduationCap, LibraryBig } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { teacherAPI, examAPI } from '../../../../utils/api';
import PaketSoalLibrary from '../../../../components/exam/PaketSoalLibrary';
import TeacherQuestionPackageModal from './TeacherQuestionPackageModal';
import MateriAjarTab from './MateriAjarTab';

const tabs = [
  { id: 'materials', label: 'Materi Ajar' },
  { id: 'questions', label: 'Bank Soal' },
];

const MateriSoalWorkspace = ({ clock, initialTab = 'materials', quickAction, onQuickActionConsumed }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const fetchPackages = useCallback(async () => {
    setPackagesLoading(true);
    try {
      const response = await teacherAPI.getQuestionBank();
      setPackages(response.data?.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal memuat paket soal.');
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'questions') fetchPackages();
  }, [activeTab, fetchPackages]);

  const deletePackage = async (id) => {
    try {
      await examAPI.deletePaketSoal(id);
      toast.success('Paket soal berhasil dihapus.');
      await fetchPackages();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal menghapus paket soal.');
    }
  };

  return (
    <div className="space-y-5 pb-16">
      <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="overflow-hidden rounded-[2rem] border border-green-100 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] p-6 lg:p-8">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-700">
              <GraduationCap className="h-3 w-3" /> Portal Teachers Workspace
            </div>
            {/* Clock WIB */}
            <div className="flex flex-col items-end gap-1 px-4 py-2 rounded-2xl bg-white/80 border border-green-100 shadow-sm shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clock?.day || 'Hari ini'},</span>
                <span className="text-xs font-bold text-slate-500">{clock?.date || ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-400" />
                <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clock?.time || ''}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Materi &amp; Bank Soal</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Kelola bahan ajar, modul pembelajaran, dan bank soal kelas yang Anda ampu.
          </p>
        </div>
      </motion.header>

      <nav aria-label="Kategori Materi dan Soal" className="flex flex-wrap justify-center gap-3 rounded-2xl border border-green-100 bg-white p-3 shadow-sm">
        {tabs.map(({ id, label }) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={selected ? 'page' : undefined}
              className={`inline-flex items-center justify-center rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-wide transition duration-200 ${selected ? 'bg-gradient-to-r from-green-500 to-emerald-700 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-500 hover:bg-green-50 hover:text-emerald-800'}`}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={activeTab}
          aria-label={activeTab === 'materials' ? 'Materi Ajar' : 'Bank Soal'}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.18 }}
        >
          {activeTab === 'materials' ? (
            <MateriAjarTab clock={clock} quickAction={quickAction} onQuickActionConsumed={onQuickActionConsumed} showHero={false} />
          ) : (
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <PaketSoalLibrary
                title="Bank Soal"
                subtitle="Kelola paket latihan dan kuis untuk kelas yang Anda ampu."
                packages={packages}
                loading={packagesLoading}
                role="guru"
                uploadButtonLabel="Buat Paket Soal Baru"
                onOpenUpload={() => setUploadOpen(true)}
                onRefresh={fetchPackages}
                onDelete={deletePackage}
              />
            </div>
          )}
        </motion.section>
      </AnimatePresence>
      <TeacherQuestionPackageModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => { toast.success('Paket soal tersimpan.'); fetchPackages(); }}
      />
    </div>
  );
};

export default MateriSoalWorkspace;
