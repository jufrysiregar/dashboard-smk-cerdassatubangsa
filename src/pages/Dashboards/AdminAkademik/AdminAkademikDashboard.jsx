import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { operatorAPI, calendarAPI, examAPI, informationCenterAPI } from '../../../utils/api';
import CinematicLoading from '../../../components/dashboard/shared/CinematicLoading';

import SummaryTab from './components/SummaryTab';
import MasterDataTab from './components/MasterDataTab';
import ManajemenKbmWorkspace from './components/ManajemenKbmWorkspace';
import CalendarTab from './components/Calendar/CalendarTab';
import ExamsTab from './components/ExamsTab';
import GradesReportTab from './components/GradesReportTab';
import UnderDevelopment from '../../../maintaning/UnderDevelopment';
import InformationCenterTab from '../../../components/dashboard/shared/InformationCenterTab';
import AttendanceTab from './components/AttendanceTab';

import { Layout, Users, Shield, Bell, Calendar, Monitor, LayoutDashboard, RefreshCcw, Clock } from 'lucide-react';
import GlassCard from '../../../components/dashboard/shared/GlassCard';

const AdminAkademikDashboard = ({ user, activeTab = 'summary', setActiveTab }) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [kbmPreview, setKbmPreview] = useState(null);
  const [saranaPreview, setSaranaPreview] = useState(null);
  const [events, setEvents] = useState([]);
  const [calendarForm, setCalendarForm] = useState({ title: '', pdf_file: null, is_published: false });
  const [newEvent, setNewEvent] = useState({ title: '', content: '', autoDeleteDays: 0 });
  const [questionBank, setQuestionBank] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [pusatJurusanList, setPusatJurusanList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const calendarFileInputRef = useRef(null);

  const [clock, setClock] = useState({ time: '', day: '', date: '' });

  useEffect(() => {
    const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const tick = () => {
      const wib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const hh = String(wib.getHours()).padStart(2, '0');
      const mm = String(wib.getMinutes()).padStart(2, '0');
      const ss = String(wib.getSeconds()).padStart(2, '0');
      setClock({
        time: `${hh}:${mm}:${ss}`,
        day: DAYS_ID[wib.getDay()],
        date: `${wib.getDate()} ${MONTHS_ID[wib.getMonth()]} ${wib.getFullYear()}`,
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async (isManualSync = false) => {
    // Hanya tampilkan loading global jika data summary masih kosong (initial load)
    if (isManualSync) setSyncing(true);
    else if (!summaryData) setLoading(true);
    
    try {
      const [summaryRes, newsRes] = await Promise.all([
        operatorAPI.getStats().catch(err => ({ data: { data: {} } })),
        informationCenterAPI.getAll().catch(err => ({ data: { data: [] } }))
      ]);
      
      setSummaryData(summaryRes.data.data);
      setAnnouncements(newsRes.data.data);

      // Selalu fetch master data (dibutuhkan MasterDataTab untuk sync dari DB)
      const kbmRes = await operatorAPI.getMasterData().catch(err => ({ data: { data: {} } }));
      setKbmPreview(kbmRes.data.data);

      if (activeTab === 'sarana' || activeTab === 'manajemen_kbm') {
        const saranaRes = await operatorAPI.getSarana().catch(err => ({ data: { data: {} } }));
        setSaranaPreview(saranaRes.data.data);
      }

      if (activeTab === 'calendar_ta') {
        const eventsRes = await calendarAPI.getEvents().catch(() => ({ data: { data: [] } }));
        setEvents(eventsRes.data.data || []);
      }

      if (activeTab === 'exams') {
        const qbRes = await examAPI.getQuestionBank().catch(() => ({ data: { data: [] } }));
        setQuestionBank(qbRes.data.data || []);
      }

      // Fetch all users
      const usersRes = await operatorAPI.getUsers({ per_page: 9999 }).catch(() => ({ data: { data: [] } }));
      const allUsers = usersRes.data.data || usersRes.data.users || []; // Check both .data and .users

      const sortById = (a, b) => parseInt(a.id) - parseInt(b.id);

      // Helper: cek apakah kontrak sudah expired (untuk honorer/magang)
      const isContractExpired = (u) => {
        if (!u || !['honorer', 'magang'].includes((u.position_status || '').toLowerCase()) || !u.contract_end_date) {
          return false;
        }
        const endDate = new Date(u.contract_end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        return today > endDate;
      };

      // Helper: user dianggap aktif untuk presensi hanya jika is_active=true DAN kontrak belum expired
      const isActiveForAttendance = (u) => {
        const isActive = u.is_active === true || u.is_active === 1 || String(u.is_active) === '1' || u.is_active === 'true';
        return isActive && !isContractExpired(u);
      };

      // Baca nomor urut langsung dari school_id (format: username@000053)
      const extractSeqNum = (u) => {
        if (u.school_id) {
          const match = u.school_id.match(/@(\d+)$/);
          if (match) return match[1]; // pertahankan leading zeros
        }
        return null;
      };

      const formatUser = (u) => {
        return { 
          ...u, 
          // NISN/NIP utama tersimpan di nisn_nip; identitas tambahan di kolom sekunder.
          nisn: u.nisn_nip || u.secondary_identity_number || u.nisn || u.nis || '-',
        };
      };

      const resolveAccessRole = (u) => String(u.access_role || u.role || u.role_name || '').trim().toLowerCase().replaceAll(' ', '_');
      const isTeacherAccount = (u) => ['guru', 'teacher'].includes(resolveAccessRole(u));

      // Hanya masukkan user AKTIF ke list presensi
      const teachersOnly = allUsers.filter(u => {
        return isTeacherAccount(u) && isActiveForAttendance(u);
      }).sort(sortById).map(formatUser);

      const pjOnly = allUsers.filter(u => {
        const role = (u.access_role || u.role || u.role_name || '').toLowerCase();
        const status = (u.position_status || '').toLowerCase();
        return (role.includes('jurusan') || role === 'pusat_jurusan') && status !== 'magang' && status !== 'honorer' && isActiveForAttendance(u);
      }).sort(sortById).map(formatUser);

      const studentsOnly = allUsers.filter(u =>
        (u.access_role || u.role || u.role_name || '').toLowerCase() === 'murid' && isActiveForAttendance(u)
      ).sort(sortById).map(formatUser);

      // Presensi fisik hanya untuk tenaga kependidikan non-guru. Status honorer/magang
      // tidak mengubah pemisahan: semua akun guru tetap masuk ke daftar guru.
      const staffOnly = allUsers.filter(u => {
        const role = resolveAccessRole(u);
        return !isTeacherAccount(u) && !['murid', 'student', 'super_admin', 'operator'].includes(role) && isActiveForAttendance(u);
      }).sort(sortById).map(formatUser);

      setTeachersList(teachersOnly);
      setPusatJurusanList(pjOnly);
      setStudentsList(studentsOnly);
      setStaffList(staffOnly);

      // --- LOGIKA SINKRONISASI ID & DATA OTOMATIS (AUTO-MAPPING) ---
      // Memastikan ID lokal (kls-xxx) digantikan dengan ID asli database (numeric) agar valid saat presensi.
      const backendData = kbmRes.data?.data || {};
      const currentMasterData = JSON.parse(localStorage.getItem('academic_master_data_v3') || '{"kelas":[], "mapel":[], "jurusan":[], "jadwal":[], "guru":[]}');
      
      let isStorageModified = false;

      // 1. Sync Kelas IDs
      if (backendData.kelas && Array.isArray(backendData.kelas)) {
        currentMasterData.kelas = (currentMasterData.kelas || []).map(localKls => {
          const match = backendData.kelas.find(bk => bk.name === localKls.nama);
          if (match && String(localKls.id) !== String(match.id)) {
            isStorageModified = true;
            return { ...localKls, id: match.id };
          }
          return localKls;
        });
      }

      // 2. Sync Mapel IDs
      if (backendData.mapel && Array.isArray(backendData.mapel)) {
        currentMasterData.mapel = (currentMasterData.mapel || []).map(localMpl => {
          const match = backendData.mapel.find(bm => bm.nama === localMpl.nama);
          if (match && String(localMpl.id) !== String(match.id)) {
            isStorageModified = true;
            return { ...localMpl, id: match.id };
          }
          return localMpl;
        });
      }

      // 3. Sync Jurusan IDs
      if (backendData.jurusan && Array.isArray(backendData.jurusan)) {
        currentMasterData.jurusan = (currentMasterData.jurusan || []).map(localJr => {
          const match = backendData.jurusan.find(bj => bj.kode === localJr.kode);
          if (match && String(localJr.id) !== String(match.id)) {
            isStorageModified = true;
            return { ...localJr, id: match.id };
          }
          return localJr;
        });
      }

      // 4. Enrich NISN Murid (Existing Logic)
      if (currentMasterData.kelas && Array.isArray(currentMasterData.kelas)) {
        currentMasterData.kelas = currentMasterData.kelas.map(kls => {
          if (!kls.students) return kls;
          const enrichedStudents = kls.students.map(std => {
            const fullUser = allUsers.find(u => String(u.id) === String(std.id));
            const realNisn = fullUser?.nisn_nip || fullUser?.nisn || fullUser?.nis || '';
            if (realNisn && realNisn !== '-' && std.nisn !== realNisn) {
              isStorageModified = true;
              return { ...std, nisn: realNisn };
            }
            return std;
          });
          return { ...kls, students: enrichedStudents };
        });
      }

      if (isStorageModified) {
        // Simpan hasil remap ID ke localStorage SAJA.
        // JANGAN menimpa kbmPreview dengan currentMasterData: kbmPreview harus
        // tetap bentuk API (key: jurusans / teacher_assignments / teachers),
        // sedangkan currentMasterData bentuk localStorage (key: jurusan / jadwal /
        // guru). Menimpanya membuat merge di MasterDataTab membaca key yang salah
        // sehingga jadwal & jurusan ikut TERKOSONGKAN — gejala: tab Detail Card 2
        // "Belum ada jadwal KBM tersimpan" walau DB punya jadwal, dan Detail Card 1
        // menampilkan "TKJ (TKJ)" bukan nama jurusan lengkap.
        localStorage.setItem('academic_master_data_v3', JSON.stringify(currentMasterData));
      }
      // ------------------------------------------------------------

      // Save to localStorage for instant recovery
      const ATTENDANCE_CACHE_VERSION = 'v2';
      localStorage.setItem('admin_teachers_list', JSON.stringify(teachersOnly));
      localStorage.setItem('admin_teachers_list_version', ATTENDANCE_CACHE_VERSION);
      localStorage.setItem('admin_students_list', JSON.stringify(studentsOnly));
      localStorage.setItem('admin_students_list_version', ATTENDANCE_CACHE_VERSION);
      localStorage.setItem('admin_staff_list', JSON.stringify(staffOnly));
      localStorage.setItem('admin_staff_list_version', ATTENDANCE_CACHE_VERSION);

      // Refresh otomatis dan sinkronisasi data tidak memerlukan notifikasi.
      // Pesan sebelumnya muncul berulang karena fungsi ini dipanggil polling tiap 2 menit.
    } catch (error) {
      console.error('Failed to fetch Admin Akademik data', error);
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchInitialData();

    return undefined;
  }, []);

  // Super Admin dapat menambah, mengubah, atau menghapus akun dari dashboard lain.
  // Sinkronkan ulang sumber guru/murid/staf saat perubahan terjadi pada tab yang sama
  // maupun tab browser lain agar dropdown wali kelas tidak memakai daftar lama.
  useEffect(() => {
    const refreshUserData = () => { fetchInitialData(true); };
    const refreshFromStorage = event => {
      if (event.key === 'school_users_changed_at') refreshUserData();
    };
    window.addEventListener('schoolUsersChanged', refreshUserData);
    window.addEventListener('storage', refreshFromStorage);
    return () => {
      window.removeEventListener('schoolUsersChanged', refreshUserData);
      window.removeEventListener('storage', refreshFromStorage);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'summary' && !loading) {
      // Fetch instantly when returning to summary tab to sync any changes made in other tabs (like Information Center)
      fetchInitialData(true);
    }

    // Muat ulang akun saat membuka Manajemen KBM agar dropdown guru/wali kelas
    // selalu mengambil data terakhir dari API, termasuk akun yang baru ditambahkan.
    if (activeTab === 'manajemen_kbm') {
      fetchInitialData(true);
    }
    
    if (activeTab === 'news') {
      return undefined;
    }

    // Saat berada di Pusat Informasi, refresh mengikuti klik tombol agar tetap manual.
    const pollInterval = setInterval(() => {
      fetchInitialData(true);
    }, 120000);

    return () => clearInterval(pollInterval);
  }, [activeTab]);

  const handleUpdateCalendar = async () => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('title', calendarForm.title);
      if (calendarForm.pdf_file) {
        formData.append('pdf_file', calendarForm.pdf_file);
      }
      await calendarAPI.saveCalendar(formData);
      toast.success('Kalender berhasil diperbarui');
      fetchInitialData();
    } catch (error) {
       toast.error('Gagal update kalender');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (eventData) => {
    try {
      setLoading(true);
      const payload = eventData || newEvent;
      await calendarAPI.storeEvent({
        title: payload.title,
        content: payload.description || payload.content,
        event_date: payload.startDate || payload.event_date,
        type: payload.category || payload.type || 'academic'
      });
      setNewEvent({ title: '', content: '', autoDeleteDays: 0 });
      toast.success('Agenda berhasil dibuat');
      fetchInitialData();
    } catch (error) {
       toast.error('Gagal membuat agenda');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (window.confirm('Hapus agenda ini?')) {
      try {
        setLoading(true);
        await calendarAPI.deleteEvent(id);
        toast.success('Agenda berhasil dihapus');
        fetchInitialData();
      } catch (error) {
         toast.error('Gagal menghapus agenda');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading && !summaryData) {
    return <CinematicLoading roleName="Operator" />;
  }
  return (
    <div className={activeTab === 'news' ? 'animate-fadeIn' : 'w-full overflow-x-hidden space-y-6 animate-fadeIn'}>
      {/* HEADER SECTION WRAPPED IN CINEMATIC CARD */}
      {activeTab !== 'news' && (
        <div className="overflow-hidden rounded-[2rem] border border-indigo-100 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(79,70,229,0.12),transparent_28%),linear-gradient(135deg,#ffffff_0%,#eef2ff_100%)] p-6 lg:p-8 shadow-2xl">
            
            <div className="relative flex flex-col md:flex-row justify-between gap-8 text-left">
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <LayoutDashboard className="w-3 h-3" /> Portal Admin Academic Authority
                  </div>
                  {/* Clock WIB */}
                  <div className="flex flex-col items-end gap-1 px-4 py-2 rounded-2xl bg-white/80 border border-indigo-100 shadow-sm shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clock.day},</span>
                      <span className="text-xs font-bold text-slate-500">{clock.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-indigo-500" />
                      <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clock.time}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
                    </div>
                  </div>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                  {activeTab === 'summary' && 'Dashboard Admin Akademik'}
                  {activeTab === 'manajemen_kbm' && 'Manajemen KBM'}
                  {activeTab === 'master' && 'Master Data Akademik'}
                  {activeTab === 'calendar_ta' && 'Kalender & Agenda Pendidikan'}
                  {activeTab === 'exams' && 'Ujian Umum & Nasional'}
                  {activeTab === 'grades_academic' && 'Nilai & Rapor'}
                  {activeTab === 'attendance_academic' && 'Presensi Sekolah'}
                  {(activeTab === 'assignments' || activeTab === 'tasks') && 'Penilaian & Tugas Harian'}
                </h1>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {activeTab === 'summary' && 'Pusat operasional data akademik, manajemen kelas, sarana prasarana, dan pemantauan aktivitas pembelajaran secara tertata.'}
                  {activeTab === 'manajemen_kbm' && 'Workspace terpadu untuk akademik, fasilitas, kehadiran, dan riwayat aktivitas Kegiatan Belajar Mengajar.'}
                  {activeTab === 'master' && 'Kelola data inti pembelajaran: tahun ajaran, kelas, mata pelajaran, guru, jadwal'}
                  {activeTab === 'calendar_ta' && 'Pusat Kalender Akademik & Penjadwalan Agenda Sekolah.'}
                  {activeTab === 'exams' && 'Kelola simulasi, UTS, UAS, ujian praktek, dan ujian nasional secara realtime.'}
                  {activeTab === 'grades_academic' && 'Kelola nilai harian, integrasi hasil ujian, perhitungan nilai akhir, dan finalisasi rapor tanpa mengubah menu ujian.'}
                  {activeTab === 'attendance_academic' && 'Kelola kehadiran guru, staf, dan siswa. Data otomatis muncul di Dashboard.'}
                  {(activeTab === 'assignments' || activeTab === 'tasks') && 'Pusat kontrol tugas siswa: kelola penugasan, pantau pengumpulan, integrasi bank soal, dan koreksi nilai harian terhubung rapor.'}
                </p>
              </div>
            </div>
        </div>
      )}

      {activeTab !== 'news' ? (
        <GlassCard className="p-0 border-none shadow-2xl bg-white overflow-hidden min-h-[700px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {activeTab === 'summary' && (
                <div className="p-8">
                  <SummaryTab 
                    summaryData={summaryData} 
                    announcements={announcements}
                    loading={syncing}
                    onSync={() => fetchInitialData(true)}
                    onNavigate={setActiveTab}
                  />
                </div>
              )}

              {activeTab === 'manajemen_kbm' && (
                <ManajemenKbmWorkspace
                  user={user}
                  academicData={kbmPreview}
                  saranaData={saranaPreview}
                  teachersList={teachersList}
                  studentsList={studentsList}
                  staffList={staffList}
                  pusatJurusanList={pusatJurusanList}
                  onSync={() => fetchInitialData(true)}
                />
              )}
  
              {activeTab === 'master' && (
                <div className="p-8">
                  <MasterDataTab kbmPreview={kbmPreview} teachersList={teachersList} staffList={staffList} pusatJurusanList={pusatJurusanList} studentsList={studentsList} onSync={() => fetchInitialData(true)} />
                </div>
              )}
              
              {activeTab === 'calendar_ta' && (
                <div className="p-1 lg:p-2">
                  <CalendarTab 
                    events={events}
                    loading={syncing}
                    onSync={() => fetchInitialData(true)}
                    onCreateEvent={handleCreateEvent}
                    onDeleteEvent={handleDeleteEvent}
                  />
                </div>
              )}
  
              {activeTab === 'exams' && (
                <div className="p-8">
                  <ExamsTab 
                    questionBank={questionBank}
                    studentsList={studentsList}
                    loading={syncing}
                    onSync={() => fetchInitialData(true)}
                  />
                </div>
              )}
  
              {activeTab === 'attendance_academic' && (
                <div className="p-8">
                  <AttendanceTab 
                    user={user}
                    teachersList={teachersList}
                    studentsList={studentsList}
                    staffList={staffList}
                    loading={syncing}
                  />
                </div>
              )}
  
              {activeTab === 'grades_academic' && (
                <div className="p-8">
                  <GradesReportTab user={user} studentsList={studentsList} staffList={staffList} teachersList={teachersList} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </GlassCard>
      ) : (
        <InformationCenterTab user={user} />
      )}
    </div>
  );
};

export default AdminAkademikDashboard;
