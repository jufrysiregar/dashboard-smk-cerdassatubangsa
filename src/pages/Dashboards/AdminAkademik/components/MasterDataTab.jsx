import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Edit2, Trash2, X, FileSpreadsheet, ChevronLeft, ChevronRight, ArrowLeft,
  School, BookOpen, Calendar, GraduationCap, Briefcase, Info, ClipboardList, Clock, Lock, Building2, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { BASE_URL, operatorAPI, adminAkademikAPI } from '../../../../utils/api';
import SearchableDropdown from '../../../../components/SearchableDropdown';
import FasilitasKelola from './FasilitasKelola';
import ModalCloseControl from '../../../../components/dashboard/shared/ModalCloseControl';
import useEscapeKey from '../../../../utils/useEscapeKey';

// SearchableDropdown dipindah ke src/components/SearchableDropdown.jsx (dipakai bersama dgn KBM).

const SavingDataLabel = () => (
  <span className="flex items-center gap-1">
    Menyimpan data
    {[0, 1, 2].map((dot) => <motion.i key={dot} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.55, repeat: Infinity, delay: dot * 0.12 }} className="inline-block h-1.5 w-1.5 rounded-full bg-current" />)}
  </span>
);

const formatDetailTimestamp = (item) => {
  const rawValue = item?.updated_at || item?.updatedAt || item?.created_at || item?.createdAt || item?.savedAt;
  if (!rawValue) return 'Waktu simpan tidak tersedia';
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return 'Waktu simpan tidak tersedia';
  const two = (value) => String(value).padStart(2, '0');
  return `${two(date.getDate())}-${two(date.getMonth() + 1)}-${date.getFullYear()} | ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
};

const formatCreatedTimestamp = (item) => {
  const rawValue = item?.created_at || item?.createdAt || item?.savedAt;
  if (!rawValue) return 'Waktu pembuatan tidak tersedia';
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return 'Waktu pembuatan tidak tersedia';
  const two = (value) => String(value).padStart(2, '0');
  return `${two(date.getDate())}-${two(date.getMonth() + 1)}-${date.getFullYear()} | ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
};

const getCurriculumYearFallback = (item) => {
  const year = Number(String(item?.created_at || item?.createdAt || '').slice(0, 4));
  return Number.isFinite(year) && year > 2000 ? `${year}/${year + 1}` : '';
};

