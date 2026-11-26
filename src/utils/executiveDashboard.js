import {
  Bell,
  BookOpen,
  Calendar,
  ClipboardList,
  DollarSign,
  FileText,
  School,
  UserCheck,
  Users,
} from 'lucide-react';

import { resolveAccessRole } from './userMeta';

export const EXECUTIVE_SCOPE_LABELS = {
  kurikulum: 'Waka Kurikulum',
  kesiswaan: 'Waka Kesiswaan',
  humas: 'Waka Humas',
  sarpras: 'Waka Sarpras',
};

const PRINCIPAL_MENU_ITEMS = [
  { id: 'overview', title: 'Dashboard', icon: School, path: '/dashboard/dashboard' },
  { id: 'academics', title: 'Monitoring KBM & Jurnal Guru', icon: BookOpen, path: '/dashboard/kepsek-academics' },
  { id: 'graduation_report', title: 'Rekap Nilai, Rapor & Kelulusan', icon: FileText, path: '/dashboard/kepsek-graduation' },
  { id: 'finance', title: 'Keuangan & Approval Anggaran', icon: DollarSign, path: '/dashboard/kepsek-finance' },
  { id: 'teacher_performance', title: 'Evaluasi Kinerja Tenaga Didik', icon: UserCheck, path: '/dashboard/kepsek-performance' },
  { id: 'alumni_archive', title: 'Data Mutasi & Alumni', icon: Users, path: '/dashboard/kepsek-alumni' },
  { id: 'user_management', title: 'Audit Akun & Hak Akses', icon: Users, path: '/dashboard/kepsek-users' },
  { id: 'calendar_ta', title: 'Kalender Akademik', icon: Calendar, path: '/dashboard/calendar_ta' },
  { id: 'news', title: 'Pusat Informasi', icon: Bell, path: '/dashboard/news' },
];

const WAKASEK_MENU_ITEMS = [
  { id: 'overview', title: 'Dashboard', icon: School, path: '/dashboard/dashboard' },
  { id: 'wakasek_class_management', title: 'Plotting Kelas & Wali Kelas', icon: Users, path: '/dashboard/wakasek-classes' },
  { id: 'wakasek_academics', title: 'Monitoring KBM & Perangkat Ajar', icon: BookOpen, path: '/dashboard/wakasek-academics' },
  { id: 'wakasek_exams', title: 'Monitoring Ujian CBT', icon: ClipboardList, path: '/dashboard/wakasek-exams' },
  { id: 'wakasek_attendance', title: 'Presensi & Disiplin Tenaga Didik', icon: UserCheck, path: '/dashboard/wakasek-attendance' },
  { id: 'wakasek_graduation', title: 'Rekap Nilai & Ketuntasan KKM', icon: FileText, path: '/dashboard/wakasek-graduation' },
  { id: 'calendar_ta', title: 'Kalender Akademik', icon: Calendar, path: '/dashboard/calendar_ta' },
  { id: 'news', title: 'Pusat Informasi', icon: Bell, path: '/dashboard/news' },
];

// Peta fallback URL lama /dashboard/executive/:tab -> route 2-slash baru (role-agnostic,
// id tab lama unik per peran) agar tidak ada link mati / 404 setelah pemisahan arsitektur.
export const LEGACY_EXECUTIVE_TAB_PATHS = {
  overview: '/dashboard/dashboard',
  academics: '/dashboard/kepsek-academics',
  graduation_report: '/dashboard/kepsek-graduation',
  finance: '/dashboard/kepsek-finance',
  teacher_performance: '/dashboard/kepsek-performance',
  alumni_archive: '/dashboard/kepsek-alumni',
  user_management: '/dashboard/kepsek-users',
  calendar_ta: '/dashboard/calendar_ta',
  news: '/dashboard/news',
  wakasek_class_management: '/dashboard/wakasek-classes',
  wakasek_academics: '/dashboard/wakasek-academics',
  wakasek_exams: '/dashboard/wakasek-exams',
  wakasek_attendance: '/dashboard/wakasek-attendance',
  wakasek_graduation: '/dashboard/wakasek-graduation',
};

export const resolveLegacyExecutivePath = (subPath) => {
  const seg = String(subPath || '').replace(/^\/+/, '').split('/')[0];
  if (!seg) return '/dashboard/dashboard';
  return LEGACY_EXECUTIVE_TAB_PATHS[seg] || '/dashboard/dashboard';
};

const EXECUTIVE_SCOPE_KEYWORDS = {
  kurikulum: ['kurikulum', 'curriculum', 'rpp', 'akademik'],
  kesiswaan: ['kesiswaan', 'osis', 'bk', 'bimbingan', 'kedisiplinan', 'siswa'],
  humas: ['humas', 'publikasi', 'alumni', 'ppdb', 'kerjasama', 'public'],
  sarpras: ['sarpras', 'sarana', 'prasarana', 'fasilitas', 'inventaris', 'maintenance'],
};

const normalizeScope = (value) => {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');

  if (normalized in EXECUTIVE_SCOPE_LABELS) {
    return normalized;
  }

  return Object.entries(EXECUTIVE_SCOPE_KEYWORDS).find(([, keywords]) =>
    keywords.some((keyword) => normalized.includes(keyword.replaceAll(' ', '_')))
  )?.[0] || null;
};

export const resolveExecutiveScope = (user) => {
  const explicitScope = normalizeScope(
    user?.executiveScope
    || user?.executive_scope
    || user?.managementScope
    || user?.management_scope
    || user?.department
    || user?.department_name
  );

  if (explicitScope) {
    return explicitScope;
  }

  const haystack = [
    user?.name,
    user?.email,
    user?.schoolId,
    user?.school_id,
    user?.address,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return Object.entries(EXECUTIVE_SCOPE_KEYWORDS).find(([, keywords]) =>
    keywords.some((keyword) => haystack.includes(keyword))
  )?.[0] || null;
};

export const getExecutiveMenuItems = (user) => {
  const accessRole = resolveAccessRole(user);

  if (accessRole === 'kepala_sekolah') {
    return PRINCIPAL_MENU_ITEMS;
  }

  if (accessRole === 'wakil_sekolah') {
    return WAKASEK_MENU_ITEMS;
  }

  return PRINCIPAL_MENU_ITEMS;
};

export const getExecutiveScopeLabel = (scope) => EXECUTIVE_SCOPE_LABELS[scope] || 'Wakil Kepala Sekolah';

export const getExecutiveDefaultPath = (user) => getExecutiveMenuItems(user)[0]?.path || '/dashboard/dashboard';

// Resolusi path menu executive berdasarkan id tab (untuk link internal antar-menu).
export const getExecutivePath = (user, id) => {
  const item = getExecutiveMenuItems(user).find((m) => m.id === id);
  return item?.path || LEGACY_EXECUTIVE_TAB_PATHS[id] || '/dashboard/dashboard';
};

export const getViceScopeMenuItems = () => WAKASEK_MENU_ITEMS;
