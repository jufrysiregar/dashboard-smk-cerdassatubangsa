import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Calendar as CalendarIcon, Upload, Trash2, 
  Sparkles, CheckCircle2, ChevronRight, FileUp, ListChecks, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { calendarAPI } from '../../../../../utils/api';
import { fetchAcademicCalendarPreviewUrl, revokeObjectUrl } from '../../../../../utils/calendarPreview';

const STAGE_LABELS = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  active: { label: 'Aktif', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  archived: { label: 'Arsip', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const CalendarTab = ({ isPreviewOnly = false, isWakasek = false }) => {
  // ── STATE ──
  const [calendarForm, setCalendarForm] = useState({
    ta: '',
    semester: '',
    status: 'active',
    file: null,
    fileName: '',
  });
  
  const [agendaForm, setAgendaForm] = useState({
    nama: '',
    tanggal: '',
    catatan: '',
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [savedCalendar, setSavedCalendar] = useState(null);
  const [savedAgendas, setSavedAgendas] = useState([]);
  const [hasBoundData, setHasBoundData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [savingAgenda, setSavingAgenda] = useState(false);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef('');
  const previewVersionRef = useRef('');

  // All roles read the same API-backed data. Preview screens refresh in the
  // background so changes made on another LAN workstation appear automatically.
  useEffect(() => {
    let alive = true;
    const loadCalendarData = async () => {
      try {
        const [calendarResponse, eventsResponse] = await Promise.all([
          calendarAPI.getCalendar(),
          calendarAPI.getEvents(),
        ]);
        if (!alive) return;

        const record = calendarResponse.data?.data ?? calendarResponse.data ?? null;
        let fileUrl = '';
        if (record?.file_path) {
          const version = `${record.id}:${record.updated_at || ''}:${record.file_path}`;
          try {
            fileUrl = previewVersionRef.current === version && previewUrlRef.current
              ? previewUrlRef.current
              : await fetchAcademicCalendarPreviewUrl();
            previewVersionRef.current = version;
          }
          catch (error) { console.error('Gagal memuat PDF kalender:', error); }
        }
        if (!alive) {
          revokeObjectUrl(fileUrl);
          return;
        }

        if (previewUrlRef.current !== fileUrl) revokeObjectUrl(previewUrlRef.current);
        previewUrlRef.current = fileUrl;
        setSavedCalendar(record ? {
          ...record,
          ta: record.academic_year || record.title || '',
          fileName: record.original_filename || '',
          fileUrl,
          publishDate: record.upload_date || '',
          size: record.file_size || '',
          isPublished: Boolean(record.is_published),
          status: record.status || 'draft',
        } : null);
        setHasBoundData(Boolean(record?.has_data));
        if (record?.academic_year) {
          setCalendarForm((current) => ({
            ...current,
            ta: current.ta || record.academic_year,
            semester: current.semester || record.semester || 'Ganjil',
            status: current.status || record.status || 'draft',
          }));
        }

        const eventRows = eventsResponse.data?.data ?? eventsResponse.data ?? [];
        setSavedAgendas((Array.isArray(eventRows) ? eventRows : []).map((event) => ({
          ...event,
          nama: event.title,
          tanggal: event.event_date,
          author: 'Admin Akademik',
        })));
      } catch (error) {
        if (alive) toast.error(error?.response?.data?.message || 'Data kalender gagal dimuat dari server.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadCalendarData();
    const refreshInterval = isPreviewOnly ? setInterval(loadCalendarData, 30000) : null;
    return () => {
      alive = false;
      if (refreshInterval) clearInterval(refreshInterval);
      revokeObjectUrl(previewUrlRef.current);
      previewUrlRef.current = '';
      previewVersionRef.current = '';
    };
  }, [isPreviewOnly]);

  // ── HANDLERS ──
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Hanya file PDF yang diizinkan!');
        return;
      }
      
      setCalendarForm(prev => ({ ...prev, file, fileName: file.name }));
    }
  };

  const publishCalendar = async () => {
    if (!calendarForm.ta.trim()) { toast.error('Tahun ajaran wajib diisi!'); return; }
    if (!calendarForm.semester) { toast.error('Semester wajib dipilih.'); return; }
    if (!calendarForm.file && !savedCalendar?.file_path) { toast.error('Pilih file PDF kalender terlebih dahulu.'); return; }

    setSavingCalendar(true);
    try {
      const formData = new FormData();
      formData.append('title', `Kalender Akademik ${calendarForm.ta} - ${calendarForm.semester}`);
      formData.append('academic_year', calendarForm.ta.trim());
      formData.append('semester', calendarForm.semester);
      formData.append('status', calendarForm.status);
      formData.append('is_published', '1');
      if (calendarForm.file) formData.append('pdf_file', calendarForm.file);
      await calendarAPI.saveCalendar(formData);
      setCalendarForm((current) => ({ ...current, file: null, fileName: '' }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Kalender berhasil disimpan ke database.');
      await loadCalendarDataNow();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Kalender gagal disimpan.');
    } finally {
      setSavingCalendar(false);
    }
  };

  const loadCalendarDataNow = async () => {
    try {
      const [calendarResponse, eventsResponse] = await Promise.all([calendarAPI.getCalendar(), calendarAPI.getEvents()]);
      const record = calendarResponse.data?.data ?? calendarResponse.data ?? null;
      let fileUrl = '';
      if (record?.file_path) {
        const version = `${record.id}:${record.updated_at || ''}:${record.file_path}`;
        fileUrl = previewVersionRef.current === version && previewUrlRef.current
          ? previewUrlRef.current
          : await fetchAcademicCalendarPreviewUrl();
        previewVersionRef.current = version;
      }
      if (previewUrlRef.current !== fileUrl) revokeObjectUrl(previewUrlRef.current);
      previewUrlRef.current = fileUrl;
      setSavedCalendar(record ? { ...record, ta: record.academic_year || record.title || '', fileName: record.original_filename || '', fileUrl, publishDate: record.upload_date || '', size: record.file_size || '', isPublished: Boolean(record.is_published) } : null);
      const eventRows = eventsResponse.data?.data ?? eventsResponse.data ?? [];
      setSavedAgendas((Array.isArray(eventRows) ? eventRows : []).map((event) => ({ ...event, nama: event.title, tanggal: event.event_date, author: 'Admin Akademik' })));
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Data kalender gagal disegarkan.');
    }
  };

  const saveAgenda = async () => {
    if (!agendaForm.nama.trim()) { toast.error('Nama agenda wajib diisi!'); return; }
    if (!agendaForm.tanggal) { toast.error('Tanggal wajib dipilih!'); return; }
    setSavingAgenda(true);
    try {
      await calendarAPI.storeEvent({ title: agendaForm.nama.trim(), event_date: agendaForm.tanggal, catatan: agendaForm.catatan || null, type: 'academic' });
      setAgendaForm({ nama: '', tanggal: '', catatan: '' });
      toast.success('Agenda berhasil disimpan ke database.');
      await loadCalendarDataNow();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Agenda gagal disimpan.');
    } finally {
      setSavingAgenda(false);
    }
  };

  const removeCalendar = async () => {
    try {
      await calendarAPI.deleteCalendar(savedCalendar?.academic_year && savedCalendar?.semester
        ? { academic_year: savedCalendar.academic_year, semester: savedCalendar.semester }
        : undefined);
      setShowDeleteConfirm(false);
      toast.success('Kalender & dokumen PDF dihapus permanen.');
      await loadCalendarDataNow();
    } catch (error) {
      // The server refuses a permanent delete (HTTP 422) whenever the term is
      // already bound to class/grade history; it locks the row as an archive.
      if (error?.response?.status === 422) {
        setShowDeleteConfirm(false);
        toast.error(error?.response?.data?.message || 'Kalender terikat riwayat dan dikunci sebagai Arsip.');
        await loadCalendarDataNow();
        return;
      }
      toast.error(error?.response?.data?.message || 'Dokumen kalender gagal dihapus.');
    }
  };

  const removeAgenda = async (id) => {
    try {
      await calendarAPI.deleteEvent(id);
      toast.success('Agenda berhasil dihapus dari database.');
      await loadCalendarDataNow();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Agenda gagal dihapus.');
    }
  };

  // ── RENDER ──
  const uploadReady = Boolean(calendarForm.ta.trim() && calendarForm.semester && calendarForm.file);
  const agendaReady = Boolean(agendaForm.nama.trim() && agendaForm.tanggal);
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="animate-fadeIn pb-20 font-poppins space-y-6"
    >
      {/* NOTIFIKASI DI LUAR CARD (KHUSUS PREVIEW/SUPER ADMIN) */}
      {isPreviewOnly && (
        <div className="p-6 bg-amber-50 border-2 border-amber-200 rounded-[2rem] flex items-start gap-4 shadow-sm animate-fadeIn">
          <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl shrink-0">
            <AlertCircle size={24} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Informasi Penting</p>
            <p className="text-sm font-bold text-amber-900 leading-relaxed">
              Kalender dan Agenda KBM Sekolah di upload oleh Admin Akademik. Mohon cek secara berkala, karena terjadi nya perubahan sewaktu - waktu tanpa pemberitahuan terlebih dahulu. Admin Akademik memiliki kewenangan penuh untuk itu.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-5 py-3 text-sm font-semibold text-indigo-700">
          Memuat kalender dan agenda dari server sekolah…
        </div>
      )}

      <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-100 space-y-12 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-50/30 rounded-full blur-3xl -mr-64 -mt-64 pointer-events-none" />
        
        {/* INTERNAL HEADER (Hanya muncul jika bukan preview tulen) */}
        {!isPreviewOnly && (
          <div className="relative z-10 space-y-1 border-l-4 border-indigo-600 pl-6 py-2">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Manajemen Kalender & Agenda Pendidikan</h2>
          </div>
        )}
        
        {/* ── AREA ATAS: INPUT DUAL-PANEL ── */}
        {!isPreviewOnly && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-stretch relative z-10">
          
          {/* PANEL KIRI: UPLOAD PDF */}
          <div className="bg-slate-50/50 rounded-[2.5rem] p-10 border border-slate-100 flex flex-col h-full transition-all hover:bg-white hover:shadow-xl group/card">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                <FileUp size={24} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-800">Upload Kalender PDF</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Dokumen Resmi Sekolah</p>
              </div>
            </div>

            <div className="space-y-6 flex-grow">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tahun Ajaran</label>
                <input 
                  type="text"
                  placeholder="Contoh: 2025/2026"
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                  value={calendarForm.ta}
                  onChange={e => setCalendarForm({...calendarForm, ta: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Semester</label>
                <select
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                  value={calendarForm.semester}
                  onChange={e => setCalendarForm({ ...calendarForm, semester: e.target.value })}
                >
                  <option value="">Pilih semester</option>
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Siklus</label>
                <select
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                  value={calendarForm.status}
                  onChange={e => setCalendarForm({ ...calendarForm, status: e.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Aktif</option>
                  <option value="archived">Arsip</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Berkas (.pdf)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full p-6 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                    calendarForm.file ? 'border-indigo-400 bg-white shadow-inner' : 'border-slate-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  <Upload size={24} className={calendarForm.file ? 'text-indigo-600' : 'text-slate-300'} />
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest text-center px-4">
                    {calendarForm.fileName || 'Klik untuk pilih file PDF'}
                  </span>
                  <input type="file" ref={fileInputRef} hidden accept=".pdf" onChange={handleFileChange} />
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button 
                onClick={publishCalendar}
                disabled={savingCalendar || !uploadReady}
                className={`w-full py-5 rounded-full font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                  uploadReady
                  ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200 active:scale-95 btn-shimmer-strong' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {uploadReady && <Sparkles size={16} className="animate-pulse" />}
                {savingCalendar ? 'Menyimpan kalender…' : 'Simpan & Publikasikan Kalender'}
              </button>
            </div>
          </div>

          {/* PANEL KANAN: INPUT AGENDA MANUAL */}
          <div className="bg-slate-50/50 rounded-[2.5rem] p-10 border border-slate-100 flex flex-col h-full transition-all hover:bg-white hover:shadow-xl group/card">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                <CalendarIcon size={24} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-800">Input Agenda Manual</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Penjadwalan Harian</p>
              </div>
            </div>

            <div className="space-y-6 flex-grow">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Agenda Baru</label>
                <input 
                  type="text"
                  placeholder="Misal: Rapat Pleno Guru"
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all"
                  value={agendaForm.nama}
                  onChange={e => setAgendaForm({...agendaForm, nama: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Tanggal</label>
                <input 
                  type="date"
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:outline-none focus:border-blue-400 transition-all cursor-pointer"
                  value={agendaForm.tanggal}
                  onChange={e => setAgendaForm({...agendaForm, tanggal: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pesan Singkat (Opsional)</label>
                <input 
                  type="text"
                  maxLength={255}
                  placeholder="Misal: Bawa dokumen lengkap"
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all"
                  value={agendaForm.catatan}
                  onChange={e => setAgendaForm({...agendaForm, catatan: e.target.value})}
                />
              </div>
            </div>

            <div className="mt-8">
              <button 
                onClick={saveAgenda}
                disabled={savingAgenda || !agendaReady}
                className={`w-full py-5 rounded-full font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-3 ${
                  agendaReady
                  ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {savingAgenda ? 'Menyimpan agenda…' : 'Simpan Agenda'}
              </button>
            </div>
          </div>
        </div>
        )}

        {/* ── AREA BAWAH: PREVIEW & MONITORING ── */}
        <div className="space-y-12 relative z-10">
          <div className="flex items-center gap-4">
            <div className="h-0.5 bg-slate-100 flex-grow" />
            <div className="px-6 py-2 bg-slate-50 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Monitoring & Preview</div>
            <div className="h-0.5 bg-slate-100 flex-grow" />
          </div>
          
          {/* BAGIAN A: PREVIEW KALENDER */}
          <section className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <div className="flex items-center gap-4">
                <div className="w-2 h-8 bg-indigo-600 rounded-full" />
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  Tahun Ajaran {savedCalendar?.ta || '[Belum Ditentukan]'}
                </h3>
                {savedCalendar?.status && (
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${STAGE_LABELS[savedCalendar.status]?.cls || STAGE_LABELS.draft.cls}`}>
                    {STAGE_LABELS[savedCalendar.status]?.label || savedCalendar.status}
                  </span>
                )}
              </div>
                {savedCalendar?.file_path && !isPreviewOnly && (
                  hasBoundData ? (
                    <div className="relative group">
                      <button
                        disabled
                        className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed"
                      >
                        <Trash2 size={14} /> Hapus
                      </button>
                      <div className="pointer-events-none absolute right-0 top-full mt-2 w-64 p-3 rounded-xl bg-slate-800 text-white text-[10px] font-bold leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl">
                        Kalender sudah terikat riwayat kelas &amp; nilai siswa, sehingga tidak dapat dihapus permanen. Statusnya dikunci sebagai Arsip.
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
                    >
                      <Trash2 size={14} /> Hapus
                    </button>
                  )
                )}
            </div>

            <div className="bg-slate-50 rounded-[3rem] border border-slate-200 min-h-[500px] flex items-center justify-center relative overflow-hidden group shadow-inner">
              {savedCalendar?.fileUrl ? (
                <iframe 
                  src={savedCalendar.fileUrl} 
                  className="w-full h-[850px] border-none rounded-[3rem]" 
                  title="Preview Kalender"
                />
              ) : (
                <div className="flex flex-col items-center gap-6 py-24 text-center">
                  <div className="relative">
                    <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-4xl shadow-xl">📑</div>
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-amber-500 rounded-full border-4 border-slate-50 flex items-center justify-center text-white font-black text-xl">!</div>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Belum Ada File PDF Terpublikasi</p>
                    <p className="text-xs font-medium text-slate-400 mt-2 max-w-xs leading-relaxed">Silakan upload kalender akademik resmi sekolah pada panel upload di atas.</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* HR DIVIDER */}
          <div className="h-px bg-slate-100 w-full" />

          {/* BAGIAN B: PREVIEW AGENDA */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 px-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-100 flex items-center justify-center">
                <ListChecks size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
                INFORMASI TERBARU DARI OPERATOR AKADEMIK :
              </h3>
            </div>

            <div className="bg-slate-50/50 rounded-[3rem] p-10 border border-slate-100 transition-all">
              <div className="space-y-5">
                {savedAgendas.length > 0 ? savedAgendas.map((agenda) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    key={agenda.id} 
                    className="flex items-start group"
                  >
                    <span className="text-amber-500 mr-4 font-black">•</span>
                    <div className="flex-grow flex justify-between items-center pr-4 border-b border-slate-100 pb-4">
                      <p className="text-sm font-bold text-slate-700 tracking-wide leading-relaxed">
                        {agenda.nama} 
                        <span className="ml-3 font-bold text-indigo-600">{new Date(agenda.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        {agenda.catatan && <span className="ml-2 font-medium italic text-emerald-600">· {agenda.catatan}</span>}
                        {agenda.author === 'Wakasek' && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Agenda Anda</span>}
                      </p>
                      {!isPreviewOnly && (
                        <button 
                          onClick={() => removeAgenda(agenda.id)} 
                          className="text-rose-400 transition-all hover:bg-rose-50 hover:text-rose-600 rounded-xl p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )) : (
                  <div className="py-12 text-center">
                    <p className="text-sm font-medium text-slate-400 italic">Belum ada agenda harian yang diinput oleh operator.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── CUSTOM DELETE CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2rem] p-8 max-w-xl w-full shadow-2xl relative overflow-hidden"
            >
              <div className="flex gap-6 items-start">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shrink-0">
                  <Trash2 size={32} />
                </div>

                <div className="space-y-4 flex-grow">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Anda yakin ingin menghapus nya.?</h3>
                    <div className="flex items-center gap-2 text-rose-500">
                      <AlertCircle size={16} className="text-rose-500 shrink-0" />
                      <p className="text-[11px] font-bold leading-relaxed">
                        Tahun ajaran, semester, dokumen PDF, dan record kalendernya akan dihapus permanen dari database & penyimpanan.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-4">
                    <button 
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={removeCalendar}
                      className="px-6 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-100 transition-all"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .btn-shimmer-strong {
          background-size: 200% 100%;
          animation: cinematic-bling 2s linear infinite;
          background-image: linear-gradient(
            90deg, 
            rgba(79, 70, 229, 1) 0%, 
            rgba(99, 102, 241, 1) 25%, 
            rgba(165, 180, 252, 1) 50%, 
            rgba(99, 102, 241, 1) 75%, 
            rgba(79, 70, 229, 1) 100%
          );
        }
        @keyframes cinematic-bling {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </motion.div>
  );
};

export default CalendarTab;