const getDetailTimestamp = (item) => {
  const rawValue = item?.updated_at || item?.updatedAt || item?.created_at || item?.createdAt || item?.savedAt;
  if (!rawValue) return 0;
  const timestamp = new Date(rawValue).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sortDetailsNewestFirst = (items = []) =>
  [...items].sort((left, right) => {
    const timeDifference = getDetailTimestamp(right) - getDetailTimestamp(left);
    if (timeDifference) return timeDifference;
    // Use descending database IDs only as a tie-breaker or timestamp fallback.
    const leftId = Number(left?.dbId ?? left?.id);
    const rightId = Number(right?.dbId ?? right?.id);
    return Number.isFinite(leftId) && Number.isFinite(rightId) ? rightId - leftId : 0;
  });

const toApiTime = (value) => {
  const normalized = String(value || '').trim().replace('.', ':');
  const match = normalized.match(/^(\d{1,2}:\d{2})/);
  return match ? match[1].padStart(5, '0') : normalized;
};

const kbmScheduleSignature = (form, context = {}) => [
  form?.kelasId, form?.guruId, form?.mapelId, form?.mapelName, form?.hari,
  form?.kategoriJadwal, form?.jamMulai, form?.jamSelesai, form?.ruangan,
  form?.ruangId, form?.tahunAjaran, form?.semester, context.waliKelasId,
  context.tahunAjaran, context.semester,
].map(value => String(value || '').trim()).join('|');

const sortSchoolClasses = (classes = []) => {
  const gradeOrder = { X: 1, XI: 2, XII: 3 };
  const getParts = item => {
    const nameParts = String(item?.nama || item?.name || '').trim().split(/\s+/);
    return {
      grade: String(item?.tingkat || nameParts[0] || '').toUpperCase(),
      department: String(item?.jurusan || nameParts[1] || '').trim(),
      number: Number(item?.nomorKelas || nameParts[nameParts.length - 1]) || 0,
    };
  };
  return [...classes].sort((left, right) => {
    const a = getParts(left);
    const b = getParts(right);
    const gradeDifference = (gradeOrder[a.grade] || 99) - (gradeOrder[b.grade] || 99);
    if (gradeDifference) return gradeDifference;
    const departmentDifference = a.department.localeCompare(b.department, 'id', { sensitivity: 'base' });
    if (departmentDifference) return departmentDifference;
    return a.number - b.number;
  });
};

const MasterDataTab = ({ kbmPreview, teachersList = [], staffList = [], pusatJurusanList = [], studentsList = [], onSync, academicYearList = [], activeTerm = null }) => {
  // Daftar Tahun Ajaran resmi: pakai daftar academic_calendars bila tersedia,
  // fallback ke nilai lama agar tidak pernah kosong secara palsu.
  // Satu tahun ajaran bisa punya 2 baris kalender (Ganjil + Genap), jadi daftar
  // ini DEDIUPLIKAT per academic_year — semester sudah jadi dropdown terpisah.
  const academicYearOptions = (() => {
    const seen = new Set();
    const out = [];
    for (const t of academicYearList) {
      const year = t?.academic_year;
      if (!year || seen.has(year)) continue;
      seen.add(year);
      out.push({ value: year, label: year, id: t.id ?? year });
    }
    return out;
  })();
  const defaultAcademicYear = activeTerm?.academic_year || '';
  const [activeModal, setActiveModal] = useState(null);
  // Modal Fasilitas: 'manage' (kelola penuh) | 'detail' (ringkasan read-only) | null
  const [fasilitasModal, setFasilitasModal] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  // Kombinasikan guru tetap dengan guru honorer/magang dari staffList
  // Helper: resolve NIP dari semua field yang mungkin (urutan prioritas)
  const resolveNip = (u) =>
    u?.nisn_nip || u?.nip || null;

  const allTeachers = useMemo(() => {
    // Normalize setiap user guru agar punya field `nisn_nip` yang terisi
    const normalize = (u) => {
      if (!u) return null;
      const nip = resolveNip(u);
      return { ...u, nisn_nip: nip }; // pastikan nisn_nip selalu terisi
    };

    const honorerMagang = (staffList || []).filter(u => {
      if (!u) return false;
      const role = (u.access_role || u.role || u.role_name || '').toLowerCase();
      return role === 'guru';
    }).map(normalize).filter(Boolean);

    return [...(teachersList || []).map(normalize).filter(Boolean), ...honorerMagang].sort((a, b) => {
      const nameA = a?.name || a?.full_name || '';
      const nameB = b?.name || b?.full_name || '';
      return nameA.localeCompare(nameB);
    });
  }, [teachersList, staffList]);

  // Options for Ketua Jurusan dropdown — HANYA pusat_jurusan, bukan guru biasa
  const teacherOptions = useMemo(() => {
    return (pusatJurusanList || [])
      .filter(t => t && t.id)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [pusatJurusanList]);

  const closeModal = () => {
    setActiveModal(null);
    setAlertMsg(null);
    setSelectedJurusans([]);
    setIsFormDirty(false);
    setEditingItem(null);
    setSavePhase('idle');
    setIsSaving(false);
  };

  // Tombol Esc keyboard = batalkan/tutup modal teratas (Fasilitas > form Kelola/Edit).
  const closeTopmostModal = useCallback(() => {
    if (fasilitasModal) setFasilitasModal(null);
    else if (activeModal) closeModal();
  }, [fasilitasModal, activeModal]);
  useEscapeKey(Boolean(activeModal || fasilitasModal), closeTopmostModal);

  // Panggil ini setelah setiap operasi DB berhasil agar kbmPreview di-refresh
  // dan semua user (termasuk guru yang bersangkutan) langsung menerima data terbaru.
  const triggerSync = () => { if (typeof onSync === 'function') onSync(); };

  // Notifikasi hasil simpan/gagal: pakai toast di sudut kanan-bawah (konsisten dgn modul Fasilitas),
  // pesannya eksplisit menyebut kolom/apa yang gagal. Mekanisme alert inline lama sudah dihapus.
  // `id` = isi pesan => pesan yang SAMA cukup tampil 1 (menggantikan, tidak menumpuk walau diklik
  // berkali-kali); pesan BERBEDA boleh muncul berbarengan.
  const alertIdRef = React.useRef(null);
  const showAlert = (type, text) => {
    // Buang notif sebelumnya lalu tampilkan dengan id BARU => selalu 1 baris, tapi animasi "masuk"
    // terputar ulang tiap kali di-save (kerasa hidup), hilang otomatis 3 detik bila tak diklik lagi.
    if (alertIdRef.current) toast.dismiss(alertIdRef.current);
    const id = `md-${Date.now()}`;
    alertIdRef.current = id;
    if (type === 'success') {
      toast.success(text, { id, duration: 3200 });
    } else {
      toast.error(text, {
        id,
        duration: 3000,
        style: { maxWidth: '420px', fontSize: '12px', fontWeight: 800 },
      });
    }
  };

  // Dismiss on ANY click anywhere - delay 150ms so the triggering click doesn't self-cancel
  useEffect(() => {
    if (!alertMsg) return;
    const dismiss = () => setAlertMsg(null);
    const t = setTimeout(() => {
      window.addEventListener('click', dismiss, { once: true });
    }, 150);
    return () => {
      clearTimeout(t);
      window.removeEventListener('click', dismiss);
    };
  }, [alertMsg]);

  // ==== FORM STATE KELAS ====
  const INITIAL_KELAS_FORM = { tingkat: '', jurusan: '', nomorKelas: '1', waliKelas: '', tahunAjaran: '', semester: 'Ganjil', kapasitas: '36', students: [] };
  const [kelasForm, setKelasForm] = useState(INITIAL_KELAS_FORM);
  const [searchStudentKelas, setSearchStudentKelas] = useState('');

  // ==== FORM STATE MAPEL ====
  const INITIAL_MAPEL_FORM = { nama: '', kelompok: 'A', jurusan: 'Umum', tingkat: 'X', kode: '' };
  const [mapelForm, setMapelForm] = useState(INITIAL_MAPEL_FORM);
  const [selectedJurusans, setSelectedJurusans] = useState([]);

  const generateKodeMapel = (form) => {
    if (!form.nama) return '';
    const inisial = form.nama.substring(0, 3).toUpperCase();
    const kodeJurusan = form.jurusan === 'Umum' ? 'UMN' : form.jurusan;
    const tingkat = form.tingkat;
    
    // Cari urutan di data yang sudah ada
    const prefix = `${inisial}-${tingkat}-${kodeJurusan}-`;
    const existingCodes = (masterData.mapel || [])
      .map(m => m.kode)
      .filter(c => c && c.startsWith(prefix));
      
    let maxNum = 0;
    existingCodes.forEach(c => {
      const parts = c.split('-');
      const num = parseInt(parts[parts.length - 1]);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    
    const nextNum = String(maxNum + 1).padStart(2, '0');
    return `${prefix}${nextNum}`;
  };

  // ==== FORM STATE GURU JADWAL (BARU) ====
  const INITIAL_GURU_JADWAL_FORM = { 
    guruId: '', 
    nip: '',
    hari: '', 
    sesi: '',
    jenisJadwal: '', 
    kelasId: '', 
    jurusan: '', 
    ruangan: '', 
    mapelId: '', // Ditambahkan karena schema butuh mapel_id
    mapelName: '',
    kodeBelajar: '',
    kategoriJadwal: '',
    slotWaktu: '', 
    jamMulai: '', 
    jamSelesai: '',
    tahunAjaran: '',
    semester: ''
    ,ruangId: ''
  };
  const [guruJadwalForm, setGuruJadwalForm] = useState(INITIAL_GURU_JADWAL_FORM);

  // ==== FORM STATE JURUSAN ====
  const INITIAL_JURUSAN_FORM = { nama: '', kode: '', ketuaId: '' };
  const [jurusanForm, setJurusanForm] = useState(INITIAL_JURUSAN_FORM);

  // â”€â”€ FORM STATE KURIKULUM â”€â”€
  const INITIAL_KURIKULUM_FORM = {
    namaKurikulum: '', tahunAjaran: '', tingkat: 'X', statusAktif: true,
  };
  const INITIAL_DOKUMEN_FORM = {
    subjectId: '', jurusanId: '', tipeDoc: 'cp', judulDoc: '', catatan: '', file: null,
  };
  const [kurikulumForm, setKurikulumForm]   = useState(INITIAL_KURIKULUM_FORM);
  const [dokumenForm, setDokumenForm]       = useState(INITIAL_DOKUMEN_FORM);
  const [editingCurriculumDocument, setEditingCurriculumDocument] = useState(null);
  const [existingCurriculumFile, setExistingCurriculumFile] = useState(null);
  const [dokumenList, setDokumenList]       = useState([]);
  const [isDokumenLoading, setIsDokumenLoading] = useState(false);
  const [kurikulumSaving, setKurikulumSaving]   = useState(false);
  const dokumenInputRef = React.useRef(null);

  // ==== FORM STATE KEGIATAN EKSTRA SEKOLAH ====
  const INITIAL_MAGANG_FORM = {
    tipeKegiatan: '', // 'perlombaan' | 'pertukaran_siswa' | 'study_tour' | 'ekstrakurikuler'
    guruPembimbing: '',
    namaSekolahTujuan: '',
    guruPenanggungJawab: '',
    statusAcc: '',
    tujuanNegara: '',
    tujuanNegaraLainnya: '',
    namaKota: '',
    tujuan: '',
    muridInput: '',
    statusPembayaranInput: '',
    peserta: [], // { id, name, statusPembayaran }
    // Perlombaan fields
    namaKegiatan: '',
    tempatPerlombaan: '',
    waktuDiadakan: '',
    jamMulai: '',
    jamSelesai: '',
    // Pertukaran fields
    namaOrangtua: '',
    provinsi: '',
    kota: '',
    tanggalMulai: '',
    tanggalBerakhir: ''
  };
  const [magangForm, setMagangForm] = useState(INITIAL_MAGANG_FORM);
  const [searchStudentMagang, setSearchStudentMagang] = useState('');
  const [magangClassStudents, setMagangClassStudents] = useState([]);
  const [magangClassStudentsLoading, setMagangClassStudentsLoading] = useState(false);

  // Persistence Key (hanya untuk jurusan, magang, jadwal lokal - kelas & mapel sekarang dari DB)
  const STORAGE_KEY = 'academic_master_data_v3';

  const [masterData, setMasterData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading master data:", e);
      }
    }
    return {
      kelas: [],
      mapel: [],
      guru: [],
      jadwal: [],
      jurusan: [],
      magang: []
    };
  });

  // Clear old storage on mount
  useEffect(() => {
    localStorage.removeItem('academic_master_data_v1');
    localStorage.removeItem('academic_master_data_v2');
  }, []);

  // Persist to localStorage whenever masterData changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(masterData));
  }, [masterData]);

  // ==== SINKRONISASI DARI DATABASE (kbmPreview = data segar dari API backend) ====
  // Saat kbmPreview berubah (data dari /operator/master-data), merge kelas & mapel
  // dari database ke state lokal. Database selalu jadi sumber kebenaran untuk kedua entitas ini.
  const hasMergedFromApi = React.useRef(false);
  useEffect(() => {
    if (!kbmPreview) return;

    const apiKelas = Array.isArray(kbmPreview.kelas) ? kbmPreview.kelas : [];
    const apiMapel = Array.isArray(kbmPreview.mapel) ? kbmPreview.mapel : [];
    const apiJurusan = Array.isArray(kbmPreview.jurusans) ? kbmPreview.jurusans : [];
    const apiAssignments = Array.isArray(kbmPreview.teacher_assignments) ? kbmPreview.teacher_assignments : [];

    setMasterData(prev => {
      // Merge kelas: gabungkan data lokal (students, magang, dll) dengan data DB (id asli, nama, kapasitas)
      const mergedKelas = apiKelas.map(apiK => {
        const localMatch = prev.kelas.find(lk =>
          lk.nama === apiK.nama || String(lk.id) === String(apiK.id) || String(lk.dbId) === String(apiK.id)
        );
        return {
          // Gunakan field dari API sebagai sumber utama
          id: apiK.id,
          dbId: apiK.id,
          nama: apiK.nama,
          tingkat: apiK.tingkat,
          jurusan: apiK.jurusan,
          kapasitas: apiK.kapasitas,
          created_at: apiK.created_at,
          updated_at: apiK.updated_at,
          homeroom_teacher_name: apiK.homeroom_teacher_name || localMatch?.homeroom_teacher_name || '-',
          homeroom_teacher_id: apiK.homeroom_teacher_id || localMatch?.homeroom_teacher_id,
          isActive: true,
          semester: apiK.semester || localMatch?.semester || '',
          tahun_ajaran: apiK.tahun_ajaran || apiK.academic_year || localMatch?.tahun_ajaran || '',
          // Pertahankan data lokal yang tidak ada di API
          waliId: localMatch?.waliId || apiK.homeroom_teacher_id,
          students: Array.isArray(apiK.student_ids) ? apiK.student_ids : (localMatch?.students || []),
          nomorKelas: localMatch?.nomorKelas || '',
        };
      });
      // Merge mapel: data dari DB sebagai sumber utama
      const mergedMapel = apiMapel.map(apiM => {
        const localMatch = prev.mapel.find(lm =>
          lm.kode === apiM.kode || lm.nama === apiM.nama || String(lm.dbId) === String(apiM.id)
        );
        return {
          id: apiM.id,
          dbId: apiM.id,
          nama: apiM.nama,
          kode: apiM.kode,
          jurusan: apiM.jurusan || localMatch?.jurusan || 'Umum',
          tingkat: localMatch?.tingkat || 'X',
          kelompok: localMatch?.kelompok || 'C',
          KKM: localMatch?.KKM || 75,
          jam: apiM.jam_per_minggu || localMatch?.jam || 2,
          created_at: apiM.created_at,
          updated_at: apiM.updated_at,
        };
      });
      // Jurusan dari database adalah sumber kebenaran, termasuk ketika kosong.
      const mergedJurusan = apiJurusan.map(apiJ => {
          const localMatch = prev.jurusan.find(lj =>
            lj.kode === apiJ.code || lj.nama === apiJ.name || String(lj.id) === String(apiJ.id) || String(lj.dbId) === String(apiJ.id)
          );
          // head_user_id comes from DB (via updated loadAcademicDepartments), fallback to localStorage
          const resolvedKetuaId = apiJ.head_user_id
            ? String(apiJ.head_user_id)
            : (localMatch?.ketuaId || '');
          const resolvedHeadName = apiJ.head_name && apiJ.head_name !== '-'
            ? apiJ.head_name
            : (localMatch?.head_name || '-');
          return {
            id:        apiJ.id,
            dbId:      apiJ.id,
            nama:      apiJ.name,
            kode:      apiJ.code,
            ketuaId:   resolvedKetuaId,
            head_name: resolvedHeadName,
            deskripsi: localMatch?.deskripsi || 'Program Keahlian Sekolah',
            created_at: apiJ.created_at,
            updated_at: apiJ.updated_at,
          };
      });


      // Merge guru dari DB jika ada
      const apiTeachers = Array.isArray(kbmPreview.teachers) ? kbmPreview.teachers : [];
      let mergedGuru = prev.guru;
      if (apiTeachers.length > 0) {
        mergedGuru = apiTeachers.map(t => {
          const localMatch = prev.guru.find(lg => String(lg.guruId) === String(t.id) || String(lg.id) === String(t.id));
          return {
            id: t.id,
            dbId: t.id,
            guruId: t.id,
            name: t.name || t.full_name || 'Guru',
            school_id: t.school_id || t.employment_code,
            nip: resolveNip(t) || t.school_id || '-',
            jurusan: t.jurusan || localMatch?.jurusan || 'Umum',
            mapel: t.mapel || localMatch?.mapel || [],
          };
        });
      }

      // Merge jadwal dari teacher_assignments DB jika ada
      // Database tetap menjadi sumber kebenaran walau hasilnya kosong.
      // Jangan mempertahankan jadwal localStorage setelah record terakhir dihapus.
      const mergedJadwal = apiAssignments.map(apiJ => ({
          id: apiJ.id,
          dbId: apiJ.id,
          guruId: apiJ.guru_id,
          teacher_name: apiJ.guru_nama || 'Guru',
          mapelId: apiJ.subject_id,
          mapel: apiJ.mata_pelajaran || '-',
          kelasId: apiJ.kelas_id,
          kelas: apiJ.kelas_nama || '-',
          hari: apiJ.hari || (apiJ.hari_waktu ? apiJ.hari_waktu.split(' ')[0] : 'Senin'),
          jam: apiJ.jam || apiJ.hari_waktu || apiJ.jam_pelajaran || '-',
          tahunAjaran: apiJ.tahun_ajaran || '',
          semester: apiJ.semester || '',
          kategoriJadwal: apiJ.kategori_jadwal === 'umum' ? 'a' : (apiJ.kategori_jadwal || 'a'),
          sesi: 'morning',
          ruang: apiJ.ruang || '-',
          kode_belajar: apiJ.kode_belajar || '',
          created_at: apiJ.created_at,
          updated_at: apiJ.updated_at,
        }));

      hasMergedFromApi.current = true;
      return {
        ...prev,
        kelas: mergedKelas,
        mapel: mergedMapel,
        jurusan: mergedJurusan,
        guru: mergedGuru,
        jadwal: mergedJadwal,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbmPreview]);

  const hasBootstrappedBackendClassSync = React.useRef(false);

  const buildBackendClassPayload = (item) => {
    const className = String(item?.nama || item?.name || '').trim();
    const classParts = className.split(/\s+/).filter(Boolean);
    const gradeLevel = item?.tingkat || classParts[0] || 'X';
    const departmentCode = item?.jurusan || classParts[1] || '';
    const jurusanMeta = (masterData?.jurusan || []).find(j => String(j.kode || '').toUpperCase() === String(departmentCode || '').toUpperCase());
    const studentIds = Array.isArray(item?.students)
      ? item.students
          .map((student) => Number(student && typeof student === 'object' ? (student.id ?? student.student_id) : student))
          .filter((id) => Number.isInteger(id) && id > 0)
          .filter((id, index, all) => all.indexOf(id) === index)
      : [];

    // Validate wali kelas — pastikan guru yg valid
    let waliId = null;
    if (item?.waliId) {
      const foundTeacher = allTeachers.find(t => String(t.id) === String(item.waliId));
      if (foundTeacher) waliId = Number(item.waliId);
    }

    console.log('ðŸ“¦ Class payload:', {
      className,
      gradeLevel,
      departmentCode,
      waliId,
      studentCount: studentIds.length,
      teacher: allTeachers.find(t => String(t.id) === String(waliId))?.name || 'None'
    });

    return {
      name: className,
      grade_level: gradeLevel,
      department_code: departmentCode,
      department_name: jurusanMeta?.nama || departmentCode || null,
      capacity: Number(item?.kapasitas) > 0 ? Number(item.kapasitas) : 36,
      academic_year: kbmPreview?.current_academic_year || '',
      homeroom_teacher_id: waliId,
      student_ids: studentIds,
    };
  };

  const syncClassesSnapshot = async (kelasSnapshot, options = {}) => {
    const { silent = false } = options;
    const payloadClasses = (Array.isArray(kelasSnapshot) ? kelasSnapshot : [])
      .map(buildBackendClassPayload)
      .filter((item) => item.name);

    if (payloadClasses.length === 0) {
      return { success: false, dbIdMap: {} };
    }

    try {
      const res = await operatorAPI.syncMasterClasses({ classes: payloadClasses });

      // Bangun map: nama kelas -> db_id dari response backend
      const dbIdMap = {};
      const returnedClasses = res.data?.data?.classes || [];
      returnedClasses.forEach(cls => {
        if (cls?.name && cls?.id) {
          dbIdMap[cls.name] = cls.id;
        }
      });

      if (!silent) {
        toast.success('Sinkronisasi kelas murid ke database berhasil.');
      }

      return { success: true, dbIdMap };
    } catch (error) {
      console.error('Sync classes snapshot error:', error.response?.data || error.message);

      const errorMsg = error.response?.data?.message || error.message || 'Sinkronisasi kelas ke database gagal.';
      const validationErrors = error.response?.data?.errors;

      if (!silent) {
        if (validationErrors) {
          const errorList = Object.entries(validationErrors).map(([key, msgs]) => `${key}: ${msgs.join(', ')}`).join('\n');
          toast.error(`Validasi gagal:\n${errorList}`, { duration: 6000 });
        } else {
          toast.error(errorMsg, { duration: 5000});
        }
      }

      return { success: false, dbIdMap: {} };
    }
  };

  useEffect(() => {
    if (hasBootstrappedBackendClassSync.current) return;
    if (!kbmPreview) return;

    const localClasses = Array.isArray(masterData?.kelas) ? masterData.kelas : [];
    const remoteClasses = Array.isArray(kbmPreview?.kelas) ? kbmPreview.kelas : [];
    const hasLocalStudentAssignments = localClasses.some(item => Array.isArray(item?.students) && item.students.length > 0);

    if (localClasses.length === 0 || !hasLocalStudentAssignments || remoteClasses.length > 0) {
      return;
    }

    hasBootstrappedBackendClassSync.current = true;

    void (async () => {
      const { success: synced, dbIdMap } = await syncClassesSnapshot(localClasses, { silent: true });

      if (synced) {
        // Simpan dbId dari response ke masterData.kelas
        if (Object.keys(dbIdMap).length > 0) {
          setMasterData(prev => ({
            ...prev,
            kelas: prev.kelas.map(k => ({
              ...k,
              dbId: dbIdMap[k.nama] || k.dbId
            }))
          }));
        }
        toast.success('Data kelas lokal berhasil disinkronkan ke database.');
      }
    })();
  }, [kbmPreview, masterData]);

  const [activeDetailTab, setActiveDetailTab] = useState('struktur');
  const [showDetail, setShowDetail] = useState(false);
  const detailPanelRef = React.useRef(null);

  // Gulir ke panel detail setiap kali dibuka / berpindah antar-card, dijalankan
  // SETELAH DOM commit (requestAnimationFrame) — andal untuk perpindahan
  // (fix: detail card 2 tak muncul setelah membuka card 1). Data sudah disinkron
  // saat mount + focus/visibility + setelah CRUD, jadi tidak perlu refetch ulang
  // saat membuka detail (yang dulu bikin nilai "Teknik Komputer Jaringan" berkedip
  // berubah jadi "TKJ").
  useEffect(() => {
    if (!showDetail) return undefined;
    const id = requestAnimationFrame(() => detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => cancelAnimationFrame(id);
  }, [showDetail, activeDetailTab]);
  const [structureTab, setStructureTab] = useState('jurusan');
  const [showKbmPanel, setShowKbmPanel] = useState(false);
  const [kbmClassId, setKbmClassId] = useState('');
  const [classStudents, setClassStudents] = useState([]);
  const [classStudentId, setClassStudentId] = useState('');
  const [classStudentsLoading, setClassStudentsLoading] = useState(false);
  const [addAnotherClass, setAddAnotherClass] = useState(false);
  const [additionalClassForms, setAdditionalClassForms] = useState([]);
  const [databaseClassRosters, setDatabaseClassRosters] = useState({});
  const [classRosterRefreshToken, setClassRosterRefreshToken] = useState(0);
  const [addAnotherJadwal, setAddAnotherJadwal] = useState(false);
  const [additionalJadwalForms, setAdditionalJadwalForms] = useState([]);
  const [kbmEditBaseline, setKbmEditBaseline] = useState('');
  const [selectedExistingJurusanId, setSelectedExistingJurusanId] = useState(null);
  // Khusus pill jurusan: hanya data segar dari database, bukan localStorage.
  const [existingJurusans, setExistingJurusans] = useState([]);
  const [studentSearchKbm, setStudentSearchKbm] = useState('');
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedTimeSlotIds, setSelectedTimeSlotIds] = useState([]);
  const [kbmRooms, setKbmRooms] = useState([]);
  const [kbmTerm, setKbmTerm] = useState({ tahunAjaran: '', semester: '' });
  const [waliKelasId, setWaliKelasId] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const availableHomeroomTeachers = useMemo(() => {
    // Kelas yang "sedang dibuka" tidak boleh membuat walinya tersaring keluar.
    // Card 2 memakai kbmClassId; Card 1 (struktur) memakai editingItem kelas/kelompok.
    const openClassIds = new Set();
    if (String(kbmClassId || '')) openClassIds.add(String(kbmClassId));
    if (editingItem?.editingStructureClass) {
      const openIds = Array.isArray(editingItem.editingStructureClassIds) && editingItem.editingStructureClassIds.length
        ? editingItem.editingStructureClassIds
        : [editingItem.dbId || editingItem.id];
      openIds.forEach(id => { if (id) openClassIds.add(String(id)); });
    }
    return allTeachers.filter(teacher => !(masterData.kelas || []).some(item => {
      const assignedTeacherId = item.waliId || item.homeroom_teacher_id;
      return !openClassIds.has(String(item.dbId || item.id))
        && assignedTeacherId
        && String(assignedTeacherId) === String(teacher.id);
    }));
  }, [allTeachers, kbmClassId, masterData.kelas, editingItem]);
  const [detailPage, setDetailPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, tab }
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [tabArchiveModalOpen, setTabArchiveModalOpen] = useState(false);
  const [viewArchiveCategory, setViewArchiveCategory] = useState('');
  const [archiveForm, setArchiveForm] = useState({ tahunAjaran: '', semester: 'Ganjil' });
  const [isSaving, setIsSaving] = useState(false);
  const [savePhase, setSavePhase] = useState('idle'); // 'idle' | 'saving' | 'done'
  const [isFormDirty, setIsFormDirty] = useState(false);
  const rowsPerPage = 10;
  const studentSelectedInAnyStructureClass = (studentId, currentFormIndex = 0) => {
    const editingClassId = editingItem?.editingStructureClass ? String(editingItem.dbId || editingItem.id) : null;
    const databaseAssignedElsewhere = Object.entries(databaseClassRosters).some(([classId, ids]) =>
      String(classId) !== String(editingClassId) && ids.some(id => String(id) === String(studentId))
    );
    const cachedAssignedElsewhere = masterData.kelas.some(classItem =>
      String(classItem.dbId || classItem.id) !== String(editingClassId)
      && studentIsSelected(classItem.students, studentId)
    );
    const selectedInOtherDraft = (currentFormIndex === 0
      ? additionalClassForms
      : [kelasForm, ...additionalClassForms.filter((_, index) => index !== currentFormIndex - 1)])
      .some(form => studentIsSelected(form.students, studentId));
    return databaseAssignedElsewhere || cachedAssignedElsewhere || selectedInOtherDraft;
  };

  // Wali Kelas: soroti guru yang sudah dipakai di form kelas lain agar tidak dobel (mirip murid).
  const waliUsedInOtherStructureClass = (teacherId, currentFormIndex) => {
    if (teacherId === '' || teacherId == null) return false;
    const forms = [kelasForm, ...additionalClassForms];
    return forms.some((f, i) => i !== currentFormIndex && String(f.waliKelas || '') === String(teacherId));
  };
  const waliOptionsForStructureClass = (currentFormIndex, currentWaliId) =>
    availableHomeroomTeachers.filter(t => String(t.id) === String(currentWaliId || '') || !waliUsedInOtherStructureClass(t.id, currentFormIndex));

  const classRosterFetchKey = (masterData.kelas || []).map(item => item.dbId || item.id).filter(Boolean).sort().join('|');
  useEffect(() => {
    const classIds = [...new Set((masterData.kelas || []).map(item => item.dbId || item.id).filter(id => id && !String(id).startsWith('kls-')).map(String))];
    if (!classIds.length) {
      setDatabaseClassRosters({});
      return undefined;
    }
    let cancelled = false;
    Promise.all(classIds.map(async classId => {
      try {
        const response = await adminAkademikAPI.getClassStudents(classId);
        const ids = (response.data?.data || []).map(student => String(student.id ?? student.student_id)).filter(Boolean);
        return [classId, ids];
      } catch (error) {
        return [classId, null];
      }
    })).then(entries => {
      if (cancelled) return;
      setDatabaseClassRosters(previous => {
        const next = {};
        entries.forEach(([classId, ids]) => {
          if (ids !== null) next[classId] = ids;
          else if (previous[classId]) next[classId] = previous[classId];
        });
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [classRosterFetchKey, classRosterRefreshToken]);
  const occupiedActivityStudentIds = new Set((masterData.magang || [])
    .filter(activity => activity.tipeKegiatan === magangForm.tipeKegiatan
      && String(activity.dbId || activity.id) !== String(editingItem?.dbId || editingItem?.id || ''))
    .flatMap(activity => (activity.peserta || []).map(student => String(student.id))));

  const activityStudentOptions = studentsList;

  // A category change starts a truly fresh draft. Clear stale validation text
  // whenever an operator changes any field in the activity form.
  useEffect(() => {
    if (activeModal === 'magang' && alertMsg) setAlertMsg(null);
  }, [magangForm, activeModal]);

  // Saat pop-up aktif, halaman di belakang dikunci agar hanya isi pop-up yang dapat di-scroll.
  useEffect(() => {
    const hasOverlay = Boolean(activeModal || deleteConfirm || archiveModalOpen || tabArchiveModalOpen || fasilitasModal);
    if (!hasOverlay) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [activeModal, deleteConfirm, archiveModalOpen, tabArchiveModalOpen, fasilitasModal]);

  useEffect(() => {
    if (activeModal !== 'kbm') return;
    adminAkademikAPI.getTimeSlots().then(response => setTimeSlots(response.data?.data || [])).catch(() => setTimeSlots([]));
    operatorAPI.getSarana().then(response => setKbmRooms(response.data?.data?.rooms || response.data?.rooms || [])).catch(() => setKbmRooms([]));
  }, [activeModal]);

  const isValidAcademicYear = (year) => {
    const regex = /^\d{4} \/ \d{4}$/;
    return regex.test(year);
  };

  useEffect(() => { setDetailPage(1); }, [activeDetailTab]);

  useEffect(() => {
    if (tabArchiveModalOpen || archiveModalOpen) {
      setArchiveForm({ tahunAjaran: '', semester: 'Ganjil' });
    }
  }, [tabArchiveModalOpen, archiveModalOpen]);

  // Fetch dokumen kurikulum saat modal kurikulum dibuka
  useEffect(() => {
    if (activeModal === 'kurikulum') {
      fetchDokumen();
    }
  }, [activeModal]);

  // Fetch dokumen saat tab kurikulum aktif di list view
  useEffect(() => {
    if (activeDetailTab === 'kurikulum') {
      fetchDokumen();
    }
  }, [activeDetailTab]);

  useEffect(() => {
    if (activeDetailTab !== 'magang' && activeModal !== 'magang') return;
    operatorAPI.getAcademicActivities()
      .then(response => {
        const activities = response.data?.data || [];
        setMasterData(previous => ({ ...previous, magang: activities }));
      })
      .catch(error => {
        console.warn('Daftar kegiatan sekolah belum dapat dimuat dari database.', error);
        setMasterData(previous => ({ ...previous, magang: [] }));
      });
  }, [activeDetailTab, activeModal]);

  const COUNTRIES = [
    'Brunei Darussalam', 'Filipina', 'Indonesia', 'Kamboja', 'Laos', 'Malaysia', 'Myanmar', 'Singapura', 'Thailand', 'Timor Leste', 'Vietnam',
    'Amerika Serikat', 'Arab Saudi', 'Australia', 'Belanda', 'Britania Raya', 'Cina', 'India', 'Jepang', 'Jerman', 'Kanada', 'Mesir', 'Prancis',
    'Rusia', 'Selandia Baru', 'Swiss', 'Taiwan', 'Turki', 'Uni Emirat Arab', 'Lainnya',
  ];

  const INDONESIA_REGIONS = {
    'Aceh': ['Banda Aceh', 'Lhokseumawe', 'Langsa', 'Meulaboh', 'Sabang', 'Subulussalam', 'Aceh Besar', 'Aceh Jaya', 'Aceh Barat', 'Aceh Utara', 'Aceh Selatan', 'Aceh Timur', 'Aceh Tengah'],
    'Sumatera Utara': ['Medan', 'Binjai', 'Pematangsiantar', 'Tanjungbalai', 'Tebing Tinggi', 'Padang Sidempuan', 'Sibolga', 'Gunungsitoli', 'Deli Serdang', 'Langkat', 'Karo', 'Simalungun', 'Asahan', 'Labuhanbatu', 'Tapanuli Utara', 'Tapanuli Selatan', 'Tapanuli Tengah', 'Nias'],
    'Sumatera Barat': ['Padang', 'Bukittinggi', 'Payakumbuh', 'Pariaman', 'Solok', 'Sawahlunto', 'Padang Panjang', 'Agam', 'Pasaman', 'Pesisir Selatan'],
    'Riau': ['Pekanbaru', 'Dumai', 'Bengkalis', 'Indragiri Hilir', 'Indragiri Hulu', 'Kampar', 'Kuantan Singingi', 'Pelalawan', 'Rokan Hilir', 'Rokan Hulu', 'Siak', 'Kepulauan Meranti'],
    'Kepulauan Riau': ['Batam', 'Tanjungpinang', 'Bintan', 'Karimun', 'Anambas', 'Lingga', 'Natuna'],
    'Jambi': ['Jambi', 'Sungai Penuh', 'Batanghari', 'Bungo', 'Kerinci', 'Merangin', 'Muaro Jambi', 'Sarolangun', 'Tanjung Jabung Barat', 'Tanjung Jabung Timur', 'Tebo'],
    'Sumatera Selatan': ['Palembang', 'Prabumulih', 'Lubuklinggau', 'Pagar Alam', 'Banyuasin', 'Musi Banyuasin', 'Ogan Ilir', 'Ogan Komering Ilir', 'Ogan Komering Ulu'],
    'Bangka Belitung': ['Pangkalpinang', 'Bangka', 'Bangka Barat', 'Bangka Selatan', 'Bangka Tengah', 'Belitung', 'Belitung Timur'],
    'Bengkulu': ['Bengkulu', 'Bengkulu Selatan', 'Bengkulu Tengah', 'Bengkulu Utara', 'Kaur', 'Kepahiang', 'Lebong', 'Mukomuko', 'Rejang Lebong', 'Seluma'],
    'Lampung': ['Bandar Lampung', 'Metro', 'Lampung Barat', 'Lampung Selatan', 'Lampung Tengah', 'Lampung Timur', 'Lampung Utara', 'Mesuji', 'Pesawaran', 'Pringsewu', 'Tanggamus', 'Tulang Bawang'],
    'DKI Jakarta': ['Jakarta Pusat', 'Jakarta Utara', 'Jakarta Timur', 'Jakarta Selatan', 'Jakarta Barat', 'Kepulauan Seribu'],
    'Jawa Barat': ['Bandung', 'Bekasi', 'Depok', 'Bogor', 'Tasikmalaya', 'Cimahi', 'Sukabumi', 'Cirebon', 'Banjar', 'Sumedang', 'Indramayu', 'Subang', 'Karawang', 'Purwakarta', 'Cianjur', 'Garut', 'Ciamis', 'Kuningan', 'Majalengka'],
    'Banten': ['Tangerang', 'Tangerang Selatan', 'Serang', 'Cilegon', 'Lebak', 'Pandeglang'],
    'Jawa Tengah': ['Semarang', 'Surakarta', 'Salatiga', 'Magelang', 'Pekalongan', 'Tegal', 'Banyumas', 'Batang', 'Blora', 'Boyolali', 'Brebes', 'Cilacap', 'Demak', 'Grobogan', 'Jepara', 'Karanganyar', 'Kebumen', 'Kendal', 'Klaten', 'Kudus'],
    'DI Yogyakarta': ['Yogyakarta', 'Bantul', 'Gunungkidul', 'Kulon Progo', 'Sleman'],
    'Jawa Timur': ['Surabaya', 'Malang', 'Kediri', 'Probolinggo', 'Pasuruan', 'Blitar', 'Batu', 'Madiun', 'Mojokerto', 'Sidoarjo', 'Gresik', 'Lamongan', 'Tuban', 'Bojonegoro', 'Jombang', 'Nganjuk', 'Magetan', 'Ngawi', 'Ponorogo', 'Pacitan', 'Trenggalek', 'Tulungagung', 'Lumajang', 'Jember', 'Bondowoso', 'Situbondo', 'Bangkalan', 'Sampang', 'Pamekasan', 'Sumenep'],
    'Bali': ['Denpasar', 'Badung', 'Bangli', 'Buleleng', 'Gianyar', 'Jembrana', 'Karangasem', 'Klungkung', 'Tabanan'],
    'Nusa Tenggara Barat': ['Mataram', 'Bima', 'Dompu', 'Lombok Barat', 'Lombok Tengah', 'Lombok Timur', 'Lombok Utara', 'Sumbawa', 'Sumbawa Barat'],
    'Nusa Tenggara Timur': ['Kupang', 'Alor', 'Belu', 'Ende', 'Flores Timur', 'Kupang', 'Lembata', 'Malaka', 'Manggarai', 'Manggarai Barat', 'Manggarai Timur', 'Nagekeo', 'Ngada', 'Rote Ndao', 'Sabu Raijua', 'Sikka', 'Sumba Barat', 'Sumba Barat Daya', 'Sumba Tengah', 'Sumba Timur', 'Timor Tengah Selatan', 'Timor Tengah Utara'],
    'Kalimantan Barat': ['Pontianak', 'Singkawang', 'Bengkayang', 'Kapuas Hulu', 'Kayong Utara', 'Ketapang', 'Kubu Raya', 'Landak', 'Melawi', 'Mempawah', 'Sambas', 'Sanggau', 'Sekadau', 'Sintang'],
    'Kalimantan Tengah': ['Palangkaraya', 'Barito Selatan', 'Barito Timur', 'Barito Utara', 'Gunung Mas', 'Kapuas', 'Katingan', 'Kotawaringin Barat', 'Kotawaringin Timur', 'Lamandau', 'Murung Raya', 'Pulang Pisau', 'Sukamara', 'Seruyan'],
    'Kalimantan Selatan': ['Banjarmasin', 'Banjarbaru', 'Balangan', 'Banjar', 'Barito Kuala', 'Hulu Sungai Selatan', 'Hulu Sungai Tengah', 'Hulu Sungai Utara', 'Kotabaru', 'Tabalong', 'Tanah Bumbu', 'Tanah Laut', 'Tapin'],
    'Kalimantan Timur': ['Samarinda', 'Balikpapan', 'Bontang', 'Berau', 'Kutai Barat', 'Kutai Kartanegara', 'Kutai Timur', 'Mahakam Ulu', 'Paser', 'Penajam Paser Utara'],
    'Kalimantan Utara': ['Tanjung Selor', 'Tarakan', 'Bulungan', 'Malinau', 'Nunukan', 'Tana Tidung'],
    'Sulawesi Utara': ['Manado', 'Bitung', 'Tomohon', 'Kotamobagu', 'Bolaang Mongondow', 'Bolaang Mongondow Selatan', 'Bolaang Mongondow Timur', 'Bolaang Mongondow Utara', 'Kepulauan Sangihe', 'Kepulauan Siau Tagulandang Biaro', 'Kepulauan Talaud', 'Minahasa', 'Minahasa Selatan', 'Minahasa Tenggara', 'Minahasa Utara'],
    'Gorontalo': ['Gorontalo', 'Boalemo', 'Bone Bolango', 'Gorontalo Utara', 'Pohuwato'],
    'Sulawesi Tengah': ['Palu', 'Banggai', 'Banggai Kepulauan', 'Banggai Laut', 'Buol', 'Donggala', 'Morowali', 'Morowali Utara', 'Parigi Moutong', 'Poso', 'Sigi', 'Tojo Una-Una', 'Tolitoli'],
    'Sulawesi Barat': ['Mamuju', 'Majene', 'Mamasa', 'Mamuju Tengah', 'Mamuju Utara', 'Polewali Mandar'],
    'Sulawesi Selatan': ['Makassar', 'Parepare', 'Palopo', 'Bantaeng', 'Barru', 'Bone', 'Bulukumba', 'Enrekang', 'Gowa', 'Jeneponto', 'Kepulauan Selayar', 'Luwu', 'Luwu Timur', 'Luwu Utara', 'Maros', 'Pangkajene dan Kepulauan', 'Pinrang', 'Sidenreng Rappang', 'Sinjai', 'Soppeng', 'Takalar', 'Tana Toraja', 'Toraja Utara', 'Wajo'],
    'Sulawesi Tenggara': ['Kendari', 'Bau-Bau', 'Bombana', 'Buton', 'Buton Selatan', 'Buton Tengah', 'Buton Utara', 'Kolaka', 'Kolaka Timur', 'Kolaka Utara', 'Konawe', 'Konawe Kepulauan', 'Konawe Selatan', 'Konawe Utara', 'Muna', 'Muna Barat', 'Wakatobi'],
    'Maluku': ['Ambon', 'Tual', 'Buru', 'Buru Selatan', 'Kepulauan Aru', 'Maluku Barat Daya', 'Maluku Tengah', 'Maluku Tenggara', 'Maluku Tenggara Barat', 'Seram Bagian Barat', 'Seram Bagian Timur'],
    'Maluku Utara': ['Ternate', 'Tidore Kepulauan', 'Halmahera Barat', 'Halmahera Tengah', 'Halmahera Utara', 'Halmahera Selatan', 'Kepulauan Sula', 'Halmahera Timur', 'Pulau Morotai', 'Pulau Taliabu'],
    'Papua': ['Jayapura', 'Biak Numfor', 'Keerom', 'Kepulauan Yapen', 'Mamberamo Raya', 'Sarmi', 'Supiori', 'Waropen'],
    'Papua Barat': ['Manokwari', 'Fakfak', 'Kaimana', 'Manokwari Selatan', 'Pegunungan Arfak', 'Teluk Bintuni', 'Teluk Wondama'],
    'Papua Selatan': ['Merauke', 'Asmat', 'Boven Digoel', 'Mappi'],
    'Papua Tengah': ['Nabire', 'Deiyai', 'Dogiyai', 'Intan Jaya', 'Mimika', 'Paniai', 'Puncak', 'Puncak Jaya'],
    'Papua Pegunungan': ['Wamena', 'Jayawijaya', 'Lanny Jaya', 'Mamberamo Tengah', 'Nduga', 'Pegunungan Bintang', 'Tolikara', 'Yahukimo', 'Yalimo'],
    'Papua Barat Daya': ['Sorong', 'Maybrat', 'Raja Ampat', 'Sorong Selatan', 'Tambrauw'],
  };

  const toggleJurusan = (j) => {
    setSelectedJurusans(prev => {
      const next = prev.includes(j) ? prev.filter(x => x !== j) : [...prev, j];
      // Bandingkan dgn data asli - hanya dirty jika berbeda
      if (editingItem?.jurusans) {
        const original = [...editingItem.jurusans].sort().join(',');
        const current = [...next].sort().join(',');
        // Juga cek apakah nama mapel sudah berubah
        const namaChanged = mapelForm.nama !== (editingItem.nama || '');
        setIsFormDirty(original !== current || namaChanged);
      } else {
        setIsFormDirty(next.length > 0);
      }
      return next;
    });
  };

  const handleOpenModal = (id) => {
    setKelasForm(INITIAL_KELAS_FORM);
    setMapelForm(INITIAL_MAPEL_FORM);
    setGuruJadwalForm(INITIAL_GURU_JADWAL_FORM);
    if (id === 'kurikulum') {
      setKurikulumForm(INITIAL_KURIKULUM_FORM);
      setDokumenForm(INITIAL_DOKUMEN_FORM);
      setEditingCurriculumDocument(null);
      setExistingCurriculumFile(null);
      if (dokumenInputRef.current) dokumenInputRef.current.value = '';
    }
    setJurusanForm(INITIAL_JURUSAN_FORM);
    setMagangForm(INITIAL_MAGANG_FORM);
    setSearchStudentMagang('');
    setSelectedJurusans([]);
    setSearchStudentKelas('');
    setAddAnotherClass(false);
    setAdditionalClassForms([]);
    setAdditionalJadwalForms([]);
    setAddAnotherJadwal(false);
    setKbmEditBaseline('');
    if (id === 'kbm') {
      setKbmClassId('');
      setClassStudents([]);
      setStudentSearchKbm('');
      setKbmTerm({ tahunAjaran: '', semester: '' });
      setWaliKelasId('');
    }
    if (id === 'struktur') {
      // Jangan tampilkan cache akademik lama saat popup dibuka. Data terbaru
      // akan diisi lagi dari /operator/master-data melalui onSync.
      setMasterData(prev => ({ ...prev, jurusan: [], kelas: [], mapel: [] }));
      triggerSync();
      setExistingJurusans([]);
      operatorAPI.getMasterData()
        .then(response => {
          const rows = response.data?.data?.jurusans || [];
          setExistingJurusans(rows.map(row => ({
            id: row.id,
            dbId: row.id,
            nama: row.name,
            kode: row.code,
            ketuaId: row.head_user_id || '',
          })));
        })
        .catch(() => setExistingJurusans([]));
    }
    setSelectedExistingJurusanId(null);
    setAlertMsg(null);
    setEditingItem(null);
    setIsSaving(false);
    setIsFormDirty(false);
    setAlertMsg(null);
    setActiveModal(id);
  };

  // Detail KBM memakai editor yang sama, namun seluruh nilai jadwal lama
  // dibawa kembali agar operator cukup mengubah bagian yang diperlukan.
  const openKbmScheduleEditor = (item) => {
    const normalizedTime = toApiTime;
    const [startTime = '', endTime = ''] = String(item.jam || '').split(' - ').map(normalizedTime);
    const classId = item.kelasId || item.kelas_id || '';
    const teacherId = item.guruId || item.guru_id || '';
    const classRecord = (masterData.kelas || []).find(k => String(k.dbId || k.id) === String(classId));

    setEditingItem(item);
    setKbmClassId(String(classId));
    setWaliKelasId(String(item.wali_kelas_id || classRecord?.waliId || classRecord?.homeroom_teacher_id || ''));
    setKbmTerm({
      tahunAjaran: item.tahunAjaran || item.tahun_ajaran || '',
      semester: item.semester || '',
    });
    const restoredForm = {
      ...INITIAL_GURU_JADWAL_FORM,
      guruId: String(teacherId),
      kelasId: String(classId),
      mapelId: String(item.mapelId || item.mapel_id || ''),
      mapelName: item.mapel || item.mapel_nama || '',
      hari: String(item.hari || '').toLowerCase(),
      kategoriJadwal: item.kategoriJadwal || (item.kategori_jadwal === 'umum' ? 'a' : item.kategori_jadwal) || 'a',
      jenisJadwal: 'manual',
      jamMulai: startTime,
      jamSelesai: endTime,
      ruangan: item.ruang || item.ruang_nama || '',
      ruangId: String(item.ruangId || item.ruang_id || ''),
      tahunAjaran: item.tahunAjaran || item.tahun_ajaran || '',
      semester: item.semester || '',
      kodeBelajar: item.kode_belajar || '',
    };
    setGuruJadwalForm(restoredForm);
    setKbmEditBaseline(kbmScheduleSignature(restoredForm, {
      waliKelasId: item.wali_kelas_id || classRecord?.waliId || classRecord?.homeroom_teacher_id || '',
      tahunAjaran: item.tahunAjaran || item.tahun_ajaran || '',
      semester: item.semester || '',
    }));
    setAdditionalJadwalForms([]);
    setAddAnotherJadwal(false);
    setAlertMsg(null);
    setIsSaving(false);
    setIsFormDirty(false);
    setActiveModal('kbm');
  };

  const handleSimpanKelas = () => {
    if (!kelasForm.jurusan) { showAlert('error', 'Pilih jurusan terlebih dahulu.'); return; }

    const targetNama = `${kelasForm.tingkat} ${kelasForm.jurusan} ${kelasForm.nomorKelas}`;
    const isDuplicate = masterData.kelas.some(x => x.nama === targetNama && x.id !== (editingItem?.id || ''));
    if (isDuplicate) {
      toast.dismiss();
      toast.error("maaf, data sudah tersedia.", {
        style: {
          background: '#fff',
          color: '#b91c1c',
          fontWeight: '900',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          borderRadius: '16px',
          padding: '16px 24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #fee2e2'
        }
      });
      return;
    }

    const coach = allTeachers.find(t => String(t.id) === String(kelasForm.waliKelas));
    const newData = {
      id: editingItem ? editingItem.id : `kls-${Date.now()}`,
      savedAt: new Date().toISOString(),
      tingkat: kelasForm.tingkat,
      jurusan: kelasForm.jurusan,
      nomorKelas: kelasForm.nomorKelas,
      nama: targetNama,
      homeroom_teacher_name: coach ? coach.name || coach.full_name : 'Belum ditentukan',
      kapasitas: Number(kelasForm.kapasitas) || 36,
      isActive: true,
      waliId: kelasForm.waliKelas,
      students: [],
      dbId: editingItem?.dbId
    };

    setIsSaving(true);
    setSavePhase('saving');
    setTimeout(async () => {
      const localId = newData.id;
      const nextKelas = editingItem
        ? masterData.kelas.map(x => x.id === editingItem.id ? newData : x)
        : [newData, ...masterData.kelas];

      let synced = false;
      try {
        if (editingItem?.dbId) {
          const response = await operatorAPI.updateSchoolClass(editingItem.dbId, {
            name: newData.nama,
            grade_level: newData.tingkat,
            department_code: newData.jurusan,
            capacity: newData.kapasitas,
          });
          newData.dbId = response.data?.data?.id || editingItem.dbId;
          synced = true;
        } else {
          const result = await syncClassesSnapshot(nextKelas, { silent: true });
          synced = result.success;
          newData.dbId = result.dbIdMap?.[newData.nama] || newData.dbId;
        }
        setMasterData(prev => ({ ...prev, kelas: editingItem
          ? prev.kelas.map(item => item.id === editingItem.id ? newData : item)
          : [{ ...newData }, ...prev.kelas]
        }));
      } catch (error) {
        setIsSaving(false);
        setSavePhase('idle');
        showAlert('error', error?.response?.data?.message || 'Kelas gagal disimpan ke database.');
        return;
      }

      setSavePhase('done');
      showAlert(
        'success',
        'Kelas tersimpan dan sinkron ke database berhasil.'
      );
      if (synced) triggerSync(); // refresh agar guru wali kelas langsung dapat data kelasnya
      setTimeout(() => closeModal(), 700);
    }, 500);
  };

  const handleSimpanMapel = () => {
    if (!mapelForm.nama) { showAlert('error', 'Input Mata Pelajaran.'); return; }
    if (!mapelForm.kode) { showAlert('error', 'Kode Mapel harus diisi.'); return; }

    const isDuplicate = masterData.mapel.some(x => x.kode === mapelForm.kode && x.id !== (editingItem?.id || ''));
    if (isDuplicate) {
      toast.dismiss();
      toast.error("maaf, kode mapel sudah tersedia.", {
        style: {
          background: '#fff',
          color: '#b91c1c',
          fontWeight: '900',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          borderRadius: '16px',
          padding: '16px 24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #fee2e2'
        }
      });
      return;
    }

    const newData = {
      id: editingItem ? editingItem.id : `mpl-${Date.now()}`,
      savedAt: new Date().toISOString(),
      nama: mapelForm.nama,
      kode: mapelForm.kode,
      kelompok: mapelForm.kelompok,
      jurusan: mapelForm.jurusan,
      tingkat: mapelForm.tingkat,
      KKM: 75,
      jam: 2
    };

    setIsSaving(true);
    setSavePhase('saving');
    setTimeout(async () => {
      const localId = newData.id;

      const nextMapel = editingItem
        ? masterData.mapel.map(x => x.id === editingItem.id ? newData : x)
        : [newData, ...masterData.mapel];

      setMasterData(prev => ({ ...prev, mapel: nextMapel }));

      // Sync ke database
      try {
        const res = await operatorAPI.syncSubjects({
          subjects: [{
            local_id: localId,
            nama: newData.nama,
            kode: newData.kode,
            jurusan: newData.jurusan,
            tingkat: newData.tingkat,
            kelompok: newData.kelompok,
          }]
        });

        // Update dbId dari response backend
        const synced = res.data?.data?.[0];
        if (synced?.db_id) {
          setMasterData(prev => ({
            ...prev,
            mapel: prev.mapel.map(m =>
              m.id === localId ? { ...m, dbId: synced.db_id } : m
            )
          }));
        }

        setSavePhase('done');
        triggerSync(); // refresh agar mapel baru terlihat di semua user
        toast.dismiss();
        toast.success("âœ… Mata pelajaran berhasil ditambahkan & disinkronkan.", {
          style: {
            background: '#fff',
            color: '#15803d',
            fontWeight: '900',
            fontSize: '11px',
            letterSpacing: '1px',
            borderRadius: '16px',
            padding: '16px 24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #dcfce7'
          }
        });
      } catch (err) {
        setSavePhase('done');
        toast.dismiss();
        toast.success("✅ Mata pelajaran tersimpan lokal. Sinkronisasi DB gagal.", {
          style: {
            background: '#fff',
            color: '#b45309',
            fontWeight: '900',
            fontSize: '11px',
            letterSpacing: '1px',
            borderRadius: '16px',
            padding: '16px 24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid #fef3c7'
          }
        });
      }

      setTimeout(() => closeModal(), 700);
    }, 300);
  };

  const handleSimpanGuru = () => {
    if (!guruForm.guruId) { showAlert('error', 'silahkan pilih guru,'); return; }
    if (!guruForm.jurusan) { showAlert('error', 'Silahkan pilih jurusan terlebih dahulu.'); return; }
    if (!guruForm.nip) { showAlert('error', 'NIP guru belum di input.'); return; }
    if (guruForm.nip.length < 18) { showAlert('error', 'NIP tidak sesuai.'); return; }
    if (guruForm.mapel.length === 0) { showAlert('error', 'Silahkan pilih mata pelajaran guru itu boss...'); return; }

    const isDuplicate = masterData.guru.some(x => x.nip === guruForm.nip && x.id !== (editingItem?.id || ''));
    if (isDuplicate) {
      toast.dismiss();
      toast.error("maaf, data sudah tersedia.", {
        style: {
          background: '#fff',
          color: '#b91c1c',
          fontWeight: '900',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          borderRadius: '16px',
          padding: '16px 24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #fee2e2'
        }
      });
      return;
    }

    const teacherObj = allTeachers.find(t => String(t.id) === String(guruForm.guruId));
    const newData = {
      id: editingItem ? editingItem.id : `gr-${Date.now()}`,
      savedAt: new Date().toISOString(),
      guruId: guruForm.guruId,
      name: teacherObj ? teacherObj.name || teacherObj.full_name : 'Guru',
      nip: guruForm.nip,
      jurusan: guruForm.jurusan,
      d_bidang: 'Akademik',
      status: 'PNS',
      mapel: guruForm.mapel
    };

    setIsSaving(true);
    setSavePhase('saving');
    setTimeout(() => {
      setMasterData(prev => ({
        ...prev,
        guru: editingItem
          ? prev.guru.map(x => x.id === editingItem.id ? newData : x)
          : [newData, ...prev.guru]
      }));
      setSavePhase('done');
      setTimeout(() => closeModal(), 700);
    }, 500);
  };

  const generateKodeBelajar = () => {
    const source = [guruJadwalForm.kelasId, guruJadwalForm.guruId, guruJadwalForm.mapelName, guruJadwalForm.hari, guruJadwalForm.kategoriJadwal, guruJadwalForm.jamMulai, guruJadwalForm.jamSelesai].join('|');
    if (!guruJadwalForm.kelasId || !guruJadwalForm.guruId || !guruJadwalForm.mapelName || !guruJadwalForm.hari || !guruJadwalForm.jamMulai || !guruJadwalForm.jamSelesai) return;
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let index = 0; index < 4; index += 1) code += alphabet[(hash >>> (index * 5)) & 31];
    const random = window.crypto?.getRandomValues ? window.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 0xffffffff);
    for (let index = 0; index < 4; index += 1) code += alphabet[(random >>> (index * 5)) & 31];
    setGuruJadwalForm(form => ({ ...form, kodeBelajar: code }));
  };

  const tambahGuruDanJadwal = () => {
    setSelectedTimeSlotIds([]);
    setGuruJadwalForm(form => ({
      ...form,
      guruId: '',
      mapelId: '',
      mapelName: '',
      hari: '',
      kategoriJadwal: '',
      jamMulai: '',
      jamSelesai: '',
      ruangan: '',
      ruangId: '',
      kodeBelajar: '',
      sesi: 'manual',
      jenisJadwal: 'manual',
    }));
  };

  const EMPTY_KBM_JADWAL = (kelasId) => ({
    ...INITIAL_GURU_JADWAL_FORM,
    kelasId,
    sesi: 'manual',
    jenisJadwal: 'manual',
    semester: guruJadwalForm.semester,
    tahunAjaran: guruJadwalForm.tahunAjaran,
    kategoriJadwal: '',
  });

  const generateKodeUntukJadwal = (form, apply) => {
    const source = [form.kelasId, form.guruId, form.mapelName, form.hari, form.kategoriJadwal, form.jamMulai, form.jamSelesai].join('|');
    if (!form.kelasId || !form.guruId || !form.mapelName || !form.hari || !form.jamMulai || !form.jamSelesai) return;
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let index = 0; index < 4; index += 1) code += alphabet[(hash >>> (index * 5)) & 31];
    const random = window.crypto?.getRandomValues ? window.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 0xffffffff);
    for (let index = 0; index < 4; index += 1) code += alphabet[(random >>> (index * 5)) & 31];
    apply(code);
  };

  const handleSimpanGuruJadwal = async () => {
    if (activeModal === 'kbm') {
      if (!guruJadwalForm.guruId || !guruJadwalForm.kelasId || !guruJadwalForm.mapelName || !guruJadwalForm.hari || !guruJadwalForm.jamMulai || !guruJadwalForm.jamSelesai || !guruJadwalForm.kodeBelajar) return;
      if (additionalJadwalForms.some(form => !form.guruId || !form.mapelName || !form.hari || !form.kategoriJadwal || !form.jamMulai || !form.jamSelesai || !form.kodeBelajar)) {
        showAlert('error', 'Lengkapi guru, mapel, hari, kategori, jam, dan kode pada jadwal tambahan.');
        return;
      }
      // Modal KBM selalu memakai matriks JP; dua properti berikut hanya
      // kompatibilitas untuk form jadwal lama yang masih berbagi handler ini.
      guruJadwalForm.sesi = 'manual';
      guruJadwalForm.jenisJadwal = 'manual';
      setGuruJadwalForm(f => ({ ...f, sesi: 'manual', jenisJadwal: 'manual' }));
    }
    if (!guruJadwalForm.guruId) { showAlert('error', 'Pilih guru terlebih dahulu.'); return; }
    if (!guruJadwalForm.hari) { showAlert('error', 'Silahkan pilih hari.'); return; }
    if (!guruJadwalForm.sesi) { showAlert('error', 'Silahkan pilih sesi.'); return; }
    if (!guruJadwalForm.jenisJadwal) { showAlert('error', 'Pilih jenis jadwal (Reguler, Produktif, atau Manual).'); return; }
    if (!guruJadwalForm.kelasId) { showAlert('error', 'Pilih kelas.'); return; }
    if (!guruJadwalForm.mapelId && !(activeModal === 'kbm' && guruJadwalForm.mapelName)) { showAlert('error', 'Pilih mata pelajaran.'); return; }
    
    if (guruJadwalForm.jenisJadwal === 'reguler' && !guruJadwalForm.slotWaktu) { showAlert('error', 'Pilih slot waktu reguler.'); return; }
    if (guruJadwalForm.jenisJadwal === 'produktif' && !guruJadwalForm.slotWaktu) { showAlert('error', 'Pilih slot waktu produktif.'); return; }
    if (guruJadwalForm.jenisJadwal === 'manual') {
      if (!guruJadwalForm.jamMulai || !guruJadwalForm.jamSelesai) { showAlert('error', 'Input jam mulai dan selesai.'); return; }
      const m1 = guruJadwalForm.jamMulai.split(':');
      const m2 = guruJadwalForm.jamSelesai.split(':');
      const startMins = parseInt(m1[0])*60 + parseInt(m1[1]);
      const endMins = parseInt(m2[0])*60 + parseInt(m2[1]);
      const diffMins = endMins - startMins;
      
      if (diffMins <= 0) {
        showAlert('error', 'Jam mulai harus lebih awal dari jam selesai.'); return;
      }
      if (activeModal !== 'kbm' && diffMins > 180) {
        showAlert('error', 'Durasi maksimal 180 menit (3 jam) untuk jadwal manual.'); return;
      }
    }

    // Mapping slot ID ke jam aktual (format H:i untuk backend)
    const SLOT_JAM = {
      'R1':  { mulai: '07:30', selesai: '08:30' },
      'R2':  { mulai: '08:30', selesai: '09:30' },
      'R4':  { mulai: '10:00', selesai: '11:00' },
      'R10': { mulai: '11:00', selesai: '12:00' },
      'R11': { mulai: '12:00', selesai: '13:00' },
      'R5':  { mulai: '11:00', selesai: '11:30' },
      'R6':  { mulai: '13:00', selesai: '14:00' },
      'R7':  { mulai: '14:00', selesai: '15:00' },
      'R9':  { mulai: '15:30', selesai: '16:30' },
      'P1':  { mulai: '10:00', selesai: '12:00' },
      'P2':  { mulai: '13:00', selesai: '15:00' },
      'P3':  { mulai: '15:00', selesai: '17:00' },
    };

    let jamMulai, jamSelesai;
    if (guruJadwalForm.jenisJadwal === 'manual') {
      jamMulai = guruJadwalForm.jamMulai;
      jamSelesai = guruJadwalForm.jamSelesai;
    } else {
      const slot = SLOT_JAM[guruJadwalForm.slotWaktu];
      if (!slot) { showAlert('error', 'Slot waktu tidak valid.'); return; }
      jamMulai = slot.mulai;
      jamSelesai = slot.selesai;
    }

    const teacherObj = allTeachers.find(t => String(t.id) === String(guruJadwalForm.guruId));
    const kelasObj = masterData.kelas.find(k => String(k.dbId || k.id) === String(guruJadwalForm.kelasId));
    const mapelObj = (masterData.mapel || []).find(m => String(m.dbId || m.id) === String(guruJadwalForm.mapelId));

    // Resolve kelas_id: gunakan dbId jika ada, lalu coba ID numerik
    const kelasIdNumeric = kelasObj?.dbId
      ? Number(kelasObj.dbId)
      : (!isNaN(Number(guruJadwalForm.kelasId)) && !String(guruJadwalForm.kelasId).startsWith('kls-')
          ? Number(guruJadwalForm.kelasId)
          : null);

    // Resolve mapel_id: gunakan dbId jika ada, lalu coba ID numerik, fallback ke null
    const mapelIdNumeric = mapelObj?.dbId
      ? Number(mapelObj.dbId)
      : (!isNaN(Number(guruJadwalForm.mapelId)) && !String(guruJadwalForm.mapelId).startsWith('mpl-')
          ? Number(guruJadwalForm.mapelId)
          : null);

    // Jika mapel belum punya dbId (baru dibuat lokal, sync belum berhasil),
    // coba auto-sync ke database sebelum lanjut simpan jadwal.
    let resolvedMapelId = mapelIdNumeric;
    if (!resolvedMapelId && mapelObj) {
      try {
        const syncRes = await operatorAPI.syncSubjects({
          subjects: [{
            local_id: mapelObj.id,
            nama: mapelObj.nama,
            kode: mapelObj.kode,
            jurusan: mapelObj.jurusan,
            tingkat: mapelObj.tingkat,
            kelompok: mapelObj.kelompok,
          }]
        });
        const synced = syncRes.data?.data?.[0];
        if (synced?.db_id) {
          resolvedMapelId = Number(synced.db_id);
          // Update state agar dbId tersimpan untuk sesi berikutnya
          setMasterData(prev => ({
            ...prev,
            mapel: prev.mapel.map(m => String(m.id) === String(mapelObj.id) ? { ...m, dbId: synced.db_id } : m)
          }));
        }
      } catch (_) {
        // Sync gagal, lanjut dengan error di bawah
      }
    }

    if (!resolvedMapelId && !(activeModal === 'kbm' && guruJadwalForm.mapelName)) {
      showAlert('error', 'Mata pelajaran belum tersinkronisasi ke database. Pastikan data mapel sudah disimpan di tab Master Data.');
      return;
    }

    setIsSaving(true);
    setSavePhase('saving');

    try {
      const payload = {
        guru_id:      Number(guruJadwalForm.guruId),
        kelas_id:     kelasIdNumeric || undefined,
        kelas_nama:   !kelasIdNumeric ? (kelasObj?.nama || null) : undefined,
        mapel_id:     resolvedMapelId || undefined,
        mapel_nama:   guruJadwalForm.mapelName || (resolvedMapelId ? null : (mapelObj?.nama || null)),
        hari:         guruJadwalForm.hari.toLowerCase(),
        jam_mulai:    toApiTime(jamMulai),
        jam_selesai:  toApiTime(jamSelesai),
        tahun_ajaran: guruJadwalForm.tahunAjaran || kbmTerm.tahunAjaran || null,
        semester:     guruJadwalForm.semester || kbmTerm.semester || null,
        kategori_jadwal: guruJadwalForm.kategoriJadwal || null,
        ruang_id:      guruJadwalForm.ruangId ? Number(guruJadwalForm.ruangId) : null,
        ruang_nama:    guruJadwalForm.ruangan?.trim() || null,
        time_slot_ids: activeModal === 'kbm' ? undefined : selectedTimeSlotIds,
        kode_belajar: guruJadwalForm.kodeBelajar || undefined,
      };

      let savedJadwal;
      let savedAdditionalJadwals = [];
      if (editingItem && editingItem.dbId) {
        const res = await adminAkademikAPI.updateJadwalGuru(editingItem.dbId, payload);
        savedJadwal = res.data.data;
      } else {
        const res = await adminAkademikAPI.createJadwalGuru(payload);
        savedJadwal = res.data.data;
      }

      if (activeModal === 'kbm' && additionalJadwalForms.length) {
        // Simpan berurutan agar pemeriksaan bentrok server melihat jadwal
        // yang baru saja tersimpan sebelum memvalidasi baris berikutnya.
        for (const form of additionalJadwalForms) {
          const response = await adminAkademikAPI.createJadwalGuru({
            guru_id: Number(form.guruId),
            kelas_id: kelasIdNumeric || Number(form.kelasId),
            mapel_nama: form.mapelName,
            hari: form.hari.toLowerCase(),
            jam_mulai: toApiTime(form.jamMulai),
            jam_selesai: toApiTime(form.jamSelesai),
            tahun_ajaran: form.tahunAjaran || kbmTerm.tahunAjaran || null,
            semester: form.semester || guruJadwalForm.semester || null,
            kategori_jadwal: form.kategoriJadwal || null,
            ruang_nama: form.ruangan?.trim() || null,
            kode_belajar: form.kodeBelajar,
          });
          savedAdditionalJadwals.push(response.data?.data);
        }
      }

      // Simpan dbId kelas dari response backend ke localStorage supaya next time tidak perlu fallback
      if (savedJadwal?.kelas_id && kelasObj && !kelasIdNumeric) {
        setMasterData(prev => ({
          ...prev,
          kelas: prev.kelas.map(k =>
            k.id === guruJadwalForm.kelasId ? { ...k, dbId: savedJadwal.kelas_id } : k
          )
        }));
      }

      const getJamDisplay = () => {
        if (guruJadwalForm.jenisJadwal === 'manual') return `${guruJadwalForm.jamMulai} - ${guruJadwalForm.jamSelesai}`;
        const slot = SLOT_JAM[guruJadwalForm.slotWaktu];
        return slot ? `${slot.mulai.replace(':', '.')} - ${slot.selesai.replace(':', '.')}` : '-';
      };

      const newData = {
        id: editingItem ? editingItem.id : `jdw-${Date.now()}`,
        savedAt: new Date().toISOString(),
        dbId: savedJadwal?.id || Date.now(),
        hari: guruJadwalForm.hari,
        sesi: guruJadwalForm.sesi,
        jenisJadwal: guruJadwalForm.jenisJadwal,
        mapelId: guruJadwalForm.mapelId,
        mapel: guruJadwalForm.mapelName || mapelObj?.nama || guruJadwalForm.mapelId,
        jam: getJamDisplay(),
        kelasId: guruJadwalForm.kelasId,
        kelas: kelasObj?.nama || 'Kelas',
        ruang: guruJadwalForm.ruangan?.trim() || '-',
        guruId: guruJadwalForm.guruId,
        teacher_name: teacherObj ? teacherObj.name || teacherObj.full_name : 'Guru',
        kode_belajar: savedJadwal?.kode_belajar || guruJadwalForm.kodeBelajar,
        tahunAjaran: guruJadwalForm.tahunAjaran || kbmTerm.tahunAjaran,
        semester: guruJadwalForm.semester || kbmTerm.semester,
        kategoriJadwal: guruJadwalForm.kategoriJadwal,
        created_at: savedJadwal?.created_at || new Date().toISOString(),
        updated_at: savedJadwal?.updated_at || new Date().toISOString(),
      };

      const additionalLocalSchedules = additionalJadwalForms.map((form, index) => {
        const saved = savedAdditionalJadwals[index] || {};
        const teacher = allTeachers.find(item => String(item.id) === String(form.guruId));
        return {
          id: saved.id || `jdw-${Date.now()}-${index + 1}`,
          dbId: saved.id,
          savedAt: saved.created_at || new Date().toISOString(),
          created_at: saved.created_at || new Date().toISOString(),
          updated_at: saved.updated_at || new Date().toISOString(),
          hari: form.hari,
          sesi: 'manual',
          jenisJadwal: 'manual',
          mapelId: '',
          mapel: form.mapelName,
          jam: `${form.jamMulai} - ${form.jamSelesai}`,
          kelasId: guruJadwalForm.kelasId,
          kelas: kelasObj?.nama || kelasObj?.name || 'Kelas',
          ruang: form.ruangan?.trim() || '-',
          guruId: form.guruId,
          teacher_name: teacher?.name || teacher?.full_name || 'Guru',
          kode_belajar: saved.kode_belajar || form.kodeBelajar,
          tahunAjaran: form.tahunAjaran || kbmTerm.tahunAjaran || guruJadwalForm.tahunAjaran,
          semester: form.semester || guruJadwalForm.semester || kbmTerm.semester,
          kategoriJadwal: form.kategoriJadwal,
        };
      });

      setMasterData(prev => ({
        ...prev,
        jadwal: editingItem
          ? [...prev.jadwal.map(x => x.id === editingItem.id || String(x.dbId) === String(editingItem.dbId) ? newData : x), ...additionalLocalSchedules]
          : [...additionalLocalSchedules, newData, ...prev.jadwal]
      }));

      setSavePhase('done');
      triggerSync(); // refresh agar guru ybs langsung menerima jadwal barunya
      if (activeModal === 'kbm') {
        // Samakan perilaku dengan Card 1: tampilkan status selesai sesaat,
        // lalu tutup popup hanya setelah semua jadwal tambahan telah tersimpan.
        setAdditionalJadwalForms([]);
        setAddAnotherJadwal(false);
        setTimeout(() => {
          setIsSaving(false);
          setSavePhase('idle');
          closeModal();
        }, 650);
        return;
      }
      toast.success("âœ… Jadwal berhasil disimpan.");
      setTimeout(() => closeModal(), 700);
    } catch (error) {
      if (activeModal === 'kbm') {
        setSavePhase('idle');
        setIsSaving(false);
        const message = error?.response?.data?.message || 'Jadwal belum tersimpan. Periksa kembali data yang diisi.';
        console.warn('Jadwal KBM terpadu belum tersimpan.', error);
        showAlert('error', message);
        return;
      }
      setSavePhase(null);
      setIsSaving(false);
      
      const status = error.response?.status;
      const originalMsg = error.response?.data?.message || 'Gagal menyimpan jadwal ke database.';

      // Tampilkan pesan spesifik dari backend (nama guru/hari/jam/mapel/kelas)
      // agar user langsung tahu alasan bentrok. Modal TIDAK ditutup saat error.
      if (status === 409 || status === 422) {
        toast.error(originalMsg, { duration: 7000 });
      } else {
        showAlert('error', originalMsg);
      }
    }
  };

  const handleSimpanJurusan = async () => {
    if (!jurusanForm.nama) { showAlert('error', 'Input nama jurusan terlebih dahulu.'); return; }
    if (!jurusanForm.kode) { showAlert('error', 'Input kode/singkatan jurusan.'); return; }

    const isDuplicate = masterData.jurusan.some(x =>
      (x.nama === jurusanForm.nama || x.kode === jurusanForm.kode) && x.id !== (editingItem?.id || '')
    );
    if (isDuplicate) {
      toast.dismiss();
      toast.error("maaf, data sudah tersedia.", {
        style: {
          background: '#fff',
          color: '#b91c1c',
          fontWeight: '900',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          borderRadius: '16px',
          padding: '16px 24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #fee2e2'
        }
      });
      return;
    }

    setIsSaving(true);
    setSavePhase('saving');

    try {
      const payload = {
        name:         jurusanForm.nama,
        code:         jurusanForm.kode,
        head_user_id: jurusanForm.ketuaId || null,
      };

      let responseData;
      if (editingItem && editingItem.dbId) {
        // Update existing DB jurusan
        const res = await operatorAPI.updateJurusan(editingItem.dbId, payload);
        responseData = res.data?.data;
      } else {
        // Create new jurusan in DB
        const res = await operatorAPI.createJurusan(payload);
        responseData = res.data?.data;
      }

      // Build local entry from API response
      const matchedTeacher = teacherOptions.find(t => String(t.id) === String(responseData?.head_user_id ?? jurusanForm.ketuaId));
      const savedEntry = {
        id:        responseData?.id ?? (editingItem?.id ?? `jr-${Date.now()}`),
        dbId:      responseData?.id ?? editingItem?.dbId,
        savedAt:   responseData?.updated_at ?? responseData?.created_at ?? new Date().toISOString(),
        nama:      responseData?.name ?? jurusanForm.nama,
        kode:      responseData?.code ?? jurusanForm.kode,
        ketuaId:   String(responseData?.head_user_id ?? jurusanForm.ketuaId),
        head_name: (responseData?.head_name && responseData?.head_name !== '-') ? responseData.head_name : (matchedTeacher ? (matchedTeacher.name || matchedTeacher.full_name) : '-'),
        deskripsi: 'Program Keahlian Sekolah',
      };

      setMasterData(prev => ({
        ...prev,
        jurusan: editingItem
          ? prev.jurusan.map(x => (x.id === editingItem.id || x.dbId === editingItem.dbId) ? savedEntry : x)
          : [savedEntry, ...prev.jurusan],
      }));

      setSavePhase('done');
      triggerSync(); // refresh kbmPreview agar user lain melihat data jurusan terbaru
      setTimeout(() => closeModal(), 700);
    } catch (err) {
      setSavePhase('idle');
      setIsSaving(false);
      const msg = err?.response?.data?.message || 'Gagal menyimpan jurusan ke database.';
      showAlert('error', msg);
    }
  };

  const handleSimpanStrukturDasar = async () => {
    const namaJurusan = jurusanForm.nama.trim();
    const kodeJurusan = jurusanForm.kode.trim().toUpperCase();
    if (!namaJurusan) { showAlert('error', 'Kolom "Nama Jurusan Lengkap" belum diisi.'); return; }
    if (!kodeJurusan) { showAlert('error', 'Kolom "Kode Jurusan" belum diisi.'); return; }
    if (!String(kelasForm.tahunAjaran || '').trim()) { showAlert('error', 'Kolom "Tahun Ajaran" belum diisi.'); return; }
    if (!String(kelasForm.semester || '').trim()) { showAlert('error', 'Kolom "Semester" belum dipilih.'); return; }
    const allClassForms = [kelasForm, ...additionalClassForms];
    const noTingkat = allClassForms.findIndex(item => !item.tingkat);
    if (noTingkat !== -1) { showAlert('error', `Kelas ${noTingkat + 1}: kolom "Tingkat" belum dipilih.`); return; }
    const invalidNomor = allClassForms.findIndex(item => !/^[1-9]\d*$/.test(String(item.nomorKelas)));
    if (invalidNomor !== -1) { showAlert('error', `Kelas ${invalidNomor + 1}: kolom "Nomor Kelas" wajib diisi angka (minimal 1).`); return; }
    const noWali = allClassForms.findIndex(item => !item.waliKelas);
    if (noWali !== -1) { showAlert('error', `Kelas ${noWali + 1}: kolom "Wali Kelas" belum dipilih.`); return; }
    const selectedGrades = [...new Set(allClassForms.map(item => String(item.tingkat || '').toUpperCase()))];
    if (selectedGrades.length > 1) {
      showAlert('error', `Simpan hanya untuk satu tingkat. Ditemukan tingkat ${selectedGrades.join(' & ')} — simpan dulu, lalu buat tingkat lain lewat "Kelola" baru.`);
      return;
    }
    const missingStudentsIndex = allClassForms.findIndex(item => !(item.students || []).length);
    if (missingStudentsIndex !== -1) { showAlert('error', `Kelas ${missingStudentsIndex + 1}: minimal satu murid harus dipilih.`); return; }
    const classNames = allClassForms.map(item => `${item.tingkat} ${kodeJurusan} ${item.nomorKelas}`);
    if (new Set(classNames).size !== classNames.length) { showAlert('error', 'Ada "Nomor Kelas" yang sama dalam satu jurusan. Periksa kembali nomor kelasnya.'); return; }
    const editingExistingClass = Boolean(editingItem?.editingStructureClass && editingItem?.dbId);
    if (!editingExistingClass) {
      const existingCohort = (masterData.kelas || []).some(item => {
        const parts = String(item.nama || item.name || '').split(' ');
        const grade = String(item.tingkat || parts[0] || '').toUpperCase();
        const code = String(item.jurusan || parts[1] || '').toUpperCase();
        return grade === String(kelasForm.tingkat || '').toUpperCase() && code === kodeJurusan;
      });
      if (existingCohort) {
        showAlert('error', `Kategori ${kelasForm.tingkat} ${kodeJurusan} sudah tersedia. Buka detail dan edit kelompok tersebut untuk menambahkan kelas agar tetap dalam satu halaman.`);
        return;
      }
    }
    const hasExistingClassName = allClassForms.some((classForm, formIndex) => {
      const currentClassId = classForm.dbId || (formIndex === 0 ? (editingItem?.dbId || editingItem?.id) : null);
      return masterData.kelas.some(item =>
        (item.nama === classNames[formIndex] || item.name === classNames[formIndex])
        && String(item.dbId || item.id) !== String(currentClassId || '')
      );
    });
    if (hasExistingClassName) { showAlert('error', 'Kelas tersebut sudah tersimpan di database.'); return; }

    setIsSaving(true);
    setSavePhase('saving');
    try {
      if (editingItem?.editingStructureClass && editingItem?.dbId) {
        const jurusanId = selectedExistingJurusanId
          || existingJurusans.find(item => String(item.kode || '').toUpperCase() === kodeJurusan)?.dbId
          || masterData.jurusan.find(item => String(item.kode || '').toUpperCase() === kodeJurusan)?.dbId;
        let savedJurusan = null;
        if (jurusanId) {
          const jurusanResponse = await operatorAPI.updateJurusan(jurusanId, {
            name: namaJurusan,
            code: kodeJurusan,
            head_user_id: jurusanForm.ketuaId || null,
          });
          savedJurusan = jurusanResponse.data?.data || null;
        } else {
          throw new Error('Data jurusan yang akan diedit tidak ditemukan. Muat ulang halaman lalu coba kembali.');
        }

        const item = allClassForms[0];
        const updated = await operatorAPI.updateSchoolClass(editingItem.dbId, {
          name: classNames[0],
          grade_level: item.tingkat,
          department_code: kodeJurusan,
          department_name: namaJurusan,
          capacity: Number(item.kapasitas) || 36,
          academic_year: item.tahunAjaran || kelasForm.tahunAjaran || '',
          semester: item.semester || kelasForm.semester || 'Ganjil',
          homeroom_teacher_id: item.waliKelas || kelasForm.waliKelas || null,
          student_ids: [...new Set((item.students || []).map(Number))],
        });
        const saved = updated.data?.data;
        const updatedExistingClasses = [];
        const existingAdditionalForms = allClassForms.slice(1).filter(classForm => classForm.dbId);
        for (const classForm of existingAdditionalForms) {
          const formIndex = allClassForms.indexOf(classForm);
          const response = await operatorAPI.updateSchoolClass(classForm.dbId, {
            name: classNames[formIndex],
            grade_level: classForm.tingkat,
            department_code: kodeJurusan,
            department_name: namaJurusan,
            capacity: Number(classForm.kapasitas) || 36,
            academic_year: classForm.tahunAjaran || kelasForm.tahunAjaran || '',
            semester: classForm.semester || kelasForm.semester || 'Ganjil',
            homeroom_teacher_id: classForm.waliKelas || null,
            student_ids: [...new Set((classForm.students || []).map(Number))],
          });
          updatedExistingClasses.push(response.data?.data || { id: classForm.dbId, name: classNames[formIndex] });
        }
        let newlySavedClasses = [];
        const addedForms = allClassForms.slice(1).filter(classForm => !classForm.dbId);
        if (addedForms.length > 0) {
          const addedResponse = await operatorAPI.syncMasterClasses({
            classes: addedForms.map((classForm, addedIndex) => ({
              name: classNames[allClassForms.indexOf(classForm)],
              grade_level: classForm.tingkat,
              department_code: kodeJurusan,
              department_name: namaJurusan,
              capacity: Number(classForm.kapasitas) || 36,
              academic_year: classForm.tahunAjaran || kelasForm.tahunAjaran || '',
              semester: classForm.semester || kelasForm.semester || 'Ganjil',
              homeroom_teacher_id: classForm.waliKelas || null,
              student_ids: [...new Set((classForm.students || []).map(Number))],
            })),
          });
          newlySavedClasses = addedResponse.data?.data?.classes || [];
          const expectedAddedStudents = addedForms.reduce((total, classForm) => total + new Set((classForm.students || []).map(Number)).size, 0);
          const savedAddedStudents = Number(addedResponse.data?.data?.synced_student_count || 0);
          if (savedAddedStudents !== expectedAddedStudents) {
            throw new Error(`Roster murid kelas tambahan belum tersimpan lengkap (${savedAddedStudents}/${expectedAddedStudents}).`);
          }
        }
        const persistedExistingClasses = [saved, ...updatedExistingClasses].filter(Boolean);
        setMasterData(prev => ({
          ...prev,
          jurusan: prev.jurusan.map(row => String(row.dbId || row.id) === String(jurusanId)
            ? { ...row, id: savedJurusan?.id || jurusanId, dbId: savedJurusan?.id || jurusanId, nama: savedJurusan?.name || namaJurusan, kode: savedJurusan?.code || kodeJurusan, updated_at: savedJurusan?.updated_at || new Date().toISOString() }
            : row),
          kelas: [
            ...prev.kelas.map(row => {
              const rowId = String(row.dbId || row.id);
              const formIndex = allClassForms.findIndex((classForm, index) => String(classForm.dbId || (index === 0 ? editingItem.dbId : '')) === rowId);
              if (formIndex < 0) return row;
              const classForm = allClassForms[formIndex];
              const recordId = classForm.dbId || editingItem.dbId;
              const record = persistedExistingClasses.find(classRecord => String(classRecord.id) === String(recordId)) || saved;
              return { ...row, dbId: record?.id || recordId, id: record?.id || row.id, nama: record?.name || classNames[formIndex], name: record?.name || classNames[formIndex], tingkat: classForm.tingkat, jurusan: kodeJurusan, nomorKelas: classForm.nomorKelas, kapasitas: Number(classForm.kapasitas) || 36, waliId: classForm.waliKelas || null, homeroom_teacher_id: classForm.waliKelas || null, students: classForm.students || [], created_at: record?.created_at || row.created_at, updated_at: record?.updated_at || new Date().toISOString() };
            }),
            ...addedForms.map(classForm => {
              const formIndex = allClassForms.indexOf(classForm);
              const classRecord = newlySavedClasses.find(row => row.name === classNames[formIndex]);
              return { id: classRecord?.id || `kls-${Date.now() + formIndex}`, dbId: classRecord?.id, nama: classRecord?.name || classNames[formIndex], name: classRecord?.name || classNames[formIndex], tingkat: classForm.tingkat, jurusan: kodeJurusan, nomorKelas: classForm.nomorKelas, kapasitas: Number(classForm.kapasitas) || 36, waliId: classForm.waliKelas || null, homeroom_teacher_id: classForm.waliKelas || null, students: classForm.students || [], created_at: classRecord?.created_at || new Date().toISOString(), updated_at: classRecord?.updated_at || new Date().toISOString() };
            }),
          ],
        }));
        setClassRosterRefreshToken(value => value + 1);
        triggerSync();
        setSavePhase('done');
        setTimeout(() => {
          setIsSaving(false);
          setSavePhase('idle');
          closeModal();
        }, 650);
        return;
      }

      const existingJurusan = existingJurusans.find(item => String(item.dbId || item.id) === String(selectedExistingJurusanId))
        || existingJurusans.find(item => String(item.kode || '').toUpperCase() === kodeJurusan);
      const jurusanResponse = existingJurusan
        ? null
        : await operatorAPI.createJurusan({ name: namaJurusan, code: kodeJurusan });
      const jurusan = jurusanResponse?.data?.data || existingJurusan;
      const syncResponse = await operatorAPI.syncMasterClasses({
        classes: allClassForms.map((item, index) => ({
          name: classNames[index],
          grade_level: item.tingkat,
          department_code: kodeJurusan,
          department_name: namaJurusan,
          capacity: Number(item.kapasitas) || 36,
          academic_year: item.tahunAjaran || '',
          semester: item.semester || 'Ganjil',
          homeroom_teacher_id: item.waliKelas || null,
          student_ids: [...new Set((item.students || []).map(Number))],
        }))
      });
      const savedClasses = syncResponse.data?.data?.classes || [];
      const expectedStudentCount = allClassForms.reduce((total, item) => total + new Set((item.students || []).map(Number)).size, 0);
      const persistedStudentCount = Number(syncResponse.data?.data?.synced_student_count || 0);
      if (persistedStudentCount !== expectedStudentCount) {
        throw new Error(`Roster murid belum tersimpan lengkap (${persistedStudentCount}/${expectedStudentCount}). Silakan coba simpan kembali.`);
      }
      setMasterData(prev => ({
        ...prev,
        jurusan: existingJurusan ? prev.jurusan : [{ id: jurusan?.id, dbId: jurusan?.id, nama: jurusan?.name || namaJurusan, kode: jurusan?.code || kodeJurusan, ketuaId: '', head_name: '-', deskripsi: 'Program Keahlian Sekolah' }, ...prev.jurusan],
        kelas: [
          ...allClassForms.map((item, index) => {
            const saved = savedClasses.find(row => row.name === classNames[index]);
          return { id: saved?.id || `kls-${Date.now() + index}`, dbId: saved?.id, nama: saved?.name || classNames[index], tingkat: item.tingkat, jurusan: kodeJurusan, nomorKelas: item.nomorKelas, kapasitas: Number(item.kapasitas) || 36, waliId: item.waliKelas || null, homeroom_teacher_id: item.waliKelas || null, students: item.students || [], created_at: saved?.created_at || new Date().toISOString(), updated_at: saved?.updated_at || new Date().toISOString() };
          }),
          ...prev.kelas
        ],
      }));
      setClassRosterRefreshToken(value => value + 1);
      triggerSync();
      setSavePhase('done');
      setTimeout(() => {
        setIsSaving(false);
        setSavePhase('idle');
        closeModal();
      }, 650);
    } catch (error) {
      console.warn('Penyimpanan struktur akademik belum selesai.', error);
      setSavePhase('idle');
      showAlert('error', error?.response?.data?.message || 'Data belum tersimpan. Periksa kembali koneksi dan kelengkapan data.');
      setIsSaving(false);
    }
  };

  const addActivityStudent = (student) => {
    if (!student) return;
    const paymentRequired = ['magang', 'pertukaran_siswa'].includes(magangForm.tipeKegiatan);
    if (paymentRequired && !magangForm.statusPembayaranInput) {
      showAlert('error', 'Pilih status pembayaran sebelum menambahkan murid.');
      return;
    }
    if (magangForm.peserta.some(item => String(item.id) === String(student.id))) return;
    setMagangForm(form => ({
      ...form,
      muridInput: '',
      peserta: [...form.peserta, {
        id: student.id,
        name: student.name || student.full_name || 'Murid',
        nisn: studentNisn(student),
        statusPembayaran: form.statusPembayaranInput || '',
      }],
    }));
    setSearchStudentMagang('');
    setIsFormDirty(true);
  };

  const setActivityPaymentStatus = (statusPembayaranInput) => {
    setMagangForm(form => ({
      ...form,
      statusPembayaranInput,
      peserta: form.peserta.map(student => ({ ...student, statusPembayaran: statusPembayaranInput })),
    }));
    setIsFormDirty(true);
  };

  const removeActivityStudent = (studentId) => {
    setMagangForm(form => ({ ...form, peserta: form.peserta.filter(student => String(student.id) !== String(studentId)) }));
    setIsFormDirty(true);
  };


  const handleSimpanMagang = async () => {
    if (!magangForm.tipeKegiatan) { showAlert('error', 'Pilih Kegiatan terlebih dahulu.'); return; }
    // ... validation logic same as before ...
    if (magangForm.tipeKegiatan === 'ekstrakurikuler') {
      if (!magangForm.namaKegiatan) { showAlert('error', 'Isi Nama Ekstrakurikuler terlebih dahulu.'); return; }
      if (!magangForm.guruPembimbing) { showAlert('error', 'Pilih Pembina.'); return; }
      if (!magangForm.waktuDiadakan) { showAlert('error', 'Pilih Waktu Diadakan.'); return; }
      if (magangForm.peserta.length === 0) { showAlert('error', 'Pilih minimal satu murid untuk ekstrakurikuler.'); return; }
    } else if (magangForm.tipeKegiatan === 'study_tour') {
      if (magangForm.peserta.length === 0) { showAlert('error', 'Pilih minimal satu murid untuk Study Tour.'); return; }
      if (!magangForm.guruPenanggungJawab) { showAlert('error', 'Pilih Guru Penanggung Jawab.'); return; }
      if (!magangForm.statusPembayaranInput) { showAlert('error', 'Pilih Status Pembayaran.'); return; }
      if (!magangForm.statusAcc) { showAlert('error', 'Pilih Status ACC.'); return; }
      if (!magangForm.tujuanNegara) { showAlert('error', 'Pilih Tujuan Negara.'); return; }
      if (!magangForm.namaKota) { showAlert('error', 'Masukkan nama kota tujuan.'); return; }
      if (magangForm.tujuanNegara === 'Lainnya' && !/^[\p{L}\s]+$/u.test(magangForm.tujuanNegaraLainnya || '')) { showAlert('error', 'Masukkan nama negara menggunakan huruf saja.'); return; }
    } else if (magangForm.tipeKegiatan === 'perlombaan') {
      if (!magangForm.namaKegiatan || !magangForm.tempatPerlombaan) { showAlert('error', 'Lengkapi Nama dan Tempat Kegiatan.'); return; }
      if (magangForm.peserta.length === 0) { showAlert('error', 'Pilih minimal satu murid untuk perlombaan.'); return; }
      if (!magangForm.waktuDiadakan) { showAlert('error', 'Pilih Tanggal Pelaksanaan.'); return; }
    } else if (magangForm.tipeKegiatan === 'pertukaran_siswa') {
      if (!magangForm.namaSekolahTujuan) { showAlert('error', 'Masukkan nama sekolah tujuan.'); return; }
      if (magangForm.peserta.length === 0) { showAlert('error', 'Belum ada murid yang ditambahkan ke daftar pertukaran.'); return; }
      if (!magangForm.provinsi || !magangForm.kota) { showAlert('error', 'Pilih Provinsi dan Kota.'); return; }
      if (!magangForm.tanggalMulai || !magangForm.tanggalBerakhir) { showAlert('error', 'Tentukan tanggal mulai dan tanggal berakhir.'); return; }
    }

    const getActivityName = () => {
      switch (magangForm.tipeKegiatan) {
        case 'ekstrakurikuler': return 'EKSTRAKURIKULER';
        case 'study_tour': return 'STUDY TOUR';
        case 'perlombaan': return 'PERLOMBAAN';
        case 'pertukaran_siswa': return 'PERTUKARAN SISWA';
        default: return 'KEGIATAN SEKOLAH';
      }
    };

    const resolvedTeacher = allTeachers?.find(t => String(t.id) === String(magangForm.guruPenanggungJawab || magangForm.guruPembimbing));
    setIsSaving(true);
    setSavePhase('saving');
    try {
      const participants = magangForm.peserta.map(participant => {
        const student = studentsList?.find(item => String(item.id) === String(participant.id));
        return {
          id: Number(participant.id),
          name: student?.name || student?.full_name || participant.name || 'Murid',
          nisn: studentNisn(student || participant),
          statusPembayaran: participant.statusPembayaran || magangForm.statusPembayaranInput || '',
        };
      });
      const data = {
        ...magangForm,
        peserta: participants,
        muridInput: '',
        savedAt: new Date().toISOString(),
        name: getActivityName(),
        resolvedTeacherName: resolvedTeacher ? `${resolvedTeacher.name || resolvedTeacher.full_name} (${resolveNip(resolvedTeacher) || '-'})` : '',
        tujuanNegaraDisplay: magangForm.tujuanNegara === 'Lainnya' ? magangForm.tujuanNegaraLainnya : magangForm.tujuanNegara,
      };
      const response = editingItem?.dbId
        ? await operatorAPI.updateAcademicActivity(editingItem.dbId, { activity_type: magangForm.tipeKegiatan, data })
        : await operatorAPI.createAcademicActivity({ activity_type: magangForm.tipeKegiatan, data });
      const savedActivity = response.data?.data;
      setMasterData(prev => ({
        ...prev,
        magang: editingItem?.dbId
          ? prev.magang.map(item => String(item.dbId || item.id) === String(editingItem.dbId) ? savedActivity : item)
          : [savedActivity, ...prev.magang]
      }));
      setSavePhase('done');
      setIsFormDirty(false);
      setTimeout(() => {
        setIsSaving(false);
        setSavePhase('idle');
        closeModal();
      }, 700);
    } catch (error) {
      setIsSaving(false);
      setSavePhase('idle');
      showAlert('error', error?.response?.data?.message || 'Kegiatan gagal disimpan ke database.');
    }
  };

  const executeSimpan = () => {
    if (activeModal === 'kelas') handleSimpanKelas();
    else if (activeModal === 'mapel') handleSimpanMapel();
    else if (activeModal === 'guru') handleSimpanGuru();
    else if (activeModal === 'guru_jadwal') handleSimpanGuruJadwal();
    else if (activeModal === 'jurusan') handleSimpanJurusan();
    else if (activeModal === 'magang') handleSimpanMagang();
    else if (activeModal === 'kurikulum') handleSimpanKurikulum();
  };

  // â”€â”€ KURIKULUM HANDLERS â”€â”€
  const fetchDokumen = async () => {
    setIsDokumenLoading(true);
    try {
      const res = await adminAkademikAPI.getCurriculumDocuments();
      setDokumenList(res.data?.data || []);
    } catch (error) {
      // Jangan mengosongkan UI saat koneksi API sementara gagal. Data yang
      // sebelumnya sudah dimuat tetap lebih akurat daripada daftar kosong.
      console.warn('Dokumen kurikulum belum dapat dimuat.', error);
    } finally {
      setIsDokumenLoading(false);
    }
  };

  const handleSimpanKurikulum = async () => {
    if (!dokumenForm.judulDoc.trim()) { showAlert('error', 'Judul dokumen wajib diisi.'); return; }
    if (!dokumenForm.tipeDoc)         { showAlert('error', 'Pilih tipe dokumen.'); return; }
    if (!dokumenForm.file && !editingCurriculumDocument) { showAlert('error', 'Pilih file dokumen (.pdf/.docx/.doc).'); return; }
    const allowed = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (dokumenForm.file && !allowed.includes(dokumenForm.file.type)) { showAlert('error', 'Format file harus .pdf, .doc, atau .docx.'); return; }
    if (dokumenForm.file && dokumenForm.file.size > 10 * 1024 * 1024) { showAlert('error', 'Ukuran file maksimal 10 MB.'); return; }

    setKurikulumSaving(true);
    setIsSaving(true);
    setSavePhase('saving');
    try {
      const fd = new FormData();
      // Nilai lama "kurikulum" dinormalisasi ke enum backend "silabus".
      const documentType = dokumenForm.tipeDoc === 'kurikulum' ? 'silabus' : dokumenForm.tipeDoc;
      fd.append('title',         dokumenForm.judulDoc);
      fd.append('curriculum_name', kurikulumForm.namaKurikulum || '');
      fd.append('academic_year', kurikulumForm.tahunAjaran || '');
      fd.append('grade_level', kurikulumForm.tingkat || 'X');
      fd.append('is_active', kurikulumForm.statusAktif ? '1' : '0');
      fd.append('document_type', documentType);
      fd.append('notes',         dokumenForm.catatan || '');
      if (dokumenForm.file) fd.append('file', dokumenForm.file);
      if (dokumenForm.subjectId)  fd.append('subject_id',    dokumenForm.subjectId);
      if (dokumenForm.jurusanId)  fd.append('department_id', dokumenForm.jurusanId);

      if (editingCurriculumDocument) await adminAkademikAPI.updateCurriculumDocument(editingCurriculumDocument.id, fd);
      else await adminAkademikAPI.uploadCurriculumDocument(fd);
      setDokumenForm(INITIAL_DOKUMEN_FORM);
      if (dokumenInputRef.current) dokumenInputRef.current.value = '';
      setEditingCurriculumDocument(null);
      setExistingCurriculumFile(null);
      fetchDokumen();
      setIsFormDirty(false);
      setSavePhase('done');
      setTimeout(() => {
        setIsSaving(false);
        setSavePhase('idle');
        closeModal();
      }, 650);
    } catch (err) {
      setSavePhase('idle');
      setIsSaving(false);
      showAlert('error', err.response?.data?.message || 'Gagal mengunggah dokumen.');
    } finally {
      setKurikulumSaving(false);
    }
  };

  const handleHapusDokumen = async (id) => {
    try {
      await adminAkademikAPI.deleteCurriculumDocument(id);
      await fetchDokumen();
      return true;
    } catch (_) {
      toast.error('Gagal menghapus dokumen.');
      return false;
    }
  };


  // Ambil data Tahun Ajaran dari Master Data
  const academicYears = kbmPreview?.tahun_ajaran || [];

  // DYNAMIC COUNTS
  const totalKelas = masterData.kelas.length;
  const totalMapel = masterData.mapel.length;
  const totalTingkat = new Set(masterData.kelas.map(k => k.tingkat)).size;
  const totalTeachers = teachersList?.length || 34;

  // PALETTE WARNA
  const COLORS = {
    purpleLight: '#EEF2FF',
    purpleDark: '#4338CA',
    blueSky: '#E0F2FE',
    blueDark: '#0369A1',
    greenMint: '#ECFDF5',
    greenDark: '#065F46',
    orangePeach: '#FFF7ED',
    orangeDark: '#C2410C',
    pinkSalmon: '#FFF1F2',
    pinkMaroon: '#9F1239',
    cyanLight: '#ECFEFF',
    cyanDark: '#0891b2',
  };

  const serviceCards = [
    { id: 'struktur', detailTab: 'struktur', title: 'Kelola Jurusan & Kelas', Icon: GraduationCap, gradient: 'linear-gradient(135deg, #f5f3ff 0%, #c7d2fe 100%)', shadowGlow: '0 20px 40px -15px rgba(199, 210, 254, 0.6)', btnColor: COLORS.purpleDark, btnLabel: 'Kelola' },
    { id: 'guru_jadwal', detailTab: 'kbm', title: 'Kelola KBM Terpadu', Icon: Calendar, gradient: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)', shadowGlow: '0 20px 40px -15px rgba(254, 215, 170, 0.6)', btnColor: COLORS.orangeDark, btnLabel: 'Kelola'},
    { id: 'kurikulum', detailTab: 'kurikulum', title: 'Kurikulum', Icon: BookOpen, gradient: 'linear-gradient(135deg, #fdf4ff 0%, #e9d5ff 100%)', shadowGlow: '0 20px 40px -15px rgba(233, 213, 255, 0.6)', btnColor: '#7c3aed', btnLabel: 'Kelola' },
    { id: 'magang', detailTab: 'magang', title: 'Kegiatan Ekstra Sekolah', Icon: Briefcase, gradient: 'linear-gradient(135deg, #ecfeff 0%, #67e8f9 100%)', shadowGlow: '0 20px 40px -15px rgba(103, 232, 249, 0.6)', btnColor: COLORS.cyanDark, btnLabel: 'Kelola Kegiatan' },
    { id: 'fasilitas', detailTab: 'fasilitas', title: 'Fasilitas', Icon: Building2, gradient: 'linear-gradient(135deg, #f0fdf4 0%, #86efac 100%)', shadowGlow: '0 20px 40px -15px rgba(134, 239, 172, 0.6)', btnColor: '#15803d', btnLabel: 'Kelola Fasilitas' },
  ];

  const loadClassStudents = async (classId) => {
    if (!classId) { setClassStudents([]); return; }
    // Hilangkan pilihan kelas sebelumnya sebelum respons kelas baru tiba.
    setClassStudents([]);
    setClassStudentsLoading(true);
    try {
      const response = await adminAkademikAPI.getClassStudents(classId);
      setClassStudents(response.data?.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Daftar murid kelas gagal dimuat.');
    } finally { setClassStudentsLoading(false); }
  };

  const assignStudentToClass = async () => {
    if (!kbmClassId || !classStudentId) return;
    try {
      await adminAkademikAPI.assignClassStudent(kbmClassId, { student_id: classStudentId });
      setClassStudentId('');
      await loadClassStudents(kbmClassId);
      toast.success('Murid berhasil dimasukkan ke kelas.');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Murid gagal dimasukkan ke kelas.');
    }
  };

  const removeStudentFromClass = async (studentId) => {
    try {
      await adminAkademikAPI.removeClassStudent(kbmClassId, studentId);
      await loadClassStudents(kbmClassId);
      toast.success('Murid dikeluarkan dari kelas.');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Murid gagal dikeluarkan dari kelas.');
    }
  };

  const toggleKbmStudent = async (studentId) => {
    if (!kbmClassId) return;
    const enrolled = classStudents.some(item => String(item.id) === String(studentId));
    const previousStudents = classStudents;
    const pickedStudent = (studentsList || []).find(item => String(item.id) === String(studentId));
    // Respons visual langsung: pill menjadi biru dan fungsi sort pada UI
    // memindahkannya ke bagian atas tanpa menunggu request database selesai.
    setClassStudents(current => enrolled
      ? current.filter(item => String(item.id) !== String(studentId))
      : (pickedStudent ? [...current, pickedStudent] : current)
    );
    try {
      if (enrolled) await adminAkademikAPI.removeClassStudent(kbmClassId, studentId);
      else await adminAkademikAPI.assignClassStudent(kbmClassId, { student_id: studentId });
      await loadClassStudents(kbmClassId);
    } catch (error) {
      setClassStudents(previousStudents);
      // Pesan integrasi lama sengaja tidak dipakai pada workspace KBM baru.
      console.warn('Perubahan roster KBM belum tersimpan.', error);
    }
  };

  const saveHomeroomTeacher = async (teacherId) => {
    if (!kbmClassId) return;
    const currentClass = (masterData.kelas || []).find(item => String(item.dbId || item.id) === String(kbmClassId));
    const previousTeacherId = currentClass?.waliId || currentClass?.homeroom_teacher_id || '';
    setWaliKelasId(teacherId || '');
    try {
      const response = await operatorAPI.assignHomeroomTeacher(kbmClassId, { homeroom_teacher_id: teacherId || null });
      const saved = response.data?.data;
      setMasterData(prev => ({
        ...prev,
        kelas: prev.kelas.map(item => String(item.dbId || item.id) === String(kbmClassId)
          ? { ...item, waliId: teacherId, homeroom_teacher_id: teacherId, homeroom_teacher_name: saved?.homeroom_teacher?.name || saved?.homeroom_teacher_name || 'Belum ditentukan' }
          : item)
      }));
      if (activeModal !== 'kbm') toast.success('Wali kelas berhasil disimpan.');
    } catch (error) {
      setWaliKelasId(String(previousTeacherId));
      const message = error?.response?.data?.message || 'Wali kelas gagal disimpan.';
      if (activeModal !== 'kbm') toast.error(message);
      else showAlert('error', message);
    }
  };

  const subTabs = [
    { id: 'kurikulum',  label: 'Kurikulum'     },
    { id: 'magang',     label: 'Kegiatan Ekstra Sekolah' },
  ];
  const hasData = (masterData[activeDetailTab] || []).length > 0;

  const isAllDataFilled = masterData.jurusan.length > 0 &&
    masterData.kelas.length > 0 &&
    masterData.mapel.length > 0 &&
    masterData.guru.length > 0 &&
    masterData.jadwal.length > 0;

  // Header & footer modal seragam — abu muda netral sesuai screenshot
  const modalBg = (_modal) => '#F1F5F9';

  const modalBtn = (modal) => ({
    kelas: COLORS.blueDark, mapel: COLORS.greenDark,
    guru: COLORS.orangeDark, jadwal: COLORS.pinkMaroon,
    jurusan: COLORS.purpleDark, magang: COLORS.cyanDark,
  })[modal] || '#64748B';

  const isKbmEditScheduleChanged = Boolean(editingItem && kbmEditBaseline) &&
    kbmScheduleSignature(guruJadwalForm, {
      waliKelasId,
      tahunAjaran: kbmTerm.tahunAjaran,
      semester: kbmTerm.semester,
    }) !== kbmEditBaseline;

  return (
    <div className="space-y-10 animate-fadeIn">

      {/* â”€â”€ AREA 1: CARD LAYANAN â”€â”€ */}
      <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Manajemen Layanan Akademik</h2>
          <p className="text-sm font-bold text-slate-400">Pilih modul di bawah ini untuk mengelola master data sekolah</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {serviceCards.map((card, i) => {
            const CardIcon = card.Icon;
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -12, scale: 1.03, transition: { type: 'spring', stiffness: 300 } }}
                style={{ backgroundImage: card.gradient, boxShadow: card.shadowGlow }}
                className="p-8 rounded-[2rem] group overflow-hidden relative border border-white/60 cursor-pointer"
              >
                {/* Glossy Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className="w-14 h-14 bg-white/70 backdrop-blur-md border border-white/90 rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110">
                    <CardIcon className="w-7 h-7 stroke-[2.5]" style={{ color: card.btnColor }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 group-hover:text-slate-900 transition-colors drop-shadow-sm">{card.title}</h3>
                  </div>
                </div>

                <div className="relative z-10 flex gap-3">
                  <button
                    onClick={() => {
                      if (card.id === 'struktur') { handleOpenModal('struktur'); return; }
                      if (card.id === 'guru_jadwal') { handleOpenModal('kbm'); return; }
                      if (card.id === 'fasilitas') { setFasilitasModal('manage'); return; }
                      handleOpenModal(card.id);
                    }}
                    className="flex-1 py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg transition-transform hover:brightness-110 active:scale-95"
                    style={{ backgroundColor: card.btnColor }}
                  >
                    {card.btnLabel}
                  </button>
                  <button
                    onClick={() => {
                      setActiveDetailTab(card.detailTab);
                      setDetailPage(1);
                      setShowDetail(true);
                    }}
                    className="px-5 py-4 rounded-2xl border border-white/80 bg-white/70 text-slate-700 font-black uppercase tracking-widest text-[10px] shadow-sm transition-all hover:bg-white active:scale-95"
                  >
                    Detail
                  </button>
                </div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/30 rounded-full blur-3xl pointer-events-none transition-transform group-hover:scale-150 duration-700" />
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/40 rounded-full blur-3xl pointer-events-none transition-transform group-hover:scale-150 duration-700" />
              </motion.div>
            );
          })}
        </div>
      </div>

      {showKbmPanel && <div className="rounded-[2.5rem] border border-orange-100 bg-white p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-4"><div><h3 className="text-2xl font-black text-slate-800">KBM & Penjadwalan</h3><p className="text-sm font-bold text-slate-400">Pilih kelas untuk mengelola murid dan menyusun jadwal.</p></div><button onClick={() => setShowKbmPanel(false)} className="text-slate-400 hover:text-slate-700"><X size={22}/></button></div>
        <div className="grid gap-4 md:grid-cols-[1fr_auto]"><select value={kbmClassId} onChange={e => { setKbmClassId(e.target.value); loadClassStudents(e.target.value); }} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700"><option value="">Pilih kelas</option>{sortSchoolClasses(masterData.kelas || []).map(item => <option key={item.dbId || item.id} value={item.dbId || item.id}>{item.nama || item.name}</option>)}</select><button onClick={() => { handleOpenModal('guru_jadwal'); setGuruJadwalForm(prev => ({ ...prev, kelasId: String(kbmClassId) })); }} disabled={!kbmClassId} className="rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black text-white disabled:opacity-40">+ Susun Jadwal</button></div>
        {kbmClassId && <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row"><select value={classStudentId} onChange={e => setClassStudentId(e.target.value)} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold"><option value="">Pilih murid untuk dimasukkan</option>{(studentsList || []).filter(s => !classStudents.some(item => String(item.id) === String(s.id))).map(s => <option key={s.id} value={s.id}>{s.name || s.full_name}</option>)}</select><button onClick={assignStudentToClass} disabled={!classStudentId} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:opacity-40">+ Tambah Murid</button></div><div className="overflow-x-auto rounded-2xl bg-white"><table className="w-full text-left"><thead className="border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-400"><tr><th className="p-4">Nama Murid</th><th className="p-4">NISN</th><th className="p-4 text-right">Aksi</th></tr></thead><tbody>{classStudentsLoading ? <tr><td colSpan="3" className="p-6 text-center text-sm text-slate-400">Memuat murid...</td></tr> : classStudents.length === 0 ? <tr><td colSpan="3" className="p-6 text-center text-sm text-slate-400">Belum ada murid di kelas ini.</td></tr> : classStudents.map(student => <tr key={student.id} className="border-b border-slate-50"><td className="p-4 font-bold text-slate-700">{student.name}</td><td className="p-4 text-sm text-slate-500">{student.nisn || '-'}</td><td className="p-4 text-right"><button onClick={() => removeStudentFromClass(student.id)} className="text-xs font-black text-rose-500 hover:text-rose-700">Keluarkan</button></td></tr>)}</tbody></table></div></div>}
      </div>}

      {/* Anchor stabil utk scroll antar-panel (ref tidak ikut unmount saat pindah card). */}
      <div ref={detailPanelRef} aria-hidden className="h-0 scroll-mt-6" />
      {showDetail && activeDetailTab === 'fasilitas' && (
        <div className="space-y-6 rounded-[2.5rem] border border-emerald-100 bg-white p-8 shadow-sm md:p-10">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-6">
            <button type="button" onClick={() => setShowDetail(false)} aria-label="Kembali ke kartu akademik" className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>
            <div><h3 className="text-2xl font-black tracking-tight text-slate-800">Fasilitas</h3></div>
          </div>
          <div className="space-y-4">
            <FasilitasKelola api={operatorAPI} mode="detail" onSync={onSync} />
          </div>
        </div>
      )}

      {showDetail && activeDetailTab === 'struktur' && (
        <div className="space-y-6 rounded-[2.5rem] border border-indigo-100 bg-white p-8 shadow-sm md:p-10">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-6">
            <button type="button" onClick={() => setShowDetail(false)} aria-label="Kembali ke kartu akademik" className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>
            <div><h3 className="text-2xl font-black tracking-tight text-slate-800">Kelola Jurusan & Kelas</h3></div>
          </div>
          <div className="space-y-4">
            {(() => {
              const cohorts = Object.values((masterData.kelas || []).reduce((result, item) => {
                const parts = String(item.nama || item.name || '').split(' ');
                const grade = item.tingkat || parts[0] || 'X';
                // Normalisasi jurusan -> KODE yang stabil: item.jurusan bisa berupa kode ("TKJ")
                // dari API atau nama lengkap dari state awal localStorage. Keduanya dipetakan ke
                // kode yang sama lewat masterData.jurusan, jadi label tidak berubah di tengah render.
                const rawJurusan = String(item.jurusan || parts[1] || '').trim();
                const rawUpper = rawJurusan.toUpperCase();
                const jurMatch = (masterData.jurusan || []).find(j => String(j.kode || '').toUpperCase() === rawUpper || String(j.nama || '').toLowerCase() === rawJurusan.toLowerCase());
                const code = String(jurMatch?.kode || rawUpper || 'UMUM').toUpperCase();
                const key = `${code}|${grade}`;
                if (!result[key]) result[key] = { key, grade, code, classes: [] };
                result[key].classes.push(item);
                return result;
              }, {})).map(cohort => ({
                ...cohort,
                latestTimestamp: Math.max(0, ...cohort.classes.map(getDetailTimestamp)),
              })).sort((left, right) => right.latestTimestamp - left.latestTimestamp);
              if (!cohorts.length) return <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-400">Belum ada kelas yang tersimpan.</div>;
              return cohorts.map(cohort => {
                const jurusan = (masterData.jurusan || []).find(item => String(item.kode || '').toUpperCase() === cohort.code);
                const jurusanNama = jurusan?.nama || cohort.code || 'Jurusan';
                const jurusanKode = jurusan?.kode || cohort.code || '-';
                const orderedClasses = sortDetailsNewestFirst(cohort.classes);
                const classNames = orderedClasses.map(item => item.nama || item.name || 'Kelas');
                const latest = orderedClasses.reduce((current, item) => {
                  const value = item.updated_at || item.created_at || item.savedAt;
                  return !current || getDetailTimestamp(item) > getDetailTimestamp({ created_at: current }) ? value : current;
                }, null);
                const startEditClass = async (item) => {
                  const parts = String(item.nama || item.name || '').split(' ');
                  setEditingItem({ ...item, editingStructureClass: true });
                  setJurusanForm({ nama: jurusan?.nama || jurusanNama, kode: jurusan?.kode || jurusanKode, ketuaId: '' });
                  setSelectedExistingJurusanId(jurusan?.dbId || jurusan?.id || null);
                  const initialStudentIds = Array.isArray(item.students) ? item.students.map(student => Number(student && typeof student === 'object' ? (student.id ?? student.student_id) : student)).filter(id => Number.isInteger(id) && id > 0) : [];
                  setKelasForm({ tingkat: item.tingkat || parts[0] || 'X', jurusan: item.jurusan || jurusanKode, nomorKelas: item.nomorKelas || parts[parts.length - 1] || '', kapasitas: String(item.kapasitas || item.capacity || 36), tahunAjaran: item.tahun_ajaran || item.academic_year || item.tahunAjaran || '', semester: item.semester || 'Ganjil', waliKelas: String(item.homeroom_teacher_id || item.waliId || item.waliKelas || ''), students: initialStudentIds });
                  setAdditionalClassForms([]);
                  setAddAnotherClass(false);
                  setSearchStudentKelas('');
                  setIsFormDirty(false);
                  setActiveModal('struktur');
                  try {
                    const response = await adminAkademikAPI.getClassStudents(item.dbId || item.id);
                    const enrolled = response.data?.data || [];
                    setKelasForm(form => ({ ...form, students: enrolled.map(student => Number(student.id)).filter(id => Number.isInteger(id) && id > 0) }));
                  } catch (error) {
                    console.warn('Daftar murid kelas tidak dapat dimuat saat edit.', error);
                  }
                };
                const startEditCohort = async () => {
                  const records = [];
                  for (const item of orderedClasses) {
                    const classId = item.dbId || item.id;
                    let students = Array.isArray(item.students) ? item.students : [];
                    try {
                      const response = await adminAkademikAPI.getClassStudents(classId);
                      students = (response.data?.data || []).map(student => Number(student.id ?? student.student_id)).filter(Number.isInteger);
                    } catch (error) {
                      console.warn(`Roster ${item.nama || item.name} tidak dapat dimuat.`, error);
                    }
                    const parts = String(item.nama || item.name || '').split(' ');
                    records.push({
                      dbId: item.dbId || item.id,
                      id: item.id,
                      tingkat: item.tingkat || parts[0] || cohort.grade,
                      jurusan: item.jurusan || cohort.code,
                      nomorKelas: item.nomorKelas || parts[parts.length - 1] || '',
                      kapasitas: String(item.kapasitas || item.capacity || 36),
                      tahunAjaran: item.tahun_ajaran || item.academic_year || item.tahunAjaran || '',
                      semester: item.semester || 'Ganjil',
                      waliKelas: String(item.homeroom_teacher_id || item.waliId || item.waliKelas || ''),
                      students,
                      studentSearch: '',
                      addNext: false,
                    });
                  }
                  if (!records.length) return;
                  const [first, ...rest] = records;
                  setEditingItem({ ...orderedClasses[0], editingStructureClass: true, editingStructureGroup: true, editingStructureClassIds: records.map(item => item.dbId) });
                  setJurusanForm({ nama: jurusan?.nama || jurusanNama, kode: jurusan?.kode || jurusanKode, ketuaId: '' });
                  setSelectedExistingJurusanId(jurusan?.dbId || jurusan?.id || null);
                  setKelasForm(first);
                  setAdditionalClassForms(rest);
                  setAddAnotherClass(false);
                  setSearchStudentKelas('');
                  setIsFormDirty(false);
                  setActiveModal('struktur');
                };
                return <article key={cohort.key} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p style={{ color: COLORS.purpleDark }} className="text-sm font-black">{jurusanNama} <span className="text-slate-400">({jurusanKode})</span></p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-1 text-base font-black text-slate-800">{orderedClasses.slice(0, 3).map((item, index) => <React.Fragment key={item.dbId || item.id}>{index > 0 && <span> ; </span>}<button type="button" onClick={() => startEditClass(item)} className="rounded px-0.5 text-left hover:text-indigo-700 hover:underline">{item.nama || item.name}</button></React.Fragment>)}{orderedClasses.length > 3 && <details className="relative inline-block text-sm font-black text-indigo-700"><summary className="cursor-pointer list-none">+lainnya</summary><div className="absolute left-0 top-full z-20 mt-2 min-w-48 space-y-1 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">{orderedClasses.slice(3).map(item => <button type="button" key={item.dbId || item.id} onClick={() => startEditClass(item)} className="block w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-xs font-black text-slate-700 hover:bg-indigo-50">{item.nama || item.name}</button>)}</div></details>}</p>
                    <p className="mt-2 text-[10px] font-bold tracking-wide text-slate-400">{formatDetailTimestamp({ created_at: latest })}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={startEditCohort} aria-label={`Edit kelompok ${jurusanNama} tingkat ${cohort.grade}`} className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-amber-600 transition hover:bg-amber-500 hover:text-white">Edit</button><button type="button" onClick={() => setDeleteConfirm({ id: orderedClasses[0].dbId || orderedClasses[0].id, ids: orderedClasses.map(item => item.dbId || item.id), tab: 'kelas', groupLabel: `${jurusanNama} (${jurusanKode}) · ${cohort.grade}` })} aria-label={`Hapus kelompok ${jurusanNama} tingkat ${cohort.grade}`} className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-rose-600 transition hover:bg-rose-500 hover:text-white">Hapus</button></div>
                </article>;
              });
            })()}
          </div>
        </div>
      )}

      {showDetail && activeDetailTab === 'kbm' && (
        <div className="space-y-6 rounded-[2.5rem] border border-orange-100 bg-white p-8 shadow-sm md:p-10">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-6"><button type="button" onClick={() => setShowDetail(false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button><h3 className="text-2xl font-black tracking-tight text-slate-800">Kelola KBM Terpadu</h3></div>
          <div className="space-y-3">
            {(() => {
              const groups = Object.values((masterData.jadwal || []).reduce((result, schedule) => {
                const classId = schedule.kelasId || schedule.kelas_id || schedule.kelas || schedule.kelas_nama || 'kelas';
                const key = String(classId);
                if (!result[key]) result[key] = { key, classId, schedules: [] };
                result[key].schedules.push(schedule);
                return result;
              }, {})).map(group => ({
                ...group,
                schedules: sortDetailsNewestFirst(group.schedules),
                latestTimestamp: Math.max(0, ...group.schedules.map(getDetailTimestamp)),
              })).sort((left, right) => right.latestTimestamp - left.latestTimestamp);
              if (!groups.length) return <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-400">Belum ada jadwal KBM tersimpan.</div>;
              return groups.map(group => {
                const schedules = group.schedules;
                const first = schedules[0];
                const classId = first.kelasId || first.kelas_id;
                const classRecord = (masterData.kelas || []).find(row => String(row.dbId || row.id) === String(classId));
                const className = classRecord?.nama || classRecord?.name || first.kelas || first.kelas_nama || 'Kelas';
                const homeroomId = classRecord?.homeroom_teacher_id || classRecord?.waliId;
                const homeroom = (classRecord?.homeroom_teacher_name && classRecord.homeroom_teacher_name !== '-')
                  ? classRecord.homeroom_teacher_name
                  : allTeachers.find(teacher => String(teacher.id) === String(homeroomId))?.name
                  || allTeachers.find(teacher => String(teacher.id) === String(homeroomId))?.full_name
                  || 'Wali kelas belum ditentukan';
                const subjects = [...new Set(schedules.map(schedule => schedule.mapel || schedule.mapel_nama).filter(Boolean))];
                const subjectSummary = subjects.length
                  ? `${subjects.slice(0, 2).join(', ')}${subjects.length > 2 ? ' +lainnya' : ''}`
                  : 'Belum ada mata pelajaran';
                const latest = schedules.reduce((current, schedule) => {
                  const value = schedule.updated_at || schedule.created_at || schedule.savedAt;
                  return !current || getDetailTimestamp(schedule) > getDetailTimestamp({ created_at: current }) ? value : current;
                }, null);
                return <article key={group.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-base font-black text-slate-800">{className}</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{homeroom} (wali kelas) · {subjectSummary}</p>
                  <p className="mt-2 text-[10px] font-bold tracking-wide text-slate-400">{formatDetailTimestamp({ created_at: latest })}</p>
                  <details className="mt-4 border-t border-slate-100 pt-3">
                    <summary className="cursor-pointer text-xs font-black text-orange-700">Rincian guru & jadwal ({schedules.length})</summary>
                    <div className="mt-3 space-y-2">{schedules.map(schedule => <div key={schedule.dbId || schedule.id} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0"><p className="text-sm font-black text-slate-700">{schedule.teacher_name || schedule.guru_nama || 'Guru'} · {schedule.mapel || schedule.mapel_nama || 'Mapel'}</p><p className="mt-1 text-xs font-semibold text-slate-500">{schedule.jam || '-'} · {schedule.hari || '-'} · {className}</p><p className="mt-1 text-[10px] font-black tracking-wider text-orange-700">Kode belajar: {schedule.kode_belajar || '-'}</p></div>
                      <div className="flex shrink-0 gap-2">{(() => { const isC = String(schedule.kategoriJadwal || schedule.kategori_jadwal || '').toLowerCase() === 'c' || String(schedule.kelompok || '').toUpperCase() === 'C'; return isC ? (<span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500"><Lock className="h-3 w-3" /> Terkunci · Pusjur</span>) : (<><button type="button" onClick={() => openKbmScheduleEditor(schedule)} className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-amber-600 transition hover:bg-amber-500 hover:text-white">Edit</button><button type="button" onClick={() => setDeleteConfirm({ id: schedule.dbId || schedule.id, tab: 'jadwal' })} className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-rose-600 transition hover:bg-rose-500 hover:text-white">Hapus</button></>); })()}</div>
                    </div>)}</div>
                  </details>
                </article>;
              });
            })()}
          </div>
        </div>
      )}

      {showDetail && activeDetailTab !== 'struktur' && activeDetailTab !== 'kbm' && activeDetailTab !== 'fasilitas' && (
      <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm space-y-8">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                aria-label="Kembali ke kartu akademik"
                className="p-2 hover:bg-slate-100 text-slate-400 rounded-xl transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">{activeDetailTab === 'kurikulum' ? 'Kurikulum' : activeDetailTab === 'magang' ? 'Kegiatan Ekstra Sekolah' : `Detail ${subTabs.find(tab => tab.id === activeDetailTab)?.label || 'Data Akademik'}`}</h3>
            </div>
            {!['magang', 'kurikulum'].includes(activeDetailTab) && <div className="flex gap-3">
              <button
                disabled={!hasData}
                onClick={() => {
                  const data = activeDetailTab === 'guru_jadwal' ? (masterData.jadwal || []) : (masterData[activeDetailTab] || []);

                  // Format data agar terbaca rapi di Excel
                  const excelData = data.map((item, idx) => {
                    const base = { 'No': idx + 1 };

                    if (activeDetailTab === 'kelas') {
                      return { ...base, 'Tingkat': item.nama.split(' ')[0], 'Jurusan': item.jurusan, 'Nama Kelas': item.nama, 'Wali Kelas': item.homeroom_teacher_name, 'Kapasitas': item.kapasitas };
                    }
                    if (activeDetailTab === 'mapel') {
                      return { ...base, 'Mata Pelajaran': item.nama, 'Kode': item.kode || item.id, 'KKM': item.KKM, 'Durasi (Jam)': item.jam };
                    }
                    if (activeDetailTab === 'guru_jadwal') {
                      return { ...base, 'Hari': item.hari || '-', 'Mata Pelajaran': item.mapel || item.mata_pelajaran || '-', 'Waktu': item.jam || item.hari_waktu || '-', 'Kelas': item.kelas || item.kelas_nama || '-', 'Guru': item.teacher_name || item.guru_nama || '-' };
                    }
                    if (activeDetailTab === 'jurusan') {
                      return { ...base, 'Nama Jurusan': item.nama, 'Kode': item.kode, 'Ketua Jurusan': item.head_name || '-' };
                    }
                    if (activeDetailTab === 'magang') {
                      return { ...base, 'Tipe Kegiatan': item.tipeKegiatan, 'Nama/Tempat': item.namaKegiatan || item.tempatMagang || item.namaKota, 'Guru Pembimbing': item.guruPembimbing || item.guruPenanggungJawab || '-', 'Jumlah Peserta': item.peserta ? item.peserta.length : 0 };
                    }
                    return { ...base, ...item };
                  });

                  // Generate Excel Workbook
                  const worksheet = XLSX.utils.json_to_sheet(excelData);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Akademik");

                  // Download File
                  XLSX.writeFile(workbook, `Laporan_${activeDetailTab}_${new Date().toLocaleDateString('id-ID')}.xlsx`);
                  showAlert('success', 'data berhasil di unduh, silahkan buka folder download');
                }}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${hasData
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                  }`}
              >
                <FileSpreadsheet size={16} /> Ekspor Excel
              </button>
              <button
                disabled={!hasData}
                onClick={() => {
                  const pool = activeDetailTab === 'guru_jadwal' ? (masterData.jadwal || []) : (masterData[activeDetailTab] || []);

                  const printWin = window.open('', '_blank');
                  const html = `
                    <html>
                      <head>
                        <title>Laporan ${activeDetailTab}</title>
                        <style>
                          body { font-family: 'Inter', sans-serif; padding: 50px; color: #334155; line-height: 1.6; background-color: #f8fafc; }
                          .container { background-color: white; padding: 50px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 1000px; margin: 0 auto; }
                          h1 { text-align: center; text-transform: uppercase; letter-spacing: 2px; border-bottom: 3px solid #334155; padding-bottom: 15px; margin-bottom: 30px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { border: 1px solid #e2e8f0; padding: 15px; font-size: 13px; text-align: left; }
                          th { background-color: #f1f5f9; font-weight: 800; color: #475569; text-transform: uppercase; }
                          .footer-sign { margin-top: 40px; text-align: right; }
                          .sign-box { display: inline-block; text-align: left; min-width: 200px; }
                          .note { margin-top: 60px; font-style: italic; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 15px; }
                          .btn-container { position: fixed; bottom: 40px; right: 40px; z-index: 9999; }
                          .download-btn { background-color: #2563eb; color: white; padding: 16px 32px; border-radius: 50px; font-weight: 800; border: none; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; font-size: 13px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5); transition: all 0.3s; }
                          .download-btn:hover { background-color: #1d4ed8; transform: translateY(-3px); box-shadow: 0 15px 30px -5px rgba(37, 99, 235, 0.6); }
                          .download-btn:active { transform: translateY(0); }
                          @media print { 
                            @page { margin: 0; }
                            .btn-container { display: none !important; } 
                            body { background-color: white; padding: 0; margin: 0; }
                            .container { box-shadow: none; max-width: 100%; padding: 2cm; margin: 0; }
                          }
                        </style>
                      </head>
                      <body>
                        <div class="container">
                          <h1>LAPORAN DATA ${activeDetailTab === 'magang' ? 'KEGIATAN EKSTRA SEKOLAH' : activeDetailTab.toUpperCase()}</h1>
                          <table style="table-layout: fixed; word-wrap: break-word;">
                            <thead>
                              <tr>
                                <th style="width: 40px; padding: 12px; font-size: 11px;">No</th>
                                ${
                                  activeDetailTab === 'magang' 
                                  ? `
                                    <th style="padding: 12px; font-size: 11px; width: 140px;">Tipe Kegiatan</th>
                                    <th style="padding: 12px; font-size: 11px;">Rincian Kegiatan</th>
                                  `
                                  : activeDetailTab === 'guru_jadwal'
                                  ? `
                                    <th style="padding: 12px; font-size: 11px; width: 80px;">Tipe</th>
                                    <th style="padding: 12px; font-size: 11px;">Informasi Utama</th>
                                    <th style="padding: 12px; font-size: 11px;">Detail Tambahan</th>
                                  `
                                  : Object.keys(pool[0])
                                    .filter(k => !['id', 'isActive'].includes(k) && pool.some(row => row[k] !== '' && row[k] !== null && row[k] !== undefined))
                                    .map(k => `<th style="padding: 12px; font-size: 11px;">${k.replace(/_/g, ' ')}</th>`).join('')
                                }
                              </tr>
                            </thead>
                            <tbody>
                              ${pool.map((row, i) => `
                                <tr>
                                  <td style="padding: 12px; font-size: 11px; text-align: center;">${i + 1}</td>
                                  ${
                                    activeDetailTab === 'magang'
                                    ? `
                                      <td style="padding: 12px; font-size: 11px; font-weight: 800; color: #1e293b; vertical-align: top;">${row.tipeKegiatan?.toUpperCase().replace('_', ' ')}</td>
                                      <td style="padding: 12px; font-size: 10px; line-height: 1.6;">
                                        ${row.tipeKegiatan === 'ekstrakurikuler' ? `
                                          <b>Nama Ekstrakurikuler:</b> ${row.namaKegiatan || '-'}<br/>
                                          <b>Pembina:</b> ${row.guruPembimbing || '-'}<br/>
                                          <b>Waktu Diadakan:</b> ${row.waktuDiadakan || '-'}<br/>
                                          <div style="margin-top: 5px;"><b>Daftar Peserta:</b><br/> ${row.peserta?.length > 0 ? row.peserta.map(p => p.name).join(', ') : (row.muridInput || '-')}</div>
                                        ` : row.tipeKegiatan === 'perlombaan' ? `
                                          <b>Nama Lomba:</b> ${row.namaKegiatan || '-'}<br/>
                                          <b>Tempat Lomba:</b> ${row.tempatPerlombaan || '-'}<br/>
                                          <b>Waktu Diadakan:</b> ${row.waktuDiadakan || '-'} ${row.jamMulai ? `(${row.jamMulai} - ${row.jamSelesai || ''})` : ''}<br/>
                                          <b>Guru Penjab:</b> ${row.guruPenanggungJawab || row.guruPembimbing || '-'}<br/>
                                          <div style="margin-top: 5px;"><b>Daftar Peserta:</b><br/> ${row.peserta?.length > 0 ? row.peserta.map(p => p.name).join(', ') : (row.muridInput || '-')}</div>
                                        ` : row.tipeKegiatan === 'study_tour' ? `
                                          <b>Tujuan:</b> ${row.tujuan || '-'} (${row.namaKota || ''}, ${row.tujuanNegara || ''})<br/>
                                          <b>Guru Penanggung Jawab:</b> ${row.guruPenanggungJawab || '-'}<br/>
                                          <b>Status:</b> ${row.statusAcc || row.statusPembayaranInput || '-'}<br/>
                                          <div style="margin-top: 5px;"><b>Daftar Peserta:</b><br/> ${row.peserta?.length > 0 ? row.peserta.map(p => p.name).join(', ') : (row.muridInput || '-')}</div>
                                        ` : `
                                          <b>Lokasi:</b> ${row.kota || '-'}, ${row.provinsi || '-'}<br/>
                                          <b>Periode:</b> ${row.tanggalMulai || '-'} s/d ${row.tanggalBerakhir || '-'}<br/>
                                          <div style="margin-top: 5px;"><b>Daftar Peserta:</b><br/> ${row.peserta?.length > 0 ? row.peserta.map(p => p.name).join(', ') : (row.muridInput || '-')}</div>
                                        `}
                                      </td>
                                    `
                                    : activeDetailTab === 'guru_jadwal'
                                    ? `
                                      <td style="padding: 12px; font-size: 11px; font-weight: 800; color: #1e293b;">${row.nip ? 'GURU' : 'JADWAL'}</td>
                                      <td style="padding: 12px; font-size: 11px;">${row.nip ? (row.name || 'Guru') : (row.mapel || 'Jadwal')}</td>
                                      <td style="padding: 12px; font-size: 11px;">${row.nip ? `NIP: ${row.nip}<br/>Mapel: ${Array.isArray(row.mapel) ? row.mapel.join(', ') : '-'}` : `Hari: ${row.hari} | Waktu: ${row.jam}<br/>Kelas: ${row.kelas} | Guru: ${row.teacher_name || '-'}`}</td>
                                    `
                                    : Object.keys(row)
                                      .filter(k => !['id', 'isActive'].includes(k) && pool.some(r => r[k] !== '' && r[k] !== null && r[k] !== undefined))
                                      .map(k => `<td style="padding: 12px; font-size: 11px;">${typeof row[k] === 'object' ? 'Detail List' : row[k]}</td>`).join('')
                                  }
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                          <div class="footer-sign">
                            <div class="sign-box">
                              <p>Tertanda ;</p>
                              <br/><br/><br/>
                              <p><b>Admin Akademik</b></p>
                            </div>
                          </div>
                          <div class="note">
                            Catatan : Data di atas di input dengan kesadaran penuh dan sesuai data yang sebenarnya tanpa rekayasa. Namun, data di atas dapat diubah sewaktu - waktu oleh <b>Admin Akademik</b> tanpa pemberitahuan terlebih dahulu.
                          </div>
                        </div>
                        <div class="btn-container">
                          <button class="download-btn" onclick="window.print()">Download / Cetak PDF</button>
                        </div>
                      </body>
                    </html>
                  `;
                  printWin.document.write(html);
                  printWin.document.close();
                }}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${hasData
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                  }`}
              >
                <FileSpreadsheet size={16} /> Preview PDF
              </button>
              <button
                disabled={(() => {
                  const drafts = JSON.parse(localStorage.getItem('school_academic_archives_v2') || '[]');
                  const currentTabLabel = subTabs.find(t => t.id === activeDetailTab)?.label || activeDetailTab;
                  return !drafts.some(d => d.category === currentTabLabel);
                })()}
                onClick={() => {
                  const currentTabLabel = subTabs.find(t => t.id === activeDetailTab)?.label || activeDetailTab;
                  setArchiveForm({ tahunAjaran: '', semester: 'Ganjil' });
                  setViewArchiveCategory(currentTabLabel);
                  setArchiveModalOpen(true);
                }}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                  (() => {
                    const drafts = JSON.parse(localStorage.getItem('school_academic_archives_v2') || '[]');
                    const currentTabLabel = subTabs.find(t => t.id === activeDetailTab)?.label || activeDetailTab;
                    return drafts.some(d => d.category === currentTabLabel);
                  })()
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 hover:bg-black active:scale-95'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <FileSpreadsheet size={16} /> Arsip
              </button>
            </div>}
          </div>

        </div>

        <div className="flex flex-col min-h-[400px] w-full border-2 border-dashed border-slate-100 rounded-[2rem] p-8 bg-slate-50/30">
          <div className="flex-1 space-y-3">
            {/* Logic to show data based on tab */}
            {(() => {
              const effectiveGuruList = (masterData.guru && masterData.guru.length > 0)
                ? masterData.guru
                : (allTeachers || []).map(t => ({
                    id: t.id,
                    name: t.name || t.full_name,
                    school_id: t.school_id || t.employment_code,
                    nip: resolveNip(t) || t.school_id || '-',
                    jurusan: t.jurusan || 'Umum',
                    mapel: [],
                  }));

              const sourceList = activeDetailTab === 'guru_jadwal' ? (masterData.jadwal || []) : (masterData[activeDetailTab] || []);
              const list = activeDetailTab === 'magang'
                ? [...sourceList].sort((left, right) => {
                    const leftCreated = new Date(left?.created_at || left?.createdAt || left?.savedAt || 0).getTime() || 0;
                    const rightCreated = new Date(right?.created_at || right?.createdAt || right?.savedAt || 0).getTime() || 0;
                    return rightCreated - leftCreated || Number(right?.dbId || right?.id || 0) - Number(left?.dbId || left?.id || 0);
                  })
                : sortDetailsNewestFirst(sourceList);

              // Tab kurikulum: tampilkan dokumen dari dokumenList (bukan masterData)
              if (activeDetailTab === 'kurikulum') {
                if (dokumenList.length === 0) return (
                  <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] gap-4">
                    <p className="text-slate-400 font-bold tracking-wider text-[11px] text-center">Belum ada dokumen kurikulum. Klik Kelola Kurikulum untuk mengunggah.</p>
                  </div>
                );
                return (
                  <div className="grid gap-4">
                    {sortDetailsNewestFirst(dokumenList).map((doc, idx) => (
                      <div key={doc.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between group hover:border-violet-200 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center font-black text-violet-400 text-xs">{idx + 1}</div>
                          <div>
                            <p className="font-black text-slate-800 text-sm">{doc.title}</p>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">
                              <span className="uppercase bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full text-[9px] mr-2">{doc.document_type}</span>
                              {doc.subject?.name || '—'} | {doc.department?.name || 'Semua Jurusan'}
                              {doc.notes ? ` | ${doc.notes}` : ''}
                            </p>
                            <p className="mt-2 text-[10px] font-bold tracking-wide text-slate-400">{formatDetailTimestamp(doc)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={`${BASE_URL}/storage/${doc.file_path}`} target="_blank" rel="noreferrer"
                            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase hover:bg-blue-100 transition-colors">
                            Download
                          </a>
                          <button type="button" onClick={() => {
                            setEditingCurriculumDocument(doc);
                            setKurikulumForm({
                              namaKurikulum: doc.curriculum_name || doc.title || '',
                              tahunAjaran: doc.academic_year || getCurriculumYearFallback(doc),
                              tingkat: doc.grade_level || 'X',
                              statusAktif: doc.is_active ?? true,
                            });
                            setExistingCurriculumFile({ name: doc.file_path?.split('/').pop() || 'Dokumen tersimpan', size: doc.file_size || 0 });
                            setDokumenForm({
                              subjectId: doc.subject_id ? String(doc.subject_id) : '',
                              jurusanId: doc.department_id ? String(doc.department_id) : '',
                              tipeDoc: doc.document_type || 'silabus',
                              judulDoc: doc.title || '',
                              catatan: doc.notes || '',
                              file: null,
                            });
                            setIsFormDirty(false);
                            setActiveModal('kurikulum');
                           }} className="px-4 py-2 bg-amber-50 text-amber-700 rounded-xl font-black text-[10px] uppercase transition-colors hover:bg-amber-500 hover:text-white">
                            Edit
                          </button>
                          <button onClick={() => setDeleteConfirm({ id: doc.id, tab: 'kurikulum' })}
                            className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }

              if (list.length === 0) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] gap-4 animate-fadeIn">
                    <p className="text-slate-400 font-bold tracking-wider text-[11px] text-center">Tidak ada data yang di tampilkan</p>
                  </div>
                );
              }

              const isTeacherItem = (item) => Boolean(
                item && (item.nip || item.school_id || (item.name && !item.hari && !item.schedule_label && !item.kelas_nama && !item.class_name && !item.hari_waktu))
              );

              const startIndex = (detailPage - 1) * rowsPerPage;
              const pagedData = activeDetailTab === 'magang' ? list : list.slice(startIndex, startIndex + rowsPerPage);

              return (
                <div className="grid gap-4">
                  {pagedData.map((item, idx) => (
                    <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between group hover:border-cyan-200 transition-all">
                      <div className="flex items-center gap-4">
                        {activeDetailTab !== 'magang' && <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 text-xs">{startIndex + idx + 1}</div>}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-800 text-sm leading-tight">
                              {activeDetailTab === 'guru_jadwal' 
                                ? (isTeacherItem(item) 
                                    ? `${item.name || item.nama || 'Guru'}${Array.isArray(item.mapel) && item.mapel.length > 0 ? ` | ${item.mapel.join(' | ')}` : ''}` 
                                    : `${item.hari || '-'} | ${item.kelas || item.kelas_nama || '-'} | ${item.teacher_name || item.guru_nama || 'Guru'}`) :
                                (activeDetailTab === 'magang' && item.tipeKegiatan === 'study_tour')
                                ? 'Study Tour' :
                                (activeDetailTab === 'magang' && item.tipeKegiatan === 'pertukaran_siswa')
                                ? 'Pertukaran Siswa/i' :
                                (activeDetailTab === 'magang' && item.tipeKegiatan === 'perlombaan')
                                ? 'Perlombaan' :
                                (activeDetailTab === 'magang' && item.tipeKegiatan === 'ekstrakurikuler')
                                ? 'Ekstrakurikuler'
                                : (item.nama || item.name || item.namaKegiatan || item.tempatMagang || item.label || 'Data Item')}
                            </p>
                            {activeDetailTab === 'guru_jadwal' && (
                              <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase font-bold tracking-widest">{isTeacherItem(item) ? 'Guru' : 'Jadwal'}</span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {activeDetailTab === 'magang' ? formatCreatedTimestamp(item) : activeDetailTab === 'kelas' ? `${item.jurusan} | ${item.kapasitas} Siswa` :
                              activeDetailTab === 'guru_jadwal' ? (isTeacherItem(item) ? `${item.jurusan || 'Umum'} | NIP/ID: ${item.nip || item.school_id || '-'}` : `Hari: ${item.hari || '-'} | Waktu: ${item.jam || item.hari_waktu || '-'} | Kelas: ${item.kelas || item.kelas_nama || '-'} | Guru: ${item.teacher_name || item.guru_nama || '-'}`) :
                                activeDetailTab === 'mapel' ? `Kode: ${item.kode || '-'} | Kelompok: ${item.kelompok || '-'} | Jurusan: ${item.jurusan || '-'} | Tingkat: ${item.tingkat || '-'}` :
                                  activeDetailTab === 'magang' ? (() => {
                                    if (item.tipeKegiatan === 'study_tour') {
                                      const sName = item.resolvedStudentName || studentsList?.find(s => String(s.id) === String(item.muridInput))?.name || '-';
                                      const tName = item.resolvedTeacherName || allTeachers?.find(t => String(t.id) === String(item.guruPenanggungJawab))?.name || '-';
                                      return `${sName} | ${tName} | ${item.statusPembayaranInput || '-'} & ${item.statusAcc || '-'} | ${item.tujuanNegaraDisplay || item.tujuanNegara || '-'} - ${item.namaKota || '-'} | ${item.tujuan || '-'}`;
                                    }
                                    if (item.tipeKegiatan === 'ekstrakurikuler') {
                                      const tName = item.resolvedTeacherName || allTeachers?.find(t => String(t.id) === String(item.guruPembimbing))?.name || '-';
                                      const formatDate = (dateStr) => {
                                        if (!dateStr) return '-';
                                        const d = new Date(dateStr);
                                        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                      };
                                      const pesertaCount = (item.peserta || []).length;
                                      return `${item.namaKegiatan || '-'} | Pembina: ${tName} | ${formatDate(item.waktuDiadakan)} | ${pesertaCount} murid`;
                                    }
                                    if (item.tipeKegiatan === 'pertukaran_siswa') {
                                      const formatDate = (dateStr) => {
                                        if (!dateStr) return '-';
                                        const d = new Date(dateStr);
                                        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                      };
                                      const dateRange = `${formatDate(item.tanggalMulai)} - ${formatDate(item.tanggalBerakhir)}`;
                                      const studentNames = (item.peserta || []).map(p => p.name).join(' ; ');
                                      return `${item.namaSekolahTujuan || '-'} | ${dateRange} | ${studentNames || '-'}`;
                                    }
                                    if (item.tipeKegiatan === 'perlombaan') {
                                      const formatDate = (dateStr) => {
                                        if (!dateStr) return '-';
                                        const d = new Date(dateStr);
                                        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                      };
                                      const sName = item.resolvedStudentName || studentsList?.find(s => String(s.id) === String(item.muridInput))?.name || '-';
                                      const sId = item.muridInput || '-';
                                      const timeRange = `Waktu : ${item.jamMulai || '-'} - ${item.jamSelesai || '-'}`;
                                      return `${item.namaKegiatan || '-'} | ${item.tempatPerlombaan || '-'} | ${sId} - ${sName} | ${formatDate(item.waktuDiadakan)} ${timeRange}`;
                                    }
                                    return `${(item.tipeKegiatan || 'kegiatan').replace('_', ' ')} | ${item.namaSekolahTujuan || item.namaKegiatan || item.tempatMagang || item.tujuan || '-'} | ${item.tanggalMulai || item.waktuDiadakan || '-'}`;
                                  })() :
                                 activeDetailTab === 'jurusan' ? (item.head_name && item.head_name !== '-' ? item.head_name : (teacherOptions.find(t => String(t.id) === String(item.ketuaId || item.head_user_id))?.name || 'Belum ditentukan')) :
                                      `ID: ${item.id}`}
                          </p>
                          {activeDetailTab !== 'magang' && <p className="mt-2 text-[10px] font-bold tracking-wide text-slate-400">{formatDetailTimestamp(item)}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsFormDirty(false);
                            if (activeDetailTab === 'kelas') {
                              const parts = (item.nama || '').split(' ');
                              // Resolve waliId: prioritas numeric ID â†’ fallback lookup by nama
                              const resolvedWaliId = item.waliId
                                ? String(item.waliId)
                                : item.homeroom_teacher_id
                                  ? String(item.homeroom_teacher_id)
                                  : (() => {
                                      const found = allTeachers.find(t =>
                                        (t.name || t.full_name || '').toLowerCase() === (item.homeroom_teacher_name || '').toLowerCase()
                                      );
                                      return found ? String(found.id) : '';
                                    })();
                              setKelasForm({
                                tingkat: item.tingkat || parts[0] || 'X',
                                jurusan: item.jurusan || parts[1] || 'TKJ',
                                nomorKelas: item.nomorKelas || parts[2] || '1',
                                waliKelas: resolvedWaliId,
                                tahunAjaran: item.tahun_ajaran || item.academic_year || item.tahunAjaran || '',
                                semester: item.semester || 'Ganjil',
                                kapasitas: String(item.kapasitas || ''),
                                students: item.students || []
                              });
                              setSearchStudentKelas('');
                              setActiveModal('kelas');
                            } else if (activeDetailTab === 'guru_jadwal') {
                              // Resolve guru ID
                              let gId = item.guruId;
                              if (!gId && item.teacher_name) {
                                const found = allTeachers.find(t =>
                                  (t.name || t.full_name || '').toLowerCase() === (item.teacher_name || '').toLowerCase()
                                );
                                if (found) gId = found.id;
                              }

                              // Resolve mapelId: harus numeric ID — cari dari masterData.mapel berdasarkan nama jika perlu
                              let resolvedMapelId = item.mapelId || '';
                              if (!resolvedMapelId && item.mapel) {
                                const foundMapel = (masterData.mapel || []).find(m =>
                                  (m.nama || '').toLowerCase() === (item.mapel || '').toLowerCase()
                                );
                                if (foundMapel) resolvedMapelId = String(foundMapel.id);
                              }

                              // Normalize jam: "07.30" â†’ "07:30" untuk input[type=time]
                              const normalizeJam = (s) => (s || '').replace('.', ':');
                              const times = (item.jam || '').split(' - ');

                              setGuruJadwalForm({
                                guruId: gId ? String(gId) : '',
                                nip: item.nip || resolveNip(allTeachers.find(t => String(t.id) === String(gId))) || '',
                                hari: item.hari || '',
                                sesi: item.sesi || 'morning',
                                jenisJadwal: item.jenisJadwal || 'manual',
                                kelasId: item.kelasId ? String(item.kelasId) : '',
                                jurusan: item.jurusan || '',
                                ruangan: item.ruang || '',
                                mapelId: resolvedMapelId,
                                slotWaktu: item.slotWaktu || '',
                                jamMulai: normalizeJam(times[0]),
                                jamSelesai: normalizeJam(times[1])
                              });
                              setActiveModal('guru_jadwal');
                            } else if (activeDetailTab === 'mapel') {
                              setMapelForm({ 
                                nama: item.nama || '',
                                kelompok: item.kelompok || 'C',
                                jurusan: item.jurusan || 'Umum',
                                tingkat: item.tingkat || 'X',
                                kode: item.kode || ''
                              });
                              setEditingItem(item);
                              setIsFormDirty(false);
                              setActiveModal('mapel');
                            } else if (activeDetailTab === 'magang') {
                              setEditingItem(item);
                              setMagangForm({ ...INITIAL_MAGANG_FORM, ...item });
                              setIsFormDirty(false);
                              setActiveModal('magang');
                            } else if (activeDetailTab === 'jurusan') {
                              // Resolve ketuaId: prioritize saved ID/head_user_id, fallback to lookup by head_name
                              let resolvedKetuaId = item.ketuaId || item.head_user_id || '';
                              if (!resolvedKetuaId && item.head_name && item.head_name !== '-') {
                                const match = teacherOptions.find(p =>
                                  (p.name || p.full_name || '').toLowerCase() === (item.head_name || '').toLowerCase()
                                );
                                if (match) resolvedKetuaId = String(match.id);
                              }
                              setJurusanForm({
                                nama: item.nama || item.name || '',
                                kode: item.kode || item.code || '',
                                ketuaId: String(resolvedKetuaId || '')
                              });
                              setEditingItem(item);
                              setIsFormDirty(false);
                              setActiveModal('jurusan');
                            }
                          }}
                          className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ id: item.id, tab: activeDetailTab === 'guru_jadwal' ? (item.nip ? 'guru' : 'jadwal') : activeDetailTab })}
                          className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Archive and pagination remain available to other detail tabs. */}
          {!['magang', 'kurikulum'].includes(activeDetailTab) && (() => {
            const list = masterData[activeDetailTab] || [];
            const totalPages = Math.ceil(list.length / rowsPerPage);
            return (
              <div className="pt-6 border-t border-slate-100 mt-8 flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Left side spacer for centering */}
                <div className="hidden md:block flex-1" />

                {/* Center Button */}
                <div className="flex-1 flex justify-center">
                  <button
                    disabled={(masterData[activeDetailTab] || []).length === 0}
                    onClick={() => {
                      setArchiveForm({ tahunAjaran: '', semester: 'Ganjil' });
                      setTabArchiveModalOpen(true);
                    }}
                    className={`text-[10px] font-black tracking-widest transition-colors ${
                      (masterData[activeDetailTab] || []).length > 0
                        ? 'text-rose-500 hover:text-rose-700'
                        : 'text-slate-300 cursor-not-allowed opacity-50'
                    }`}
                  >
                    Arsipkan Data Tab
                  </button>
                </div>

                {/* Right Pagination */}
                <div className="flex-1 flex justify-end items-center gap-3">
                  {totalPages > 0 && (
                    <p className="text-[10px] font-black text-slate-400 tracking-widest mr-2">
                      Halaman {detailPage} dari {totalPages}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      disabled={detailPage === 1 || totalPages === 0}
                      onClick={() => setDetailPage(p => p - 1)}
                      className={`p-3 rounded-xl border border-slate-200 transition-all ${(detailPage === 1 || totalPages === 0) ? 'opacity-20 cursor-not-allowed grayscale' : 'bg-white hover:bg-slate-50 active:scale-90 shadow-sm'}`}
                    >
                      <ChevronLeft size={16} className="text-slate-600" />
                    </button>
                    <button
                      disabled={detailPage === totalPages || totalPages === 0}
                      onClick={() => setDetailPage(p => p + 1)}
                      className={`p-3 rounded-xl border border-slate-200 transition-all ${(detailPage === totalPages || totalPages === 0) ? 'opacity-20 cursor-not-allowed grayscale' : 'bg-white hover:bg-slate-50 active:scale-90 shadow-sm'}`}
                    >
                      <ChevronRight size={16} className="text-slate-600" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      )}

      {/* ==== MODAL MANAGER ==== */}
      {createPortal(
        <AnimatePresence>
          {activeModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
              >
                {/* HEADER */}
                <div
                  className="px-10 py-8 border-b border-slate-100 flex items-center justify-between"
                  style={{ backgroundColor: modalBg(activeModal) }}
                >
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {(() => {
                    const titleMap = {
                      jurusan:    'Tambah Jurusan',
                      struktur:   'Kelola Struktur Akademik',
                      kbm:        'Kelola KBM Terpadu',
                      kelas:      'Kelola Kelas',
                      mapel:      'Kelola Mata Pelajaran',
                      guru:       'Kelola Guru',
                      guru_jadwal:'Kelola Jadwal Guru',
                      kurikulum:  'Kelola Kurikulum',
                      magang:     'Kelola Kegiatan Ekstra Sekolah',
                    };
                    return titleMap[activeModal] || ('Kelola ' + (activeModal?.charAt(0).toUpperCase() + activeModal?.slice(1)));
                  })()}
                </h3>
                    <p className="text-[11px] font-bold text-slate-400 tracking-widest mt-1 italic">Lengkapi formulir manajemen di bawah ini</p>
                  </div>
                  <ModalCloseControl onClose={closeModal} />
                </div>

              {/* BODY */}
              <div
                className="p-10 max-h-[70vh] overflow-y-auto space-y-8"
                onChangeCapture={event => {
                  if (event.target.matches('input, select, textarea') && !event.target.disabled) {
                    setIsFormDirty(true);
                  }
                }}
              >

                {activeModal === 'struktur' && (
                  <div className="space-y-7">
                    <section className="space-y-4">
                      <div className="flex items-center gap-3"><span style={{ backgroundColor: COLORS.purpleDark }} className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white">1</span><h4 className="font-black text-slate-800">Registrasi Jurusan</h4></div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                         <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">TAHUN AJARAN</label>{academicYearOptions.length ? (<select value={kelasForm.tahunAjaran} onChange={e => { setKelasForm(f => ({ ...f, tahunAjaran: e.target.value })); setIsFormDirty(true); }} className="w-full rounded-xl border border-slate-200 bg-white py-4 px-4 text-sm font-bold text-slate-800 outline-none focus:border-purple-500"><option value="">Pilih tahun ajaran</option>{academicYearOptions.map((o) => (<option key={o.id || o.value} value={o.value}>{o.value}</option>))}</select>) : (<div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-800">TA.</span><input inputMode="numeric" maxLength={9} value={kelasForm.tahunAjaran} onChange={e => { const sanitized = e.target.value.replace(/[^0-9/]/g, ''); const slashIndex = sanitized.indexOf('/'); const value = (slashIndex === -1 ? sanitized : `${sanitized.slice(0, slashIndex + 1)}${sanitized.slice(slashIndex + 1).replaceAll('/', '')}`).slice(0, 9); setKelasForm(f => ({ ...f, tahunAjaran: value })); setIsFormDirty(true); }} placeholder="2026/2027" className="w-full rounded-xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-800 outline-none focus:border-purple-500" /></div>)}</div>
                        <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">SEMESTER</label><select value={kelasForm.semester} onChange={e => { setKelasForm(f => ({ ...f, semester: e.target.value })); setIsFormDirty(true); }} className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 outline-none focus:border-purple-500"><option value="Ganjil">Ganjil</option><option value="Genap">Genap</option></select></div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                        <div className="space-y-2"><FormInput label="Masukkan Nama Jurusan Lengkap" placeholder="Teknik Komputer & Jaringan" themeColor={COLORS.purpleDark} value={jurusanForm.nama} onChange={e => { setSelectedExistingJurusanId(null); setJurusanForm(f => ({ ...f, nama: e.target.value })); }} />{existingJurusans.length > 0 && <div className="flex flex-wrap gap-2 pt-1">{existingJurusans.map(item => <button key={item.dbId || item.id} type="button" onClick={() => { const kode = String(item.kode || '').toUpperCase(); setSelectedExistingJurusanId(item.dbId || item.id); setJurusanForm({ nama: item.nama || item.name || '', kode, ketuaId: String(item.ketuaId || item.head_user_id || '') }); setKelasForm(f => ({ ...f, jurusan: kode })); setIsFormDirty(true); }} style={{ borderColor: `${COLORS.purpleDark}45`, color: COLORS.purpleDark, backgroundColor: selectedExistingJurusanId === (item.dbId || item.id) ? COLORS.purpleLight : 'white' }} className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider transition hover:brightness-95">{item.kode}</button>)}</div>}</div>
                        <FormInput label="Kode Jurusan" placeholder="TKJ" themeColor={COLORS.purpleDark} autoUpper={true} value={jurusanForm.kode} onChange={e => { const kode = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase(); setSelectedExistingJurusanId(null); setJurusanForm(f => ({ ...f, kode })); setKelasForm(f => ({ ...f, jurusan: kode })); }} />
                      </div>
                    </section>
                    <section className="space-y-4 border-t border-slate-100 pt-6">
                      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span style={{ backgroundColor: COLORS.purpleDark }} className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white">2</span><h4 className="font-black text-slate-800">Penataan Kelas 1</h4></div>{editingItem?.editingStructureGroup && <button type="button" onClick={() => setDeleteConfirm({ id: kelasForm.dbId || editingItem.dbId, tab: 'kelas', editorContext: { formIndex: 0 }, confirmMessage: `Hapus kelas ${kelasForm.tingkat} ${jurusanForm.kode} ${kelasForm.nomorKelas} saja dari database? Kelas lain tidak akan ikut terhapus.` })} aria-label="Hapus kelas ini dari database" className="rounded-full bg-slate-100 p-2.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 active:bg-rose-100"><Trash2 size={16} /></button>}</div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">TINGKAT</label><select value={kelasForm.tingkat} disabled={Boolean(editingItem?.editingStructureClass)} onChange={e => setKelasForm(f => ({ ...f, tingkat: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">{editingItem?.editingStructureClass ? <option value={kelasForm.tingkat}>{kelasForm.tingkat}</option> : <><option value="">Pilih tingkat</option><option value="X">X</option><option value="XI">XI</option><option value="XII">XII</option></>}</select></div>
                        <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">KODE JURUSAN</label><div style={{ backgroundColor: COLORS.purpleLight, borderColor: `${COLORS.purpleDark}30`, color: COLORS.purpleDark }} className="w-full rounded-xl border p-4 text-sm font-black">{jurusanForm.kode?.toUpperCase() || '—'}</div></div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">NOMOR KELAS</label><input type="text" inputMode="numeric" pattern="[0-9]*" value={kelasForm.nomorKelas} onChange={e => setKelasForm(f => ({ ...f, nomorKelas: e.target.value.replace(/\D/g, '') }))} placeholder="Contoh: 1" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500" /></div>
                        <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">WALI KELAS</label><SearchableDropdown value={kelasForm.waliKelas} onChange={waliKelas => { setKelasForm(f => ({ ...f, waliKelas })); setIsFormDirty(true); }} options={waliOptionsForStructureClass(0, kelasForm.waliKelas).map(teacher => ({ value: teacher.id, label: `${teacher.name || teacher.full_name} (${resolveNip(teacher) || '-'})` }))} placeholder="-- Pilih wali kelas --" searchPlaceholder="Cari nama atau NIP guru..." themeColor={COLORS.purpleDark} hideEmptyMessage /></div>
                      </div>
                    </section>
                    <section className="space-y-3 border-t border-slate-100 pt-6">
                      <div className="flex items-center gap-3"><span style={{ backgroundColor: COLORS.purpleDark }} className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white">3</span><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{editingItem?.editingStructureGroup ? `Murid Kelas ${kelasForm.tingkat} ${jurusanForm.kode} ${kelasForm.nomorKelas}` : 'Silahkan Pilih Murid'}</p><span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white">{(kelasForm.students || []).length}</span></div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <input value={searchStudentKelas} onChange={e => setSearchStudentKelas(e.target.value.replace(/[^0-9A-Za-z\s]/g, ''))} placeholder="Cari nama atau NISN" className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold" />
                        <div className="flex min-h-40 max-h-52 content-start flex-wrap gap-2 overflow-y-auto">
                          {(studentsList || []).filter(student => { const keyword = searchStudentKelas.toLowerCase(); const nisn = studentNisn(student); const selectedHere = studentIsSelected(kelasForm.students, student.id); const matchesKeyword = !keyword || String(student.name || student.full_name || '').toLowerCase().includes(keyword) || nisn.includes(keyword); return matchesKeyword && (selectedHere || !studentSelectedInAnyStructureClass(student.id, 0)); }).sort((a, b) => Number(studentIsSelected(kelasForm.students, b.id)) - Number(studentIsSelected(kelasForm.students, a.id))).map(student => { const selected = studentIsSelected(kelasForm.students, student.id); const highlighted = selected; const nisn = studentNisn(student) || '-'; return <button type="button" key={student.id} aria-pressed={selected} title={highlighted && !selected ? 'Sudah dipilih pada kelas lain' : undefined} onClick={() => { setKelasForm(form => { const current = Array.isArray(form.students) ? form.students : []; const isSelectedHere = studentIsSelected(current, student.id); return { ...form, students: isSelectedHere ? current.filter(id => String(id) !== String(student.id)) : [...current, student.id] }; }); setIsFormDirty(true); }} className={`h-fit rounded-full border px-4 py-2 text-left text-xs font-bold transition ${highlighted ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-slate-100 text-slate-900 hover:border-blue-200 hover:bg-slate-200'}`}>{student.name || student.full_name} <span className="opacity-80">({nisn})</span></button>; })}
                        </div>
                      </div>
                    </section>
                    <label style={{ borderColor: `${COLORS.purpleDark}55`, backgroundColor: COLORS.purpleLight }} className="flex min-h-[78px] cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-4 transition hover:brightness-[0.98]">
                      <input type="checkbox" checked={addAnotherClass} onChange={e => { if (!e.target.checked) { setAddAnotherClass(false); setAdditionalClassForms(forms => { const removeIndex = forms.map(form => !form.dbId).lastIndexOf(true); return removeIndex < 0 ? forms : forms.filter((_, index) => index !== removeIndex); }); return; } if (addAnotherClass) return; setAddAnotherClass(true); setAdditionalClassForms(forms => [...forms, { tingkat: kelasForm.tingkat, nomorKelas: String((parseInt(kelasForm.nomorKelas, 10) || 0) + 1), kapasitas: '36', students: [], studentSearch: '', waliKelas: '', addNext: false }]); }} style={{ accentColor: COLORS.purpleDark }} className="h-5 w-5 shrink-0 rounded border-slate-300" />
                      <span><span style={{ color: COLORS.purpleDark }} className="block text-sm font-black">Tambahkan kelas lagi</span><span style={{ color: COLORS.purpleDark }} className="block text-xs font-semibold opacity-80">Gunakan jurusan yang sama untuk membuat kelas berikutnya.</span></span>
                    </label>
                    {additionalClassForms.map((item, index) => (
                      <section key={index} style={{ borderColor: `${COLORS.purpleDark}25` }} className="space-y-4 rounded-2xl border bg-slate-50 p-5">
                        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span style={{ backgroundColor: COLORS.purpleDark }} className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white">{index + 2}</span><h4 className="font-black text-slate-800">Penataan Kelas {index + 2}</h4></div>{item.dbId ? <button type="button" onClick={() => setDeleteConfirm({ id: item.dbId, tab: 'kelas', editorContext: { formIndex: index + 1 }, confirmMessage: `Hapus kelas ${item.tingkat} ${jurusanForm.kode} ${item.nomorKelas} saja dari database? Kelas lain tidak akan ikut terhapus.` })} aria-label={`Hapus kelas ${item.tingkat} ${jurusanForm.kode} ${item.nomorKelas}`} className="rounded-full bg-slate-100 p-2.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 active:bg-rose-100"><Trash2 size={16} /></button> : <button type="button" onClick={() => { if (index === 0) setAddAnotherClass(false); else setAdditionalClassForms(forms => forms.map((form, itemIndex) => itemIndex === index - 1 ? { ...form, addNext: false } : form)); setAdditionalClassForms(forms => forms.filter((_, itemIndex) => itemIndex !== index)); }} aria-label={`Hapus formulir kelas ${index + 2}`} className="rounded-full bg-slate-100 p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 active:bg-rose-100 active:text-rose-600"><X size={16} strokeWidth={2.5} /></button>}</div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">TINGKAT</label><select value={item.tingkat} disabled={Boolean(editingItem?.editingStructureClass)} onChange={e => setAdditionalClassForms(forms => forms.map((form, itemIndex) => itemIndex === index ? { ...form, tingkat: e.target.value } : form))} className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">{editingItem?.editingStructureClass ? <option value={kelasForm.tingkat}>{kelasForm.tingkat}</option> : <><option value="">Pilih tingkat</option><option value="X">X</option><option value="XI">XI</option><option value="XII">XII</option></>}</select></div>
                          <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">KODE JURUSAN</label><div style={{ backgroundColor: COLORS.purpleLight, borderColor: `${COLORS.purpleDark}30`, color: COLORS.purpleDark }} className="w-full rounded-xl border p-4 text-sm font-black">{jurusanForm.kode?.toUpperCase() || '—'}</div></div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">NOMOR KELAS</label><input type="text" inputMode="numeric" pattern="[0-9]*" value={item.nomorKelas} onChange={e => setAdditionalClassForms(forms => forms.map((form, itemIndex) => itemIndex === index ? { ...form, nomorKelas: e.target.value.replace(/\D/g, '') } : form))} placeholder="Contoh: 2" className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500" /></div>
                          <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">WALI KELAS</label><SearchableDropdown value={item.waliKelas || ''} onChange={waliKelas => setAdditionalClassForms(forms => forms.map((form, itemIndex) => itemIndex === index ? { ...form, waliKelas } : form))} options={waliOptionsForStructureClass(index + 1, item.waliKelas).map(teacher => ({ value: teacher.id, label: `${teacher.name || teacher.full_name} (${resolveNip(teacher) || '-'})` }))} placeholder="-- Pilih wali kelas --" searchPlaceholder="Cari nama atau NIP guru..." themeColor={COLORS.purpleDark} hideEmptyMessage /></div>
                        </div>
                        <div className="space-y-3 border-t border-slate-200 pt-4"><div className="ml-1 flex items-center gap-2"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Murid Kelas {item.tingkat} {jurusanForm.kode} {item.nomorKelas}</p><span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white">{(item.students || []).length}</span></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><input value={item.studentSearch || ''} onChange={e => setAdditionalClassForms(forms => forms.map((form, itemIndex) => itemIndex === index ? { ...form, studentSearch: e.target.value.replace(/[^0-9A-Za-z\s]/g, '') } : form))} placeholder="Cari nama atau NISN" className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold" /><div className="flex min-h-28 max-h-44 content-start flex-wrap gap-2 overflow-y-auto">{(studentsList || []).filter(student => { const keyword = String(item.studentSearch || '').toLowerCase(); const nisn = studentNisn(student); const selectedHere = studentIsSelected(item.students, student.id); const matchesKeyword = !keyword || String(student.name || student.full_name || '').toLowerCase().includes(keyword) || nisn.includes(keyword); return matchesKeyword && (selectedHere || !studentSelectedInAnyStructureClass(student.id, index + 1)); }).sort((a, b) => Number(studentIsSelected(item.students, b.id)) - Number(studentIsSelected(item.students, a.id))).map(student => { const selected = studentIsSelected(item.students, student.id); const highlighted = selected; const nisn = studentNisn(student) || '-'; return <button type="button" key={student.id} aria-pressed={selected} title={highlighted && !selected ? 'Sudah dipilih pada kelas lain' : undefined} onClick={() => { setAdditionalClassForms(forms => forms.map((form, itemIndex) => { if (itemIndex !== index) return form; const current = Array.isArray(form.students) ? form.students : []; const isSelectedHere = studentIsSelected(current, student.id); return { ...form, students: isSelectedHere ? current.filter(id => String(id) !== String(student.id)) : [...current, student.id] }; })); setIsFormDirty(true); }} className={`h-fit rounded-full border px-4 py-2 text-left text-xs font-bold transition ${highlighted ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-slate-100 text-slate-900 hover:border-blue-200 hover:bg-slate-200'}`}>{student.name || student.full_name} <span className="opacity-80">({nisn})</span></button>; })}</div></div></div>
                        <label style={{ borderColor: `${COLORS.purpleDark}55`, backgroundColor: COLORS.purpleLight }} className="flex min-h-[78px] cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-4 transition hover:brightness-[0.98]"><input type="checkbox" checked={Boolean(item.addNext)} onChange={e => { if (!e.target.checked) { setAdditionalClassForms(forms => forms.flatMap((form, itemIndex) => itemIndex === index ? [{ ...form, addNext: false }] : itemIndex === index + 1 && !form.dbId ? [] : [form])); return; } if (item.addNext) return; setAdditionalClassForms(forms => [...forms.map((form, itemIndex) => itemIndex === index ? { ...form, addNext: true } : form), { tingkat: kelasForm.tingkat, nomorKelas: String((parseInt(item.nomorKelas, 10) || 0) + 1), kapasitas: '36', students: [], studentSearch: '', waliKelas: '', addNext: false }]); }} style={{ accentColor: COLORS.purpleDark }} className="h-5 w-5 shrink-0 rounded border-slate-300" /><span><span style={{ color: COLORS.purpleDark }} className="block text-sm font-black">Tambahkan kelas lagi</span><span style={{ color: COLORS.purpleDark }} className="block text-xs font-semibold opacity-80">Gunakan jurusan yang sama untuk membuat kelas berikutnya.</span></span></label>
                      </section>
                    ))}
                    <button type="button" onClick={handleSimpanStrukturDasar} disabled={isSaving || !isFormDirty} style={{ backgroundColor: COLORS.purpleDark }} className="flex w-full items-center justify-center rounded-2xl py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{savePhase === 'done' ? <span className="flex items-center gap-2"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>TERSIMPAN!</span> : isSaving ? <SavingDataLabel /> : 'Simpan Jurusan & Kelas'}</button>
                  </div>
                )}

                {activeModal === 'kbm' && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">TAHUN AJARAN</label><div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">{(() => { const c = (masterData.kelas || []).find(x => String(x.dbId || x.id) === String(kbmClassId)); if (!c) return '—'; const sem = c.semester || 'Ganjil'; const ta = c.tahun_ajaran || c.academic_year || c.tahunAjaran || kbmPreview?.current_academic_year || ''; return `${sem}${ta ? ` - TA. ${ta}` : ''}`; })()}</div></div>
                      <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">PILIH KELAS</label><SearchableDropdown value={kbmClassId} disabled={Boolean(editingItem)} onChange={classId => { setKbmClassId(classId); setClassStudents([]); setGuruJadwalForm(f => ({ ...f, kelasId: classId, kodeBelajar: '' })); loadClassStudents(classId); }} options={sortSchoolClasses(masterData.kelas.filter(item => String(item.dbId || item.id) === String(kbmClassId) || !(masterData.jadwal || []).some(jadwal => String(jadwal.kelasId || jadwal.kelas_id) === String(item.dbId || item.id)))) .map(item => ({ value: item.dbId || item.id, label: item.nama || item.name }))} placeholder="- silahkan pilih kelas -" searchPlaceholder="Cari kelas..." themeColor={COLORS.orangeDark} /></div>
                    </div>
                    <>
                      {/* Semester & Wali Kelas dipindah ke Card Struktur Akademik; jadwal memakai nilai dari kelas terpilih */}
                      <section className="space-y-4 border-t border-slate-100 pt-5">
                        <h4 className="text-sm font-black text-slate-800">Jadwal Mengajar</h4>
                        <div className="grid gap-4 md:grid-cols-2">
                          <SearchableDropdown value={guruJadwalForm.guruId} onChange={guruId => setGuruJadwalForm(f => ({ ...f, guruId, kodeBelajar: '' }))} options={allTeachers.map(teacher => ({ value: teacher.id, label: `${teacher.name || teacher.full_name} (${resolveNip(teacher) || '-'})` }))} placeholder="-- Silahkan pilih guru --" searchPlaceholder="Cari nama atau NIP..." themeColor={COLORS.orangeDark} />
                          <SearchableDropdown value={guruJadwalForm.kategoriJadwal} onChange={kategoriJadwal => setGuruJadwalForm(f => ({ ...f, kategoriJadwal, kodeBelajar: '' }))} options={[{ value: 'a', label: 'A - Umum' }, { value: 'b', label: 'B - Muatan Lokal' }, { value: 'c', label: 'C - Produktif Jurusan', disabled: true, disabledReason: 'Mapel produktif hanya boleh dijadwalkan Pusat Jurusan' }]} placeholder="Pilih kategori" themeColor={COLORS.orangeDark} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <input value={guruJadwalForm.mapelName} onChange={e => setGuruJadwalForm(f => ({ ...f, mapelName: e.target.value.replace(/[^A-Za-z\s]/g, ''), mapelId: '', kodeBelajar: '' }))} placeholder="Masukkan mata pelajaran" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold outline-none transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-100" />
                          <SearchableDropdown value={guruJadwalForm.hari} onChange={hari => setGuruJadwalForm(f => ({ ...f, hari, sesi: 'manual', jenisJadwal: 'manual', kodeBelajar: '' }))} options={['senin','selasa','rabu','kamis','jumat','sabtu'].map(day => ({ value: day, label: day.toUpperCase() }))} placeholder="Pilih hari" themeColor={COLORS.orangeDark} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">JAM MULAI</label><input type="time" value={guruJadwalForm.jamMulai} onChange={e => setGuruJadwalForm(f => ({ ...f, jamMulai: e.target.value, sesi: 'manual', jenisJadwal: 'manual', kodeBelajar: '' }))} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold outline-none transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-100" /></div><div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">JAM BERAKHIR</label><input type="time" value={guruJadwalForm.jamSelesai} onChange={e => setGuruJadwalForm(f => ({ ...f, jamSelesai: e.target.value, sesi: 'manual', jenisJadwal: 'manual', kodeBelajar: '' }))} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold outline-none transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-100" /></div></div>
                        <div className="grid gap-4 md:grid-cols-2"><input value={guruJadwalForm.ruangan} onChange={e => setGuruJadwalForm(f => ({ ...f, ruangan: e.target.value, ruangId: '', kodeBelajar: '' }))} placeholder="Ruang belajar (opsional)" className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold outline-none transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-100" /><div className="flex overflow-hidden rounded-2xl border border-blue-200 bg-blue-50"><input readOnly value={guruJadwalForm.kodeBelajar} placeholder="Kode 8 karakter" className="min-w-0 flex-1 bg-transparent px-4 text-sm font-black tracking-[0.18em] text-slate-700 outline-none" /><button type="button" onClick={generateKodeBelajar} disabled={!guruJadwalForm.guruId || !guruJadwalForm.mapelName || !guruJadwalForm.hari || !guruJadwalForm.jamMulai || !guruJadwalForm.jamSelesai || (Boolean(editingItem && kbmEditBaseline) && !isKbmEditScheduleChanged)} className="border-l border-blue-200 bg-white px-5 text-xs font-black uppercase tracking-wider text-blue-700 transition hover:bg-blue-100 disabled:opacity-40">Generate</button></div></div>
                        <label className="flex min-h-[78px] cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-orange-300 bg-orange-50 p-4 transition hover:bg-orange-100">
                          <input type="checkbox" checked={addAnotherJadwal} onChange={e => { if (!e.target.checked) { setAddAnotherJadwal(false); setAdditionalJadwalForms(forms => { const removeIndex = forms.map(form => !form.dbId).lastIndexOf(true); return removeIndex < 0 ? forms : forms.filter((_, index) => index !== removeIndex); }); return; } if (addAnotherJadwal) return; setAddAnotherJadwal(true); setAdditionalJadwalForms(forms => [...forms, { ...EMPTY_KBM_JADWAL(kbmClassId), addNext: false }]); }} className="h-5 w-5 shrink-0 rounded border-orange-300 accent-orange-600" />
                          <span><span className="block text-sm font-black text-orange-700">Tambahkan Guru &amp; Jadwal Lagi</span><span className="block text-xs font-semibold text-orange-600">Simpan jadwal ini, lalu lanjutkan mengisi jadwal berikutnya untuk kelas yang sama.</span></span>
                        </label>
                        {additionalJadwalForms.map((form, index) => <section key={index} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h5 className="text-sm font-black text-slate-800">Jadwal Mengajar {index + 2}</h5><button type="button" onClick={() => { if (index === 0) setAddAnotherJadwal(false); else setAdditionalJadwalForms(forms => forms.map((item, itemIndex) => itemIndex === index - 1 ? { ...item, addNext: false } : item)); setAdditionalJadwalForms(forms => forms.filter((_, itemIndex) => itemIndex !== index)); }} className="rounded-full bg-slate-100 p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"><X size={16} /></button></div><div className="grid gap-4 md:grid-cols-2"><SearchableDropdown value={form.guruId} onChange={guruId => setAdditionalJadwalForms(forms => forms.map((item, itemIndex) => itemIndex === index ? { ...item, guruId, kodeBelajar: '' } : item))} options={allTeachers.map(teacher => ({ value: teacher.id, label: `${teacher.name || teacher.full_name} (${resolveNip(teacher) || '-'})` }))} placeholder="Pilih guru pengajar" searchPlaceholder="Cari nama atau NIP..." themeColor={COLORS.orangeDark} /><SearchableDropdown value={form.kategoriJadwal} onChange={kategoriJadwal => setAdditionalJadwalForms(forms => forms.map((item, itemIndex) => itemIndex === index ? { ...item, kategoriJadwal, kodeBelajar: '' } : item))} options={[{ value: 'a', label: 'A - Umum' }, { value: 'b', label: 'B - Muatan Lokal' }, { value: 'c', label: 'C - Produktif Jurusan', disabled: true, disabledReason: 'Mapel produktif hanya boleh dijadwalkan Pusat Jurusan' }]} placeholder="Pilih kategori" themeColor={COLORS.orangeDark} /></div><div className="grid gap-4 md:grid-cols-2"><input value={form.mapelName} onChange={e => setAdditionalJadwalForms(forms => forms.map((item, itemIndex) => itemIndex === index ? { ...item, mapelName: e.target.value.replace(/[^A-Za-z\s]/g, ''), kodeBelajar: '' } : item))} placeholder="Masukkan mata pelajaran" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold outline-none" /><SearchableDropdown value={form.hari} onChange={hari => setAdditionalJadwalForms(forms => forms.map((item, itemIndex) => itemIndex === index ? { ...item, hari, kodeBelajar: '' } : item))} options={['senin','selasa','rabu','kamis','jumat','sabtu'].map(day => ({ value: day, label: day.toUpperCase() }))} placeholder="Pilih hari" themeColor={COLORS.orangeDark} /></div><div className="grid gap-4 md:grid-cols-2"><input type="time" value={form.jamMulai} onChange={e => setAdditionalJadwalForms(forms => forms.map((item, itemIndex) => itemIndex === index ? { ...item, jamMulai: e.target.value, kodeBelajar: '' } : item))} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold" /><input type="time" value={form.jamSelesai} onChange={e => setAdditionalJadwalForms(forms => forms.map((item, itemIndex) => itemIndex === index ? { ...item, jamSelesai: e.target.value, kodeBelajar: '' } : item))} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold" /></div><div className="grid gap-4 md:grid-cols-2"><input value={form.ruangan} onChange={e => setAdditionalJadwalForms(forms => forms.map((item, itemIndex) => itemIndex === index ? { ...item, ruangan: e.target.value, kodeBelajar: '' } : item))} placeholder="Ruang belajar (opsional)" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold" /><div className="flex overflow-hidden rounded-2xl border border-blue-200 bg-blue-50"><input readOnly value={form.kodeBelajar} placeholder="Kode 8 karakter" className="min-w-0 flex-1 bg-transparent px-4 text-sm font-black tracking-[0.18em] text-slate-700 outline-none" /><button type="button" disabled={!form.guruId || !form.mapelName || !form.hari || !form.kategoriJadwal || !form.jamMulai || !form.jamSelesai} onClick={() => generateKodeUntukJadwal(form, kodeBelajar => setAdditionalJadwalForms(forms => forms.map((item, itemIndex) => itemIndex === index ? { ...item, kodeBelajar } : item)))} className="border-l border-blue-200 bg-white px-5 text-xs font-black uppercase tracking-wider text-blue-700 transition hover:bg-blue-100 disabled:opacity-40">Generate</button></div></div><label className="flex min-h-[78px] cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-orange-300 bg-orange-50 p-4 transition hover:bg-orange-100"><input type="checkbox" checked={Boolean(form.addNext)} onChange={e => { if (!e.target.checked) { setAdditionalJadwalForms(forms => forms.flatMap((item, itemIndex) => itemIndex === index ? [{ ...item, addNext: false }] : itemIndex === index + 1 && !item.dbId ? [] : [item])); return; } if (form.addNext) return; setAdditionalJadwalForms(forms => [...forms.map((item, itemIndex) => itemIndex === index ? { ...item, addNext: true } : item), { ...EMPTY_KBM_JADWAL(kbmClassId), addNext: false }]); }} className="h-5 w-5 shrink-0 rounded border-orange-300 accent-orange-600" /><span><span className="block text-sm font-black text-orange-700">Tambahkan Guru & Jadwal Lagi</span><span className="block text-xs font-semibold text-orange-600">Simpan jadwal ini, lalu lanjutkan mengisi jadwal berikutnya untuk kelas yang sama.</span></span></label></section>)}
                        <button type="button" onClick={handleSimpanGuruJadwal} disabled={isSaving || !guruJadwalForm.guruId || !guruJadwalForm.mapelName || !guruJadwalForm.jamMulai || !guruJadwalForm.jamSelesai || !guruJadwalForm.kodeBelajar || (Boolean(editingItem) && !isFormDirty && !isKbmEditScheduleChanged)} className="flex w-full items-center justify-center rounded-xl bg-orange-600 py-4 text-xs font-black uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-50">{savePhase === 'done' ? <span className="flex items-center gap-2"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>TERSIMPAN!</span> : isSaving ? <SavingDataLabel /> : 'Simpan Guru & Jadwal'}</button>
                      </section>
                    </>
                  </div>
                )}

                {activeModal === 'kbm_legacy' && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
                      <p className="text-sm font-black text-orange-950">Alur KBM per semester</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-orange-700">Pilih periode dan kelas dari Card Struktur, tentukan wali kelas serta roster murid, kemudian susun jadwal. Kode belajar dibuat untuk setiap jadwal mapel dan dibagikan oleh guru kepada murid yang ingin masuk ruang belajar mapel tersebut.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormInput label="Tahun Ajaran" placeholder="Contoh: 2026 / 2027" themeColor={COLORS.orangeDark} value={kbmTerm.tahunAjaran} onChange={e => setKbmTerm(t => ({ ...t, tahunAjaran: e.target.value }))} />
                      <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">SEMESTER</label><select value={kbmTerm.semester} onChange={e => setKbmTerm(t => ({ ...t, semester: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800 outline-none"><option>Ganjil</option><option>Genap</option></select></div>
                    </div>
                    <div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">KELAS</label><select value={kbmClassId} onChange={e => { setKbmClassId(e.target.value); loadClassStudents(e.target.value); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800 outline-none"><option value="">Pilih kelas dari Card Struktur</option>{sortSchoolClasses(masterData.kelas || []).map(item => <option key={item.dbId || item.id} value={item.dbId || item.id}>{item.nama || item.name}</option>)}</select></div>
                    {kbmClassId && <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]"><div className="space-y-2"><label className="ml-1 text-[10px] font-black tracking-widest text-slate-400">WALI KELAS</label><select defaultValue={(masterData.kelas || []).find(x => String(x.dbId || x.id) === String(kbmClassId))?.waliId || ''} onChange={e => saveHomeroomTeacher(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700"><option value="">Belum ditentukan</option>{allTeachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name || teacher.full_name}</option>)}</select></div><button type="button" onClick={() => { handleOpenModal('guru_jadwal'); setGuruJadwalForm(prev => ({ ...prev, kelasId: String(kbmClassId), tahunAjaran: kbmTerm.tahunAjaran, semester: kbmTerm.semester })); }} className="self-end rounded-xl bg-orange-600 px-4 py-3 text-xs font-black text-white">SUSUN JADWAL</button></div>
                      <div className="border-t border-slate-200 pt-5"><p className="mb-3 text-xs font-black tracking-wider text-slate-700">ROSTER MURID KELAS</p><div className="flex flex-col gap-3 sm:flex-row"><select value={classStudentId} onChange={e => setClassStudentId(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold"><option value="">Pilih murid</option>{(studentsList || []).filter(s => !classStudents.some(item => String(item.id) === String(s.id))).map(s => <option key={s.id} value={s.id}>{s.name || s.full_name}</option>)}</select><button type="button" onClick={assignStudentToClass} disabled={!classStudentId} className="rounded-xl bg-indigo-600 px-4 py-3 text-xs font-black text-white disabled:opacity-40">+ TAMBAH MURID</button></div><div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl bg-white">{classStudentsLoading ? <p className="p-4 text-center text-xs font-bold text-slate-400">Memuat roster...</p> : classStudents.length ? classStudents.map(student => <div key={student.id} className="flex items-center justify-between p-3"><span className="text-sm font-bold text-slate-700">{student.name}</span><button type="button" onClick={() => removeStudentFromClass(student.id)} className="text-[10px] font-black text-rose-500">KELUARKAN</button></div>) : <p className="p-4 text-center text-xs font-bold text-slate-400">Belum ada murid pada kelas ini.</p>}</div></div>
                    </div>}
                  </div>
                )}

                {/* JURUSAN FORM */}
                {activeModal === 'jurusan' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormInput
                        label="Nama Jurusan / Program Keahlian"
                        placeholder="Misal: Teknik Komputer dan Jaringan"
                        themeColor={COLORS.purpleDark}
                        value={jurusanForm.nama}
                        onChange={e => {
                          setJurusanForm(f => ({ ...f, nama: e.target.value }));
                          setIsFormDirty(true);
                        }}
                      />
                      <FormInput
                        label="Singkatan / Kode"
                        placeholder="Misal: TKJ"
                        themeColor={COLORS.purpleDark}
                        autoUpper={true}
                        value={jurusanForm.kode}
                        onChange={e => {
                          setJurusanForm(f => ({ ...f, kode: e.target.value }));
                          setIsFormDirty(true);
                        }}
                      />
                    </div>
                    {/* Pilih Ketua Jurusan */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">Kepala / Ketua Jurusan</label>
                      <select
                        value={String(jurusanForm.ketuaId || '')}
                        onChange={e => {
                          setJurusanForm(f => ({ ...f, ketuaId: e.target.value }));
                          setIsFormDirty(true);
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:bg-white transition-all outline-none"
                        style={{ '--tw-ring-color': `${COLORS.purpleDark}20`, '--tw-border-color-focus': COLORS.purpleDark }}
                        onFocus={e => { e.target.style.borderColor = COLORS.purpleDark; e.target.style.boxShadow = `0 0 0 4px ${COLORS.purpleDark}20`; }}
                        onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}
                      >
                        <option value="">-- silahkan pilih --</option>
                        {teacherOptions.length === 0 ? (
                          <option value="" disabled>— Belum ada data Pusat Jurusan —</option>
                        ) : (
                          teacherOptions.map(teacher => (
                            <option key={teacher.id} value={String(teacher.id)}>
                              {teacher.name || teacher.full_name || 'Tanpa Nama'}{teacher.nisn_nip || teacher.nip ? ` — NIP: ${teacher.nisn_nip || teacher.nip}` : ''}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                )}

                {/* KELAS FORM */}
                {activeModal === 'kelas' && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs font-semibold leading-5 text-blue-700">Card Struktur hanya menyimpan identitas kelas. Wali kelas dan roster murid ditentukan pada Card KBM setelah periode semester dipilih.</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">Tingkat Kelas</label>
                      <select
                        value={kelasForm.tingkat}
                        onChange={e => {
                          setKelasForm(f => ({ ...f, tingkat: e.target.value }));
                          setIsFormDirty(true);
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all outline-none">
                        <option>X</option><option>XI</option><option>XII</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">Pilih Jurusan</label>
                      <select
                        value={kelasForm.jurusan}
                        onChange={e => {
                          setKelasForm(f => ({ ...f, jurusan: e.target.value }));
                          setIsFormDirty(true);
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all outline-none">
                        <option value="">-- pilih jurusan --</option>
                        {masterData.jurusan.length > 0 ? (
                          [...masterData.jurusan]
                            .sort((a, b) => a.kode.localeCompare(b.kode))
                            .map(j => (
                              <option key={j.id} value={j.kode}>{j.nama} ({j.kode})</option>
                            ))
                        ) : (
                          <option disabled value="">— Tambahkan jurusan terlebih dahulu —</option>
                        )}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">Nomor Kelas</label>
                      <select
                        value={kelasForm.nomorKelas}
                        onChange={e => {
                          setKelasForm(f => ({ ...f, nomorKelas: e.target.value }));
                          setIsFormDirty(true);
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all outline-none">
                        <option>1</option><option>2</option><option>3</option><option>4</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">Kapasitas Rencana</label>
                      <input type="number" min="1" max="100" value={kelasForm.kapasitas || 36} onChange={e => { setKelasForm(f => ({ ...f, kapasitas: e.target.value })); setIsFormDirty(true); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm outline-none" />
                    </div>
                  </div>
                  </div>
                )}

                {/* MAPEL FORM */}
                {activeModal === 'mapel' && (
                  <div className="space-y-4">
                    {/* Nama Mapel */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Nama Mapel:</label>
                      <input 
                        type="text"
                        placeholder="Misal: Matematika"
                        value={mapelForm.nama}
                        onChange={e => {
                          const newNama = e.target.value;
                          setMapelForm(f => {
                            const updated = { ...f, nama: newNama };
                            // Jangan timpa kode existing saat edit — hanya auto-generate saat tambah baru
                            if (!editingItem) updated.kode = generateKodeMapel(updated);
                            return updated;
                          });
                          setIsFormDirty(true);
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                      />
                    </div>

                    {/* Kelompok */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Kelompok:</label>
                      <select
                        value={mapelForm.kelompok || 'A'}
                        onChange={e => {
                          const val = e.target.value;
                          setMapelForm(f => {
                            const updated = { ...f, kelompok: val };
                            if (!editingItem) updated.kode = generateKodeMapel(updated);
                            return updated;
                          });
                          setIsFormDirty(true);
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                      >
                        <option value="A">A - Umum (Wajib Nasional)</option>
                        <option value="B">B - Muatan Lokal</option>
                        {/* Kelompok C (Produktif/Kejuruan) dikelola Pusat Jurusan — tidak bisa dipilih Admin Akademik. */}
                        <option value="C" disabled>C - Produktif (khusus Pusat Jurusan)</option>
                      </select>
                    </div>

                    {/* Jurusan */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Jurusan:</label>
                      <select
                        value={mapelForm.jurusan || 'Umum'}
                        onChange={e => {
                          const val = e.target.value;
                          setMapelForm(f => {
                            const updated = { ...f, jurusan: val };
                            updated.kode = generateKodeMapel(updated);
                            return updated;
                          });
                          setIsFormDirty(true);
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                      >
                        <option value="Umum">Umum</option>
                        {masterData.jurusan.map(j => (
                          <option key={j.id} value={j.kode}>{j.kode}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tingkat */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Tingkat:</label>
                      <select
                        value={mapelForm.tingkat || 'X'}
                        onChange={e => {
                          const val = e.target.value;
                          setMapelForm(f => {
                            const updated = { ...f, tingkat: val };
                            updated.kode = generateKodeMapel(updated);
                            return updated;
                          });
                          setIsFormDirty(true);
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                      >
                        <option value="X">X</option>
                        <option value="XI">XI</option>
                        <option value="XII">XII</option>
                      </select>
                    </div>

                    {/* Kode Mapel */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Kode Mapel:</label>
                      <input 
                        type="text"
                        value={mapelForm.kode}
                        onChange={e => {
                          setMapelForm(f => ({ ...f, kode: e.target.value }));
                          setIsFormDirty(true);
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                      />
                      <p className="text-xs font-bold text-slate-400">(otomatis, bisa diedit)</p>
                    </div>
                  </div>
                )}

                {/* GURU JADWAL FORM (NEW FLOW) */}
                {activeModal === 'guru_jadwal' && (
                  <div className="space-y-8">
                    {/* SECTION 1: PILIH GURU */}
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
                      <h4 className="text-sm font-black text-slate-800 tracking-widest uppercase">Pilih Guru</h4>
                      <div className="relative z-50">
                        <SearchableDropdown
                          value={guruJadwalForm.guruId}
                          onChange={(val) => {
                            const teacher = allTeachers.find(t => String(t.id) === String(val));
                            setGuruJadwalForm(f => ({
                              ...f,
                              guruId: val,
                              nip: resolveNip(teacher) || '-',
                              mapelId: teacher?.mapel?.[0] || ''
                            }));
                            setIsFormDirty(true);
                          }}
                          options={allTeachers.map(t => ({
                            value: t.id,
                            label: `${t.name || t.full_name} - NIP: ${resolveNip(t) || '-'}`
                          }))}
                          placeholder="[ Cari Nama Guru atau NIP... ]"
                          searchPlaceholder="Cari nama guru..."
                          themeColor="#1e293b"
                        />
                      </div>
                      {guruJadwalForm.guruId && (
                        <div className="p-3 bg-white border border-slate-200 rounded-xl">
                          <p className="text-xs font-bold text-slate-600">
                            Hasil: [ {allTeachers.find(t => String(t.id) === String(guruJadwalForm.guruId))?.name || 'Guru'} - NIP: {guruJadwalForm.nip} ]
                          </p>
                        </div>
                      )}
                      {!guruJadwalForm.guruId && (
                        <p className="text-xs font-bold text-slate-400 italic">Pilih guru untuk menampilkan form jadwal.</p>
                      )}
                    </div>

                    {/* FORM JADWAL - langsung muncul saat guru dipilih */}
                    {guruJadwalForm.guruId && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        {/* HARI & SESI */}
                        <div className="p-6 bg-white border border-slate-200 rounded-3xl space-y-5">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-5 h-5 text-slate-600" />
                            <h4 className="text-sm font-black text-slate-800 tracking-widest uppercase">Hari & Sesi</h4>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Hari</label>
                              <select 
                                value={guruJadwalForm.hari}
                                onChange={e => {
                                  const newHari = e.target.value;
                                  setGuruJadwalForm(f => ({
                                    ...f, 
                                    hari: newHari,
                                    sesi: (newHari === 'Sabtu' && f.sesi === 'afternoon') ? 'morning' : f.sesi
                                  }));
                                  setIsFormDirty(true);
                                }}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                              >
                                <option value="">[ Pilih Hari ]</option>
                                {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map(h => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Sesi</label>
                              <select 
                                value={guruJadwalForm.sesi}
                                onChange={e => { 
                                  const newSesi = e.target.value;
                                  setGuruJadwalForm(f => ({...f, sesi: newSesi})); 
                                  setIsFormDirty(true); 
                                }}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                              >
                                <option value="">[ Pilih Sesi ]</option>
                                <option value="morning">Morning</option>
                                <option value="afternoon" disabled={guruJadwalForm.hari === 'Sabtu'}>Afternoon {guruJadwalForm.hari === 'Sabtu' ? '(Sabtu hanya Morning)' : ''}</option>
                              </select>
                            </div>
                          </div>
                          {guruJadwalForm.hari === 'Jumat' && (
                            <div className="flex flex-col gap-1 text-sky-700 bg-sky-50 p-4 rounded-xl border border-sky-100">
                              <p className="text-xs font-black flex items-center gap-2"><Info className="w-4 h-4 text-sky-600 inline shrink-0" /> Catatan sesi Jumat:</p>
                              <ul className="text-[11px] list-disc ml-6 font-bold space-y-1">
                                <li>Morning: 07.30 - 11.30</li>
                                <li>Afternoon: 13.00 - 17.00</li>
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* JENIS JADWAL */}
                        <div className="p-6 bg-white border border-slate-200 rounded-3xl space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <ClipboardList className="w-5 h-5 text-slate-600" />
                            <h4 className="text-sm font-black text-slate-800 tracking-widest uppercase">Jenis Jadwal</h4>
                          </div>
                          <div className="flex flex-col gap-3">
                            {[
                              { id: 'reguler', label: 'Reguler', desc: '(mengikuti slot jam standar)' },
                              { id: 'produktif', label: 'Produktif', desc: '(durasi panjang, untuk praktik jurusan)' },
                              { id: 'manual', label: 'Manual', desc: '(input jam bebas)' }
                            ].map(jenis => (
                              <label key={jenis.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                <input 
                                  type="radio" 
                                  name="jenisJadwal"
                                  value={jenis.id}
                                  checked={guruJadwalForm.jenisJadwal === jenis.id}
                                  onChange={e => { setGuruJadwalForm(f => ({...f, jenisJadwal: e.target.value, slotWaktu: '', jamMulai: '', jamSelesai: ''})); setIsFormDirty(true); }}
                                  className="w-4 h-4 text-slate-800 focus:ring-slate-800"
                                />
                                <span className="text-sm font-bold text-slate-800 w-24">{jenis.label}</span>
                                <span className="text-xs text-slate-500">{jenis.desc}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* KELAS & JURUSAN */}
                        <div className="p-6 bg-white border border-slate-200 rounded-3xl space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <School className="w-5 h-5 text-slate-600" />
                            <h4 className="text-sm font-black text-slate-800 tracking-widest uppercase">Kelas & Jurusan</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Kelas</label>
                              <select 
                                value={guruJadwalForm.kelasId}
                                onChange={e => { 
                                  const kId = e.target.value;
                                  const selectedKelas = masterData.kelas.find(k => String(k.id) === String(kId));
                                  setGuruJadwalForm(f => ({
                                    ...f, 
                                    kelasId: kId,
                                    jurusan: selectedKelas?.jurusan || '',
                                    mapelId: '' // reset mapel saat kelas berubah
                                  })); 
                                  setIsFormDirty(true); 
                                }}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                              >
                                <option value="">[ Pilih Kelas ]</option>
                                {masterData.kelas.map(k => (
                                  <option key={k.id} value={k.id}>
                                    {k.nama || `${k.tingkat} ${k.jurusan} ${k.nomorKelas}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Jurusan</label>
                              <input 
                                type="text"
                                readOnly
                                value={guruJadwalForm.jurusan ? `[ ${guruJadwalForm.jurusan} ]` : '(otomatis terisi berdasarkan kelas)'}
                                className="w-full p-4 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-500 text-sm cursor-not-allowed outline-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Ruangan <span className="text-slate-300 font-normal normal-case">(opsional)</span></label>
                              <input 
                                type="text"
                                placeholder="Misal: Lab TKJ 1"
                                value={guruJadwalForm.ruangan}
                                onChange={e => { setGuruJadwalForm(f => ({...f, ruangan: e.target.value})); setIsFormDirty(true); }}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Mata Pelajaran</label>
                              <select 
                                value={guruJadwalForm.mapelId}
                                onChange={e => { setGuruJadwalForm(f => ({...f, mapelId: e.target.value})); setIsFormDirty(true); }}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                              >
                                <option value="">[ Pilih Mapel ]</option>
                                {(() => {
                                   // Jika kelas sudah dipilih, filter mapel berdasarkan jurusan & tingkat kelas
                                   const selectedKelas = masterData.kelas.find(k => String(k.id) === String(guruJadwalForm.kelasId));
                                   if (selectedKelas) {
                                     const kelasTingkat = selectedKelas.tingkat || '';
                                     const kelasJurusan = selectedKelas.jurusan || '';
                                     const filtered = (masterData.mapel || []).filter(m => {
                                       const matchTingkat = !m.tingkat || m.tingkat === kelasTingkat;
                                       const matchJurusan = !m.jurusan || m.jurusan === 'Umum' || m.jurusan === kelasJurusan;
                                       return matchTingkat && matchJurusan;
                                     });
                                     if (filtered.length === 0) {
                                       return [<option key="empty" disabled value="">-- Belum ada mapel untuk kelas ini --</option>];
                                     }
                                     return filtered.map(m => (
                                       <option key={m.id} value={m.id}>{m.nama} {m.kode ? `(${m.kode})` : ''}</option>
                                     ));
                                   }
                                   // Fallback: tampilkan semua mapel jika kelas belum dipilih
                                   return (masterData.mapel || []).map(m => (
                                     <option key={m.id} value={m.id}>{m.nama} {m.kode ? `(${m.kode})` : ''}</option>
                                   ));
                                })()}
                              </select>
                              {guruJadwalForm.kelasId && (() => {
                                const selectedKelas = masterData.kelas.find(k => String(k.id) === String(guruJadwalForm.kelasId));
                                if (selectedKelas) {
                                  return (
                                    <p className="text-[10px] font-bold text-slate-400">
                                      Menampilkan mapel untuk: <span className="text-slate-600">{selectedKelas.tingkat} {selectedKelas.jurusan}</span> + Umum
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* WAKTU MENGAJAR */}
                        <div className="p-6 bg-white border border-slate-200 rounded-3xl space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-slate-600" />
                            <h4 className="text-sm font-black text-slate-800 tracking-widest uppercase">
                              Waktu Mengajar {guruJadwalForm.jenisJadwal ? `(${guruJadwalForm.jenisJadwal.charAt(0).toUpperCase() + guruJadwalForm.jenisJadwal.slice(1)})` : ''}
                            </h4>
                          </div>

                          {!guruJadwalForm.jenisJadwal ? (
                            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                              <p className="text-xs font-bold text-slate-400">Pilih Jenis Jadwal terlebih dahulu</p>
                            </div>
                          ) : guruJadwalForm.jenisJadwal === 'manual' ? (
                            <div className="space-y-5 bg-slate-50 p-6 rounded-xl border border-slate-200">
                              <div className="flex gap-4">
                                <div className="space-y-2 flex-1">
                                  <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Jam Mulai</label>
                                  <input 
                                    type="time"
                                    value={guruJadwalForm.jamMulai}
                                    onChange={e => { setGuruJadwalForm(f => ({...f, jamMulai: e.target.value})); setIsFormDirty(true); }}
                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                                  />
                                </div>
                                <div className="space-y-2 flex-1">
                                  <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Jam Selesai</label>
                                  <input 
                                    type="time"
                                    value={guruJadwalForm.jamSelesai}
                                    onChange={e => { setGuruJadwalForm(f => ({...f, jamSelesai: e.target.value})); setIsFormDirty(true); }}
                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
                                  />
                                </div>
                              </div>
                              <div className="pt-2">
                                <p className="text-sm font-bold text-slate-700">Durasi: <span className="text-slate-500">{(guruJadwalForm.jamMulai && guruJadwalForm.jamSelesai) ? (() => {
                                  const m1 = guruJadwalForm.jamMulai.split(':');
                                  const m2 = guruJadwalForm.jamSelesai.split(':');
                                  const diff = (parseInt(m2[0])*60 + parseInt(m2[1])) - (parseInt(m1[0])*60 + parseInt(m1[1]));
                                  if(diff <= 0) return 'Tidak valid';
                                  const h = Math.floor(diff/60);
                                  const m = diff%60;
                                  return `${h > 0 ? h + ' jam ' : ''}${m > 0 ? m + ' menit' : ''}`;
                                })() : '... (otomatis)'}</span></p>
                              </div>
                              <div className="flex gap-2 items-center text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100 mt-2">
                                <span>⚠️</span>
                                <p className="text-xs font-bold">Pastikan jam tidak bentrok dengan jadwal lain guru ini.</p>
                              </div>
                            </div>
                          ) : !guruJadwalForm.sesi ? (
                            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                              <p className="text-xs font-bold text-slate-400">Pilih Sesi (Morning/Afternoon) terlebih dahulu</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase ml-1">
                                {guruJadwalForm.jenisJadwal === 'produktif' ? 'Pilih Slot Produktif:' : 'Pilih Slot:'}
                              </label>
                              <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden flex flex-col divide-y divide-slate-100">
                                {guruJadwalForm.jenisJadwal === 'reguler' && [
                                  { id: 'R1', time: '07.30 - 08.30', label: 'Pagi 1', sesi: 'morning' },
                                  { id: 'R2', time: '08.30 - 09.30', label: 'Pagi 2', sesi: 'morning' },
                                  { id: 'R3', time: '09.30 - 10.00', label: 'Istirahat', disabled: true, sesi: 'morning' },
                                  { id: 'R4', time: '10.00 - 11.00', label: 'Pagi 3', sesi: 'morning' },
                                  { id: 'R10', time: '11.00 - 12.00', label: 'Pagi 4', sesi: 'morning' },
                                  { id: 'R11', time: '12.00 - 13.00', label: 'Pagi 5', sesi: 'morning' },
                                  { id: 'R5', time: '11.00 - 11.30', label: 'Pagi 4 - khusus Jumat', sesi: 'morning' },
                                  { id: 'R6', time: '13.00 - 14.00', label: 'Sore 1', sesi: 'afternoon' },
                                  { id: 'R7', time: '14.00 - 15.00', label: 'Sore 2', sesi: 'afternoon' },
                                  { id: 'R8', time: '15.00 - 15.30', label: 'Istirahat Sore', disabled: true, sesi: 'afternoon' },
                                  { id: 'R9', time: '15.30 - 16.30', label: 'Sore 3', sesi: 'afternoon' }
                                ]
                                .filter(slot => slot.sesi === guruJadwalForm.sesi)
                                .map((slot) => (
                                  <label 
                                    key={slot.id} 
                                    className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${slot.disabled ? 'opacity-50 bg-slate-100 cursor-not-allowed' : 'hover:bg-slate-100'} ${guruJadwalForm.slotWaktu === slot.id ? 'bg-blue-50/50' : ''}`}
                                  >
                                    <div className="flex-shrink-0">
                                      <input 
                                        type="radio" 
                                        name="slotWaktu"
                                        value={slot.id}
                                        checked={guruJadwalForm.slotWaktu === slot.id}
                                        onChange={() => { if(!slot.disabled) { setGuruJadwalForm(f => ({...f, slotWaktu: slot.id})); setIsFormDirty(true); } }}
                                        disabled={slot.disabled}
                                        className="w-4 h-4 text-slate-800 focus:ring-slate-800 cursor-pointer"
                                      />
                                    </div>
                                    <div className="flex-1 text-sm">
                                      <span className="font-bold text-slate-800">{slot.time}</span>
                                      <span className="text-slate-500 ml-2">({slot.label})</span>
                                      {slot.disabled && <span className="ml-2 text-xs font-bold text-red-500 uppercase tracking-wider">- TIDAK TERSEDIA</span>}
                                    </div>
                                  </label>
                                ))}
                                {guruJadwalForm.jenisJadwal === 'produktif' && [
                                  { id: 'P1', time: '10.00 - 12.00', label: 'Praktik 1 - 120 menit', sesi: 'morning' },
                                  { id: 'P2', time: '13.00 - 15.00', label: 'Praktik 2 - 120 menit', sesi: 'afternoon' },
                                  { id: 'P3', time: '15.00 - 17.00', label: 'Praktik 3 - 120 menit - khusus Jumat', sesi: 'afternoon' }
                                ]
                                .filter(slot => slot.sesi === guruJadwalForm.sesi)
                                .map((slot) => (
                                  <label 
                                    key={slot.id} 
                                    className={`flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-slate-100 ${guruJadwalForm.slotWaktu === slot.id ? 'bg-blue-50/50' : ''}`}
                                  >
                                    <div className="flex-shrink-0">
                                      <input 
                                        type="radio" 
                                        name="slotWaktu"
                                        value={slot.id}
                                        checked={guruJadwalForm.slotWaktu === slot.id}
                                        onChange={() => { setGuruJadwalForm(f => ({...f, slotWaktu: slot.id})); setIsFormDirty(true); }}
                                        className="w-4 h-4 text-slate-800 focus:ring-slate-800 cursor-pointer"
                                      />
                                    </div>
                                    <div className="flex-1 text-sm">
                                      <span className="font-bold text-slate-800">{slot.time}</span>
                                      <span className="text-slate-500 ml-2">({slot.label})</span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>


                      </motion.div>
                    )}
                  </div>
                )}

                {/* MAGANG FORM */}
                {activeModal === 'magang' && (
                  <div className="space-y-6">
                    {/* PILIH KEGIATAN */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Kegiatan Dahulu <span className="text-rose-500">*</span></label>
                      <select
                        value={magangForm.tipeKegiatan}
                        onChange={e => {
                          const nextType = e.target.value;
                          setMagangForm({ ...INITIAL_MAGANG_FORM, tipeKegiatan: nextType });
                          setSearchStudentMagang('');
                          setMagangClassStudents([]);
                          setAlertMsg(null);
                          setIsFormDirty(true);
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:bg-white transition-all outline-none"
                        style={{ '--tw-ring-color': `${COLORS.cyanDark}20`, '--tw-border-color-focus': COLORS.cyanDark }}
                        onFocus={e => { e.target.style.borderColor = COLORS.cyanDark; e.target.style.boxShadow = `0 0 0 4px ${COLORS.cyanDark}20`; }}
                        onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}
                      >
                        <option value="">— Silahkan pilih jenis kegiatan —</option>
                        <option value="perlombaan">Perlombaan</option>
                        <option value="pertukaran_siswa">Pertukaran Siswa/i</option>
                        <option value="study_tour">Study Tour</option>
                        <option value="ekstrakurikuler">Ekstrakurikuler</option>
                      </select>
                    </div>

                    {magangForm.tipeKegiatan && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                          {magangForm.tipeKegiatan === 'perlombaan' && (
                            <>
                              <FormInput required label="Nama Kegiatan" placeholder="Misal: Lomba Kompetensi Siswa" themeColor={COLORS.cyanDark} value={magangForm.namaKegiatan} onChange={e => setMagangForm(f => ({ ...f, namaKegiatan: e.target.value }))} />
                              <FormInput required label="Tempat Perlombaan" placeholder="Misal: GOR Unimed" themeColor={COLORS.cyanDark} value={magangForm.tempatPerlombaan} onChange={e => setMagangForm(f => ({ ...f, tempatPerlombaan: e.target.value }))} />
                              <div className="space-y-3">
                                <RequiredLabel>Pilih Murid</RequiredLabel>
                                <StudentPillPicker students={studentsList} selectedStudents={magangForm.peserta} excludedStudentIds={occupiedActivityStudentIds} search={searchStudentMagang} onSearchChange={setSearchStudentMagang} onSelect={addActivityStudent} onRemove={removeActivityStudent} />
                              </div>
                              <FormInput required label="Waktu Diadakan" type="date" themeColor={COLORS.cyanDark} value={magangForm.waktuDiadakan} onChange={e => setMagangForm(f => ({ ...f, waktuDiadakan: e.target.value }))} />
                              <FormInput label="Jam Mulai" type="time" themeColor={COLORS.cyanDark} value={magangForm.jamMulai} onChange={e => setMagangForm(f => ({ ...f, jamMulai: e.target.value }))} />
                              <FormInput label="Jam Selesai" type="time" themeColor={COLORS.cyanDark} value={magangForm.jamSelesai} onChange={e => setMagangForm(f => ({ ...f, jamSelesai: e.target.value }))} />
                            </>
                          )}

                          {magangForm.tipeKegiatan === 'pertukaran_siswa' && (
                            <>
                              <div className="md:col-span-2">
                                <FormInput required label="Nama Sekolah Tujuan" placeholder="Misal: SMA Negeri 1 Jakarta" themeColor={COLORS.cyanDark} value={magangForm.namaSekolahTujuan} onChange={e => setMagangForm(f => ({ ...f, namaSekolahTujuan: e.target.value }))} />
                              </div>

                              <div className="space-y-3">
                                <RequiredLabel>Provinsi</RequiredLabel>
                                <select value={magangForm.provinsi} onChange={e => setMagangForm(f => ({ ...f, provinsi: e.target.value, kota: '' }))} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:bg-white transition-all outline-none" style={{ '--tw-ring-color': `${COLORS.cyanDark}20`, '--tw-border-color-focus': COLORS.cyanDark }} onFocus={e => { e.target.style.borderColor = COLORS.cyanDark; e.target.style.boxShadow = `0 0 0 4px ${COLORS.cyanDark}20`; }} onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}>
                                  <option value="">— Pilih provinsi —</option>
                                  {Object.keys(INDONESIA_REGIONS).sort((a, b) => a.localeCompare(b, 'id')).map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                              </div>
                              <div className="space-y-3">
                                <RequiredLabel>Kabupaten/Kota</RequiredLabel>
                                <select value={magangForm.kota} onChange={e => setMagangForm(f => ({ ...f, kota: e.target.value }))} disabled={!magangForm.provinsi} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:bg-white transition-all outline-none" style={{ '--tw-ring-color': `${COLORS.cyanDark}20`, '--tw-border-color-focus': COLORS.cyanDark }} onFocus={e => { e.target.style.borderColor = COLORS.cyanDark; e.target.style.boxShadow = `0 0 0 4px ${COLORS.cyanDark}20`; }} onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}>
                                  <option value="">— Pilih kota —</option>
                                  {magangForm.provinsi && [...INDONESIA_REGIONS[magangForm.provinsi]].sort((a, b) => a.localeCompare(b, 'id')).map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                              </div>
                              <FormInput required label="Tanggal Mulai" type="date" themeColor={COLORS.cyanDark} value={magangForm.tanggalMulai} onChange={e => setMagangForm(f => ({ ...f, tanggalMulai: e.target.value }))} />
                              <FormInput required label="Tanggal Berakhir" type="date" themeColor={COLORS.cyanDark} value={magangForm.tanggalBerakhir} onChange={e => setMagangForm(f => ({ ...f, tanggalBerakhir: e.target.value }))} />
                            </>
                          )}

                          {magangForm.tipeKegiatan === 'ekstrakurikuler' && (
                            <>
                              <FormInput required label="Nama Ekstrakurikuler" placeholder="Misal: Pramuka, OSIS, Basket" themeColor={COLORS.cyanDark} value={magangForm.namaKegiatan} onChange={e => setMagangForm(f => ({ ...f, namaKegiatan: e.target.value }))} />
                              <div className="space-y-3">
                                <RequiredLabel>Pembina</RequiredLabel>
                                <div className="relative" style={{ zIndex: 60 }}>
                                  <SearchableDropdown
                                    value={magangForm.guruPembimbing}
                                    onChange={val => { setMagangForm(f => ({ ...f, guruPembimbing: val })); setIsFormDirty(true); }}
                                    options={allTeachers.map(t => ({
                                      value: t.id,
                                      label: `${t.name || t.full_name || 'Tanpa Nama'} (${resolveNip(t) || '-'})`
                                    }))}
                                    placeholder="-- Silahkan pilih guru --"
                                    searchPlaceholder="Cari nama atau NIP guru..."
                                    themeColor={COLORS.cyanDark}
                                  />
                                </div>
                              </div>
                              <FormInput required label="Waktu Diadakan" type="date" themeColor={COLORS.cyanDark} value={magangForm.waktuDiadakan} onChange={e => setMagangForm(f => ({ ...f, waktuDiadakan: e.target.value }))} />
                              <div className="space-y-3">
                                <RequiredLabel>Pilih Murid</RequiredLabel>
                                <StudentPillPicker students={studentsList} selectedStudents={magangForm.peserta} excludedStudentIds={occupiedActivityStudentIds} search={searchStudentMagang} onSearchChange={setSearchStudentMagang} onSelect={addActivityStudent} onRemove={removeActivityStudent} />
                              </div>
                            </>
                          )}

                          {magangForm.tipeKegiatan === 'study_tour' && (
                            <>
                              <div className="space-y-3">
                                <RequiredLabel>Pilih Murid</RequiredLabel>
                                <StudentPillPicker students={studentsList} selectedStudents={magangForm.peserta} excludedStudentIds={occupiedActivityStudentIds} search={searchStudentMagang} onSearchChange={setSearchStudentMagang} onSelect={addActivityStudent} onRemove={removeActivityStudent} />
                              </div>
                              <div className="space-y-3">
                                <RequiredLabel>Guru Penanggung Jawab</RequiredLabel>
                                <div className="relative" style={{ zIndex: 60 }}>
                                  <SearchableDropdown
                                    value={magangForm.guruPenanggungJawab}
                                    onChange={val => { setMagangForm(f => ({ ...f, guruPenanggungJawab: val })); setIsFormDirty(true); }}
                                    options={allTeachers.map(t => ({
                                      value: t.id,
                                      label: `${t.name || t.full_name || 'Tanpa Nama'} (${resolveNip(t) || '-'})`
                                    }))}
                                    placeholder="-- Silahkan pilih guru --"
                                    searchPlaceholder="Cari nama atau NIP guru..."
                                    themeColor={COLORS.cyanDark}
                                  />
                                </div>
                              </div>
                              <div className="space-y-3">
                                <RequiredLabel>Status Pembayaran</RequiredLabel>
                                <select value={magangForm.statusPembayaranInput} onChange={e => setActivityPaymentStatus(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:bg-white transition-all outline-none" style={{ '--tw-ring-color': `${COLORS.cyanDark}20`, '--tw-border-color-focus': COLORS.cyanDark }} onFocus={e => { e.target.style.borderColor = COLORS.cyanDark; e.target.style.boxShadow = `0 0 0 4px ${COLORS.cyanDark}20`; }} onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}>
                                  <option value="">— Silahkan pilih —</option>
                                  <option value="Belum bayar">Belum bayar</option>
                                  <option value="Cicil">Cicil</option>
                                  <option value="Lunas">Lunas</option>
                                </select>
                              </div>
                              <div className="space-y-3">
                                <RequiredLabel>Status ACC</RequiredLabel>
                                <select value={magangForm.statusAcc} onChange={e => setMagangForm(f => ({ ...f, statusAcc: e.target.value }))} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:bg-white transition-all outline-none" style={{ '--tw-ring-color': `${COLORS.cyanDark}20`, '--tw-border-color-focus': COLORS.cyanDark }} onFocus={e => { e.target.style.borderColor = COLORS.cyanDark; e.target.style.boxShadow = `0 0 0 4px ${COLORS.cyanDark}20`; }} onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}>
                                  <option value="">— Silahkan pilih —</option>
                                  <option value="disetujui">Disetujui</option>
                                  <option value="ditolak">Ditolak</option>
                                </select>
                              </div>
                              <div className="space-y-3">
                                <RequiredLabel>Tujuan Negara</RequiredLabel>
                                <SearchableDropdown value={magangForm.tujuanNegara} onChange={value => { setMagangForm(form => ({ ...form, tujuanNegara: value, tujuanNegaraLainnya: value === 'Lainnya' ? form.tujuanNegaraLainnya : '' })); setIsFormDirty(true); }} options={COUNTRIES.map(country => ({ value: country, label: country }))} placeholder="Pilih negara tujuan" searchPlaceholder="Cari negara..." themeColor={COLORS.cyanDark} />
                              </div>
                              {magangForm.tujuanNegara === 'Lainnya' && <FormInput required label="Masukkan Nama Negara" placeholder="Nama negara (huruf saja)" themeColor={COLORS.cyanDark} value={magangForm.tujuanNegaraLainnya} onChange={e => setMagangForm(form => ({ ...form, tujuanNegaraLainnya: e.target.value.replace(/[^\p{L}\s]/gu, '') }))} />}
                              <FormInput required label="Masukkan Nama Kota" placeholder="Misal: Kyoto" themeColor={COLORS.cyanDark} value={magangForm.namaKota} onChange={e => setMagangForm(f => ({ ...f, namaKota: e.target.value }))} />
                              <div className="md:col-span-2">
                                <FormInput label="Masukkan Tujuan" placeholder="Misal: Kunjungan Museum" themeColor={COLORS.cyanDark} value={magangForm.tujuan} onChange={e => setMagangForm(f => ({ ...f, tujuan: e.target.value }))} />
                              </div>
                            </>
                          )}
                        </div>

                        {(magangForm.tipeKegiatan === 'pertukaran_siswa') && (
                          <>
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                                <div className="space-y-3">
                                  <RequiredLabel>Pembayaran</RequiredLabel>
                                  <select value={magangForm.statusPembayaranInput} onChange={e => setActivityPaymentStatus(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
                                    <option value="">— Pilih status —</option>
                                    <option value="Belum bayar">Belum bayar</option>
                                    <option value="Cicil">Cicil</option>
                                    <option value="Lunas">Lunas</option>
                                  </select>
                                </div>
                                <div className="space-y-3">
                                  <RequiredLabel>Pilih Murid</RequiredLabel>
                                  <StudentPillPicker students={activityStudentOptions} selectedStudents={magangForm.peserta} excludedStudentIds={occupiedActivityStudentIds} search={searchStudentMagang} onSearchChange={setSearchStudentMagang} onSelect={addActivityStudent} onRemove={removeActivityStudent} />
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                          <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Daftar Murid Terdaftar</h4>
                            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-black text-white">{magangForm.peserta.length}</span>
                          </div>
                          {magangForm.peserta.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {magangForm.peserta.map(student => (
                                <span key={student.id} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
                                  <span>{student.name || student.full_name || 'Murid'} <span className="text-slate-400">({studentNisn(student) || student.nisn || '-'})</span></span>
                                  <button type="button" aria-label={`Keluarkan ${student.name || 'murid'}`} onClick={() => removeActivityStudent(student.id)} className="rounded-full bg-slate-100 p-1 text-slate-500 transition hover:bg-rose-500 hover:text-white active:bg-rose-600"><X size={13} strokeWidth={2.8} /></button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-semibold italic text-slate-400">Belum ada murid terdaftar.</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* â”€â”€ KURIKULUM FORM â”€â”€ */}
                {activeModal === 'kurikulum' && (
                  <div className="space-y-8">
                    {/* Setting Kurikulum Aktif */}
                    <div className="p-6 bg-white border border-slate-200 rounded-3xl space-y-4">
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-violet-600" /> Setting Kurikulum Aktif
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Kurikulum</label>
                          <input type="text" value={kurikulumForm.namaKurikulum}
                            onChange={e => { setKurikulumForm(f => ({...f, namaKurikulum: e.target.value})); setIsFormDirty(true); }}
                            placeholder="Cth: Kurikulum Merdeka 2024"
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-violet-300 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tahun Ajaran</label>
                          <input type="text" value={kurikulumForm.tahunAjaran}
                            onChange={e => { setKurikulumForm(f => ({...f, tahunAjaran: e.target.value})); setIsFormDirty(true); }}
                            placeholder="Cth: 2024/2025"
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-violet-300 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tingkat Kelas</label>
                          <select value={kurikulumForm.tingkat}
                            onChange={e => { setKurikulumForm(f => ({...f, tingkat: e.target.value})); setIsFormDirty(true); }}
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-violet-300 outline-none">
                            {['X','XI','XII'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                          <select value={kurikulumForm.statusAktif ? 'aktif' : 'nonaktif'}
                            onChange={e => { setKurikulumForm(f => ({...f, statusAktif: e.target.value === 'aktif'})); setIsFormDirty(true); }}
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-violet-300 outline-none">
                            <option value="aktif">Aktif</option>
                            <option value="nonaktif">Nonaktif</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Upload Dokumen */}
                    <div className="p-6 bg-white border border-slate-200 rounded-3xl space-y-4">
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <Info className="w-4 h-4 text-violet-600" /> Upload Dokumen Kurikulum
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mata Pelajaran</label>
                          <select value={dokumenForm.subjectId}
                            onChange={e => { setDokumenForm(f => ({...f, subjectId: e.target.value})); setIsFormDirty(true); }}
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none">
                            <option value="">— Pilih Mapel —</option>
                            {(masterData.mapel || []).map(m => <option key={m.id} value={m.dbId || m.id}>{m.nama}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jurusan</label>
                          <select value={dokumenForm.jurusanId}
                            onChange={e => { setDokumenForm(f => ({...f, jurusanId: e.target.value})); setIsFormDirty(true); }}
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none">
                            <option value="">— Semua Jurusan —</option>
                            {(masterData.jurusan || []).map(j => <option key={j.id} value={j.dbId || j.id}>{j.nama}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipe Dokumen</label>
                          <select value={dokumenForm.tipeDoc}
                            onChange={e => { setDokumenForm(f => ({...f, tipeDoc: e.target.value})); setIsFormDirty(true); }}
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none">
                            <option value="cp">Capaian Pembelajaran</option>
                            <option value="atp">Alur Tujuan Pembelajaran</option>
                            <option value="silabus">Silabus / Dokumen Kurikulum</option>
                            <option value="modul">Modul Ajar</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Judul Dokumen <span className="text-red-400">*</span></label>
                          <input type="text" value={dokumenForm.judulDoc}
                            onChange={e => { setDokumenForm(f => ({...f, judulDoc: e.target.value})); setIsFormDirty(true); }}
                            placeholder="Cth: CP Matematika Kelas X TKJ"
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-violet-300 outline-none" />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">File <span className="text-slate-300 font-normal">.pdf / .doc / .docx — maks. 10 MB</span></label>
                          <input id="kurikulum-file-input" ref={dokumenInputRef} type="file" accept=".pdf,.doc,.docx" className="sr-only"
                            onChange={e => { setDokumenForm(f => ({...f, file: e.target.files?.[0] || null})); setIsFormDirty(true); }} />
                          <label htmlFor="kurikulum-file-input" className={`group flex min-h-24 cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-4 transition-all ${dokumenForm.file ? 'border-violet-300 bg-violet-50/70' : 'border-slate-300 bg-slate-50 hover:border-violet-400 hover:bg-violet-50/60'}`}>
                            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${dokumenForm.file ? 'bg-violet-600 text-white' : 'bg-white text-violet-500 shadow-sm group-hover:bg-violet-600 group-hover:text-white'}`}>
                              <FileSpreadsheet className="h-5 w-5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black text-slate-700">{dokumenForm.file?.name || existingCurriculumFile?.name || 'Pilih dokumen kurikulum'}</span>
                              <span className="mt-1 block text-[10px] font-bold text-slate-400">{dokumenForm.file ? `${(dokumenForm.file.size / 1024 / 1024).toFixed(2)} MB · File pengganti dipilih` : existingCurriculumFile ? `${(existingCurriculumFile.size / 1024 / 1024).toFixed(2)} MB · File saat ini · Klik untuk mengganti` : 'PDF, DOC, atau DOCX · maksimum 10 MB'}</span>
                            </span>
                            <span className="ml-auto shrink-0 rounded-lg bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-violet-600 shadow-sm">Pilih File</span>
                          </label>
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catatan</label>
                          <textarea value={dokumenForm.catatan} rows={2}
                            onChange={e => { setDokumenForm(f => ({...f, catatan: e.target.value})); setIsFormDirty(true); }}
                            placeholder="Catatan tambahan (opsional)"
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm resize-none focus:ring-2 focus:ring-violet-300 outline-none" />
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* FOOTER */}
              {!['struktur', 'kbm'].includes(activeModal) && <div
                className={`px-10 py-6 border-t border-slate-100 flex gap-3 ${['kurikulum', 'magang'].includes(activeModal) ? 'justify-stretch' : 'justify-end'}`}
                style={{ backgroundColor: modalBg(activeModal) }}
              >
                {!['kurikulum', 'magang'].includes(activeModal) && <button
                    onClick={closeModal}
                    className="px-6 py-3 text-slate-400 hover:text-slate-900 font-bold uppercase tracking-widest text-[10px] transition-colors"
                  >
                    Batal
                  </button>}
                <button
                  onClick={executeSimpan}
                  disabled={(isSaving || !isFormDirty) && savePhase !== 'done'}
                  className={`${['kurikulum', 'magang'].includes(activeModal) ? 'w-full justify-center rounded-2xl py-4' : 'px-10 py-3.5 rounded-xl'} text-white font-black uppercase tracking-widest text-[11px] transition-all duration-300 flex items-center gap-2 overflow-hidden relative ${((isSaving || !isFormDirty) && savePhase !== 'done')
                      ? ['kurikulum', 'magang'].includes(activeModal) ? 'opacity-60 cursor-wait' : 'opacity-40 cursor-not-allowed grayscale bg-slate-400'
                      : savePhase === 'done' ? 'scale-105' : 'shadow-xl active:scale-95'
                    }`}
                  style={activeModal === 'kurikulum' ? {
                    backgroundColor: '#7c3aed',
                    boxShadow: '0 20px 25px -5px rgba(124, 58, 237, 0.25)',
                  } : {
                    backgroundColor:
                      activeModal === 'jurusan' ? COLORS.purpleDark :
                        activeModal === 'kelas' ? COLORS.blueDark :
                          activeModal === 'mapel' ? COLORS.greenDark :
                            activeModal === 'guru' ? COLORS.orangeDark :
                              activeModal === 'guru_jadwal' ? COLORS.orangeDark :
                                activeModal === 'jadwal' ? COLORS.pinkMaroon :
                                  activeModal === 'magang' ? COLORS.cyanDark : '#7c3aed',
                    boxShadow: `0 20px 25px -5px ${activeModal === 'jurusan' ? COLORS.purpleDark :
                        activeModal === 'kelas' ? COLORS.blueDark :
                          activeModal === 'mapel' ? COLORS.greenDark :
                            activeModal === 'guru' ? COLORS.orangeDark :
                              activeModal === 'guru_jadwal' ? COLORS.orangeDark :
                                activeModal === 'jadwal' ? COLORS.pinkMaroon :
                                  activeModal === 'magang' ? COLORS.cyanDark : '#0f172a'
                      }40`
                  }}
                >
                  <AnimatePresence mode="wait">
                    {savePhase === 'done' ? (
                      <motion.span
                        key="done"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        TERSIMPAN!
                      </motion.span>
                    ) : savePhase === 'saving' ? (
                      <motion.span
                        key="saving"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2"
                      >
                        <SavingDataLabel />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        {activeModal === 'kurikulum' ? 'Simpan Kurikulum' : 'Simpan'}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>}
            </motion.div>
          </div>
        )}
        </AnimatePresence>,
        document.body
      )}

      {/* MODAL FASILITAS: hanya KELOLA (dropdown+form). DETAIL tampil inline seperti 4 card akademik lain. */}
      {createPortal(
        <AnimatePresence>
          {fasilitasModal && (
            <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
              >
                {/* HEADER */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between" style={{ backgroundColor: '#F1F5F9' }}>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Kelola Fasilitas</h3>
                    <p className="text-[11px] font-bold text-slate-400 tracking-widest mt-1 italic">Pilih jenis pengelolaan lalu isi formulir dinamis</p>
                  </div>
                  <ModalCloseControl onClose={() => setFasilitasModal(null)} />
                </div>

                {/* BODY + FOOTER (footer digarap internal FasilitasKelola) */}
                <div className="flex max-h-[80vh] flex-col overflow-hidden">
                  <FasilitasKelola api={operatorAPI} mode="manage" onSync={onSync} onClose={() => setFasilitasModal(null)} />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {deleteConfirm && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 12 }}
                className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 px-6 py-4">
                  <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-indigo-500/30 blur-2xl" />
                  <div className="relative flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 ring-1 ring-rose-300/30">
                      <AlertTriangle className="h-5 w-5 text-rose-300" />
                    </span>
                    <h3 className="text-lg font-black text-white">Hapus Data</h3>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm font-semibold leading-7 text-slate-600">{deleteConfirm.confirmMessage || (deleteConfirm.groupLabel ? `Anda yakin menghapus seluruh kelas pada ${deleteConfirm.groupLabel}?` : 'Anda yakin menghapus data ini?')}</p>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={async () => {
                        const { id, ids, tab } = deleteConfirm;
                        
                        // Hapus record database dahulu. Jangan kirim ulang snapshot
                        // kelas yang tersisa karena endpoint sync dapat membuat
                        // kembali row yang baru saja dihapus.
                        if (tab === 'kelas') {
                          const targetIds = (ids || [id]).map(String);
                          const targetItems = masterData.kelas.filter(item => targetIds.includes(String(item.dbId || item.id)) || targetIds.includes(String(item.id)));
                          const deletedIds = [];
                          try {
                            for (const item of targetItems) {
                              const dbId = item.dbId || (!String(item.id || '').startsWith('kls-') ? item.id : null);
                              if (dbId) await operatorAPI.deleteSchoolClass(dbId);
                              deletedIds.push(String(item.id));
                            }
                          } catch (error) {
                            if (deletedIds.length) setMasterData(prev => ({ ...prev, kelas: prev.kelas.filter(item => !deletedIds.includes(String(item.id))) }));
                            toast.error(error?.response?.data?.message || `Sebagian kelas terhapus (${deletedIds.length}/${targetItems.length}). Kelas lain masih tersimpan.`);
                            setDeleteConfirm(null);
                            triggerSync();
                            return;
                          }

                          const nextKelas = masterData.kelas.filter(item => !targetIds.includes(String(item.dbId || item.id)) && !targetIds.includes(String(item.id)));

                          // Struktur adalah satu alur. Jika kelas terakhir dari
                          // suatu jurusan dihapus, jurusan tersebut tidak boleh
                          // tertinggal sebagai pill kosong di database.
                          const jurusanCode = String(targetItems[0]?.jurusan || '').toUpperCase();
                          const stillUsed = nextKelas.some(k => String(k.jurusan || '').toUpperCase() === jurusanCode);
                          const orphanJurusan = !stillUsed
                            ? masterData.jurusan.find(j => String(j.kode || '').toUpperCase() === jurusanCode)
                            : null;
                          if (orphanJurusan?.dbId || orphanJurusan?.id) {
                            const jurusanId = orphanJurusan.dbId || orphanJurusan.id;
                            try {
                              await operatorAPI.deleteJurusan(jurusanId);
                              setMasterData(prev => ({
                                ...prev,
                                jurusan: prev.jurusan.filter(j => String(j.dbId || j.id) !== String(jurusanId)),
                              }));
                              setExistingJurusans(prev => prev.filter(j => String(j.dbId || j.id) !== String(jurusanId)));
                            } catch (error) {
                              // Jangan batalkan kelas yang sudah berhasil dihapus.
                              // Jurusan tetap terlihat agar operator tahu masih ada relasi lain.
                              console.warn('Jurusan yatim belum dapat dihapus.', error);
                            }
                          }
                        }
                        
                        // Jika mapel punya dbId, hapus dari database juga
                        if (tab === 'mapel') {
                          const item = masterData.mapel.find(x => x.id === id);
                          const dbId = item?.dbId || (!String(item?.id || '').startsWith('mpl-') ? item?.id : null);
                          if (dbId) {
                            try {
                              await operatorAPI.deleteSubject(dbId);
                            } catch (e) {
                              toast.error('Gagal menghapus mata pelajaran dari database.');
                              setDeleteConfirm(null);
                              return;
                            }
                          }
                        }
                        // Jika jadwal punya dbId, hapus dari database juga
                        if (tab === 'jadwal') {
                          const item = masterData.jadwal.find(x => x.id === id);
                          if (item?.dbId) {
                            try {
                              await adminAkademikAPI.deleteJadwalGuru(item.dbId);
                            } catch (e) {
                              toast.error(e?.response?.data?.message || 'Gagal menghapus jadwal dari database.');
                              setDeleteConfirm(null);
                              return;
                            }
                          }
                        }
                        if (tab === 'jurusan') {
                          const item = masterData.jurusan.find(x => x.id === id);
                          const dbId = item?.dbId || id;
                          if (dbId && !String(dbId).startsWith('jr-')) {
                            try {
                              await operatorAPI.deleteJurusan(dbId);
                            } catch (e) {
                              toast.error('Gagal menghapus jurusan dari database.');
                              setDeleteConfirm(null);
                              return;
                            }
                          }
                        }
                        if (tab === 'magang') {
                          const activity = masterData.magang.find(item => String(item.id) === String(id));
                          const dbId = activity?.dbId || (Number.isInteger(Number(id)) ? Number(id) : null);
                          if (dbId) {
                            try {
                              await operatorAPI.deleteAcademicActivity(dbId);
                            } catch (error) {
                              toast.error(error?.response?.data?.message || 'Gagal menghapus kegiatan dari database.');
                              setDeleteConfirm(null);
                              return;
                            }
                          }
                        }
                        if (tab === 'kurikulum') {
                          const deleted = await handleHapusDokumen(id);
                          if (deleted) {
                            setDeleteConfirm(null);
                            toast.success('Data berhasil dihapus.');
                          }
                          return;
                        }
                        setMasterData(prev => ({
                          ...prev,
                          [tab]: tab === 'kelas'
                            ? prev[tab].filter(item => !(ids || [id]).map(String).includes(String(item.dbId || item.id)) && !(ids || [id]).map(String).includes(String(item.id)))
                            : prev[tab].filter(x => x.id !== id)
                        }));
                        if (tab === 'kelas' && deleteConfirm.editorContext) {
                          const { formIndex } = deleteConfirm.editorContext;
                          if (formIndex === 0 && additionalClassForms.length > 0) {
                            const [nextPrimary, ...remainingClasses] = additionalClassForms;
                            setKelasForm(nextPrimary);
                            setAdditionalClassForms(remainingClasses);
                            setEditingItem(previous => ({ ...previous, ...nextPrimary, id: nextPrimary.id, dbId: nextPrimary.dbId, editingStructureClass: true, editingStructureGroup: true }));
                          } else if (formIndex > 0) {
                            setAdditionalClassForms(forms => forms.filter((_, index) => index !== formIndex - 1));
                          } else {
                            closeModal();
                          }
                          setClassRosterRefreshToken(value => value + 1);
                        }
                        setDeleteConfirm(null);
                        triggerSync(); // refresh semua user
                        toast.dismiss();
                        toast.success('Data berhasil dihapus.');
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-500/25 transition-all hover:brightness-110"
                    >
                      Ya, Hapus
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* TAB-SPECIFIC ARCHIVE MODAL */}
      {createPortal(
        <AnimatePresence>
          {tabArchiveModalOpen && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 border border-white/20 text-center space-y-8"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Arsipkan Data</h3>
                </div>

                <div className="flex gap-3 text-rose-500 font-bold text-[11px] leading-relaxed text-left">
                  <span className="shrink-0 text-lg">&#10003;</span>
                  <p>Peringatan! Jika Anda klik Simpan & Arsip, maka seluruh data yang ada di tab ini akan kosong dan diarsipkan. Kemudian Anda bisa melihat data kembali di tombol "ARSIP". Jika sudah mengerti, silakan lanjutkan.</p>
                </div>

                <div className="space-y-6 text-left">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Masukkan Tahun Ajaran</label>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="Contoh: 2025 / 2026"
                      value={archiveForm.tahunAjaran}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9/ ]/g, '');
                        setArchiveForm(f => ({ ...f, tahunAjaran: val }));
                      }}
                      className={`w-full p-4 bg-slate-50 border ${archiveForm.tahunAjaran && !isValidAcademicYear(archiveForm.tahunAjaran) ? 'border-rose-500' : 'border-slate-200'} rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:bg-white transition-all outline-none`}
                    />
                    {archiveForm.tahunAjaran && !isValidAcademicYear(archiveForm.tahunAjaran) && (
                      <p className="text-[9px] text-rose-500 font-bold uppercase mt-1 ml-1 tracking-wider">Format Salah! (YYYY / YYYY)</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Semester</label>
                    <select
                      value={archiveForm.semester}
                      onChange={e => setArchiveForm(f => ({ ...f, semester: e.target.value }))}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:ring-slate-900/10 focus:bg-white transition-all outline-none"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setTabArchiveModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all font-inter"
                  >
                    Batal
                  </button>
                  <button
                    disabled={!isValidAcademicYear(archiveForm.tahunAjaran)}
                    onClick={async () => {
                      const currentData = activeDetailTab === 'kurikulum'
                        ? dokumenList
                        : (masterData[activeDetailTab] || []);
                      if (currentData.length === 0) {
                        showAlert('error', 'Tidak ada data untuk diarsipkan!');
                        return;
                      }

                      if (activeDetailTab === 'magang') {
                        try {
                          await Promise.all(currentData.map(activity => operatorAPI.deleteAcademicActivity(activity.dbId || activity.id)));
                        } catch (error) {
                          const latest = await operatorAPI.getAcademicActivities().catch(() => null);
                          if (latest) setMasterData(previous => ({ ...previous, magang: latest.data?.data || [] }));
                          showAlert('error', error?.response?.data?.message || 'Kegiatan belum seluruhnya dapat dihapus dari database.');
                          return;
                        }
                      }

                      // 1. SAVE TO ARCHIVES
                      const ARCHIVE_KEY = 'school_academic_archives_v2';
                      const prevArchives = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
                      const currentTabLabel = subTabs.find(t => t.id === activeDetailTab)?.label || activeDetailTab;
                      
                      const newArchive = {
                        id: Date.now(),
                        tahunAjaran: archiveForm.tahunAjaran,
                        semester: archiveForm.semester,
                        category: currentTabLabel,
                        timestamp: new Date().toISOString(),
                        data: [...currentData]
                      };

                      localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...prevArchives, newArchive]));

                      // 2. Card Kurikulum memakai tabel database sendiri,
                      // sehingga data yang diarsipkan harus dihapus dari API
                      // juga agar tampilan dan MySQL tetap sinkron.
                      if (activeDetailTab === 'kurikulum') {
                        try {
                          await Promise.all(dokumenList.map(doc => adminAkademikAPI.deleteCurriculumDocument(doc.id)));
                          await fetchDokumen();
                        } catch (error) {
                          showAlert('error', error?.response?.data?.message || 'Dokumen belum seluruhnya dapat diarsipkan dari database.');
                          return;
                        }
                      }

                      // 3. CLEAR DATA LOKAL
                      setMasterData(prev => ({
                        ...prev,
                        [activeDetailTab]: []
                      }));

                      setTabArchiveModalOpen(false);
                      showAlert('success', `Data ${currentTabLabel} berhasil diarsipkan!`);
                    }}
                    className={`flex-1 py-4 font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all ${
                      !isValidAcademicYear(archiveForm.tahunAjaran)
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-rose-600 text-white shadow-lg shadow-rose-100 hover:bg-rose-700 active:scale-95'
                    }`}
                  >
                    Simpan & Arsipkan
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* VIEW ARCHIVE (TOP BUTTON) MODAL */}
      {createPortal(
        <AnimatePresence>
          {archiveModalOpen && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-10 border border-white/20 text-center space-y-8"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Cari Arsip Akademik</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Pilih Kategori dan Periode untuk Tampil Data</p>
                </div>

                <div className="space-y-6 text-left">
                  {/* SELECT CATEGORY */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih data mana yang mau di tampilkan</label>
                    <select
                      value={viewArchiveCategory}
                      onChange={e => setViewArchiveCategory(e.target.value)}
                      className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all outline-none"
                    >
                      <option value="">--- silahkan pilih ---</option>
                      <option>Kelas</option>
                      <option>Mata Pelajaran</option>
                      <option>Guru & Pengajar</option>
                      <option>Jadwal Pelajaran</option>
                      <option>Tambah Jurusan</option>
                      <option>Kegiatan Ekstra Sekolah</option>
                      <option>Semua Data</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* SELECT YEAR */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tahun Ajaran</label>
                      <select
                        value={archiveForm.tahunAjaran}
                        onChange={e => setArchiveForm(f => ({ ...f, tahunAjaran: e.target.value }))}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:bg-white transition-all outline-none"
                      >
                        <option value="">-- Tahun --</option>
                        {(() => {
                          const drafts = JSON.parse(localStorage.getItem('school_academic_archives_v2') || '[]');
                          return [...new Set(drafts.map(d => d.tahunAjaran))].map(year => (
                            <option key={year} value={year}>{year}</option>
                          ));
                        })()}
                      </select>
                    </div>

                    {/* SELECT SEMESTER */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
                      <select
                        value={archiveForm.semester}
                        onChange={e => setArchiveForm(f => ({ ...f, semester: e.target.value }))}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:bg-white transition-all outline-none"
                      >
                        <option value="Ganjil">Ganjil</option>
                        <option value="Genap">Genap</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setArchiveModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all font-inter"
                  >
                    Batal
                  </button>
                  <button
                    disabled={(() => {
                      if (!viewArchiveCategory || !archiveForm.tahunAjaran) return true;
                      const drafts = JSON.parse(localStorage.getItem('school_academic_archives_v2') || '[]');
                      let checkData = drafts.filter(d => 
                        d.tahunAjaran === archiveForm.tahunAjaran && d.semester === archiveForm.semester
                      );
                      if (viewArchiveCategory !== 'Semua Data') {
                        checkData = checkData.filter(d => d.category === viewArchiveCategory);
                      }
                      return checkData.length === 0;
                    })()}
                    onClick={() => {
                      const drafts = JSON.parse(localStorage.getItem('school_academic_archives_v2') || '[]');
                      let filteredDrafts = drafts.filter(d => 
                        d.tahunAjaran === archiveForm.tahunAjaran && d.semester === archiveForm.semester
                      );

                      if (viewArchiveCategory !== 'Semua Data') {
                        filteredDrafts = filteredDrafts.filter(d => d.category === viewArchiveCategory);
                      }

                      if (filteredDrafts.length === 0) {
                        showAlert('error', 'Data tidak ditemukan di arsip!');
                        return;
                      }

                      // GENERATE VIEW PDF
                      const printWin = window.open('', '_blank');
                      let tablesHtml = '';
                      
                      filteredDrafts.forEach(draft => {
                        const list = draft.data || [];
                        if (list.length === 0) return;
                        
                        const validKeys = Object.keys(list[0]).filter(k => !['id', 'isActive', 'peserta', 'mapel'].includes(k));
                        tablesHtml += `
                        <div style="margin-bottom: 50px; page-break-inside: avoid;">
                          <h2 style="text-transform: uppercase; border-left: 5px solid #000; padding-left: 15px; margin-bottom: 20px; font-size: 16px;">DATA ${draft.category.toUpperCase()}</h2>
                          <table style="width:100%; border-collapse: collapse; table-layout: fixed; word-wrap: break-word;">
                            <thead>
                              <tr style="background: #f1f5f9;">
                                <th style="border: 1px solid #ddd; padding: 10px; font-size: 11px; text-align: left; width: 40px;">NO</th>
                                ${validKeys.map(k => `<th style="border: 1px solid #ddd; padding: 10px; font-size: 11px; text-align: left;">${k.toUpperCase()}</th>`).join('')}
                              </tr>
                            </thead>
                            <tbody>
                                ${list.map((row, i) => `
                                  <tr>
                                    <td style="border: 1px solid #ddd; padding: 10px; font-size: 11px; text-align: center;">${i + 1}</td>
                                    ${validKeys.map(k => `<td style="border: 1px solid #ddd; padding: 10px; font-size: 11px;">${row[k]}</td>`).join('')}
                                  </tr>
                                `).join('')}
                            </tbody>
                          </table>
                        </div>
                      `;
                      });

                      const html = `
                      <html>
                        <head>
                          <title>ARSIP: ${viewArchiveCategory}</title>
                          <style>
                            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; }
                            .header { text-align: center; margin-bottom: 50px; border-bottom: 2px double #000; padding-bottom: 20px; }
                            h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
                            .meta { font-weight: bold; margin-top: 10px; color: #64748b; font-size: 12px; }
                            @media print { .no-print { display: none; } body { padding: 0.5cm; } }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <h1>LAPORAN ARSIP AKADEMIK</h1>
                            <div class="meta">TAHUN: ${archiveForm.tahunAjaran} | SEMESTER: ${archiveForm.semester.toUpperCase()} | KATEGORI: ${viewArchiveCategory.toUpperCase()}</div>
                          </div>
                          ${tablesHtml}
                          <div style="margin-top: 60px; text-align: right; page-break-inside: avoid;">
                            <p style="font-size: 14px; margin-bottom: 40px;">Tertanda ;</p>
                            <p style="font-size: 14px;"><b>( Admin Akademik )</b></p>
                            <p style="font-size: 11px; margin-top: 8px; color: #64748b;">
                              dicetak pada : ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(/:/g, '.')}.
                            </p>
                          </div>
                          <div class="no-print" style="position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);">
                            <button onclick="window.print()" style="padding: 16px 40px; background: #000; color: #fff; border: none; border-radius: 12px; cursor: pointer; font-weight: 900; text-transform: uppercase; font-size: 12px;">PRINT / DOWNLOAD SEBAGAI PDF</button>
                          </div>
                        </body>
                      </html>
                    `;
                    printWin.document.write(html);
                    printWin.document.close();
                    setArchiveModalOpen(false);
                  }}
                  className={`flex-1 py-4 font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all ${
                    (() => {
                      if (!viewArchiveCategory || !archiveForm.tahunAjaran) return true;
                      const drafts = JSON.parse(localStorage.getItem('school_academic_archives_v2') || '[]');
                      let checkData = drafts.filter(d => 
                        d.tahunAjaran === archiveForm.tahunAjaran && d.semester === archiveForm.semester
                      );
                      if (viewArchiveCategory !== 'Semua Data') {
                        checkData = checkData.filter(d => d.category === viewArchiveCategory);
                      }
                      return checkData.length === 0;
                    })()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-slate-900 text-white shadow-lg shadow-slate-100 hover:bg-black active:scale-95'
                  }`}
                >
                  Tampilkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

    </div>
  );
};

const RequiredLabel = ({ children }) => (
  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
    {children} <span className="text-rose-500">*</span>
  </label>
);

const studentNisn = (student) => {
  const candidates = [student?.nisn_nip, student?.nisn, student?.secondary_identity_number, student?.nis]
    .map(value => String(value || '').replace(/\D/g, ''))
    .filter(Boolean);
  return candidates.find(value => value.length === 10) || candidates[0] || '';
};
// Semua nilai identitas mentah (NISN + NIS + varian lain) untuk keperluan pencarian.
const studentIdentityValues = (student) => [
  student?.nisn_nip, student?.nisn, student?.secondary_identity_number, student?.nis
].map(value => String(value || '').trim()).filter(Boolean);
const studentIsSelected = (studentIds, id) => (studentIds || []).some(student => {
  const studentId = student && typeof student === 'object' ? (student.id ?? student.student_id) : student;
  return String(studentId) === String(id);
});

const StudentPillPicker = ({ students = [], selectedStudents = [], excludedStudentIds = new Set(), search = '', onSearchChange, onSelect }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const wrapperRef = React.useRef(null);
  const selectedIds = new Set(selectedStudents.map(student => String(student.id)));
  const matches = students
    .filter(student => !selectedIds.has(String(student.id)))
    .filter(student => !excludedStudentIds.has(String(student.id)))
    .filter(student => {
      const keyword = search.trim().toLowerCase();
      if (!keyword) return true;
      const name = String(student.name || student.full_name || '').toLowerCase();
      return name.includes(keyword)
        || studentNisn(student).toLowerCase().includes(keyword)
        || studentIdentityValues(student).some(value => value.toLowerCase().includes(keyword));
    })
    .sort((left, right) => String(left.name || left.full_name || '').localeCompare(String(right.name || right.full_name || ''), 'id'));

  React.useEffect(() => {
    const closeWhenOutside = event => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeWhenOutside);
    return () => document.removeEventListener('mousedown', closeWhenOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button type="button" onClick={() => setIsOpen(open => !open)} className={`flex w-full items-center justify-between rounded-2xl border bg-white p-4 text-left text-sm font-bold outline-none transition ${isOpen ? 'border-cyan-500 ring-4 ring-cyan-100' : 'border-slate-200 hover:border-cyan-300'}`}>
        <span className="min-w-0 truncate whitespace-nowrap text-slate-400">— Silahkan pilih murid —</span>
        <ChevronRight className={`ml-3 h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && <div className="absolute left-0 top-full z-[80] mt-2 flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-slate-50 p-3">
          <input autoFocus value={search} onChange={event => onSearchChange(event.target.value)} placeholder="Cari nama, NISN, atau NIS..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
        </div>
        <div className="max-h-52 space-y-1 overflow-y-auto p-2" role="listbox" aria-label="Daftar murid yang dapat dipilih" style={{ scrollbarWidth: 'thin' }}>
          {matches.length ? matches.map(student => (
            <button type="button" key={student.id} onClick={() => onSelect(student)} className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-800">
              <span>{student.name || student.full_name || 'Tanpa Nama'} <span className="font-semibold text-slate-400">({studentNisn(student) || '-'})</span></span>
            </button>
          )) : <p className="px-3 py-5 text-center text-xs font-semibold text-slate-400">Keyword tidak ditemukan.</p>}
        </div>
      </div>
      }
    </div>
  );
};

const FormInput = ({ label, placeholder, type = 'text', autoUpper = false, themeColor = '#6366f1', value, onChange, required = false }) => (
  <div className="space-y-3">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}{required && <> <span className="text-rose-500">*</span></>}</label>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:ring-4 focus:bg-white transition-all outline-none ${autoUpper ? 'uppercase' : ''}`}
      onFocus={e => { e.target.style.borderColor = themeColor; e.target.style.boxShadow = `0 0 0 4px ${themeColor}20`; }}
      onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}
    />
  </div>
);

export default MasterDataTab;
