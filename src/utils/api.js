import axios from 'axios';
import { installMock } from '../mocks/installMock';

// Standalone demo: every request is served from localStorage (no Laravel/MySQL).
// See src/mocks/ for the seeder and router.

// Base URL backend. Default-nya PHP built-in server (`php artisan serve`).
// Setelah backend dipindah ke Apache/Nginx, cukup ubah satu baris di `frontend/.env`:
//   VITE_API_BASE_URL=http://localhost:8080
// sehingga tidak perlu lagi mengedit berkas ini.
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_BASE_URL = `${BASE_URL}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Install the localStorage mock adapter + fetch shim before any request runs.
installMock(api);

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    // Gunakan token dari sessionStorage jika Authorization header belum diset secara manual
    if (!config.headers.Authorization) {
      const token = sessionStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    // CATATAN: parameter `_t` (cache buster) sengaja DIHAPUS.
    // Cache buster memaksa setiap GET dianggap URL baru, sehingga HTTP cache
    // browser dan cache internal tidak pernah terpakai. Endpoint yang datanya
    // berubah cepat tetap segar karena komponennya melakukan polling sendiri
    // (lihat utils/queryCache.js), sedangkan data statis kini bisa di-cache.

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Saat sesi tidur berakhir, pertahankan halaman Sleep Mode meski ada
    // request lain yang terlambat dan mengembalikan 401.
    const isSleepRedirecting = sessionStorage.getItem('sleep_redirecting') === '1';
    const skipUnauthorizedRedirect = error.config?.skipUnauthorizedRedirect === true;
    const requestUrl = String(error.config?.url || '');
    if (error.response?.status === 401 && !skipUnauthorizedRedirect && !isSleepRedirecting && !requestUrl.includes('/auth/login')) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/';
    }

    // Cek apakah user adalah Master Operator atau sedang impersonation — skip redirect sistem
    const savedUser = sessionStorage.getItem('user');
    let isMasterOrImpersonating = false;
    try {
      const u = savedUser ? JSON.parse(savedUser) : null;
      // Only the dedicated master account bypasses Sleep/Maintenance gates;
      // a generic operator role is still subject to the configured schedule.
      isMasterOrImpersonating = Number(u?.id) === 9324 || u?._impersonating === true;
    } catch {}
    
    // Handle Maintenance Mode
    if (error.response?.status === 503 && error.response?.data?.maintenance && !isMasterOrImpersonating) {
      sessionStorage.setItem('maintenance_data', JSON.stringify(error.response.data));
      window.location.href = '/maintenance';
    }

    // Handle Sleep Mode (Tanda-tanda sistem akan tidur)
    if (error.response?.status === 403 && error.response?.data?.sleep_mode && !isMasterOrImpersonating) {
      window.dispatchEvent(new CustomEvent('systemStatusChanged'));
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData, userData instanceof FormData ? {
    headers: { 'Content-Type': 'multipart/form-data' }
  } : undefined),
  verifyResetUser: (data) => api.post('/auth/forgot-password/verify-user', data),
  sendResetOtp: (data) => api.post('/auth/forgot-password/send-otp', data),
  verifyResetOtp: (data) => api.post('/auth/forgot-password/verify-otp', data),
  resetPassword: (data) => api.post('/auth/forgot-password/reset', data),
  logout: () => api.post('/auth/logout'),
  logoutWithToken: (token) => api.post('/auth/logout', {}, {
    headers: { Authorization: `Bearer ${token}` },
    skipUnauthorizedRedirect: true,
  }),
};

export const userAPI = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.post('/user/profile', data, data instanceof FormData ? {
    headers: { 'Content-Type': 'multipart/form-data' }
  } : undefined),
  deleteAvatar: () => api.delete('/user/profile/avatar'),
  changePassword: (data) => api.put('/user/password', data),
  sessionHeartbeat: () => api.post('/user/session-heartbeat'),
  acknowledgePromotion: () => api.post('/user/acknowledge-promotion'),
  getSessions: () => api.get('/user/sessions'),
  revokeSession: (id) => api.delete(`/user/sessions/${id}`),
  logoutOtherDevices: () => api.post('/user/sessions/logout-others'),
};

export const managementAPI = {
  getStats: () => api.get('/management/stats'),
  getTeachers: () => api.get('/management/teachers'),
  getFinancials: () => api.get('/management/financials'),
  postAnnouncement: (data) => api.post('/management/announcements', data),
  storeTeacherPerformance: (data) => api.post('/management/teacher-performance', data),
  assignHomeroom: (data) => api.post('/management/assign-homeroom', data),
};

export const operatorAPI = {
  // Dashboard
  getStats: () => api.get('/operator/stats'),
  getAkademikSummary: () => api.get('/operator/akademik-summary'),
  getExamSettings: () => api.get('/operator/exam-settings'),
  saveExamSettings: (data) => api.put('/operator/exam-settings', data),
  getExamAttempts: (params) => api.get('/operator/exam-attempts', { params }),
  unlockExamAttempt: (id) => api.post(`/operator/exam-attempts/${id}/unlock`),
  resetExamAttempt: (id) => api.post(`/operator/exam-attempts/${id}/reset`),
  forceLogoutExamAttempt: (id) => api.post(`/operator/exam-attempts/${id}/force-logout`),
  getRemoteAttempt: (id) => api.get(`/operator/exam-attempts/${id}/remote`),
  remoteSaveAttempt: (id, answers) => api.post(`/operator/exam-attempts/${id}/remote-save`, { answers }),
  remoteSubmitAttempt: (id, answers) => api.post(`/operator/exam-attempts/${id}/remote-submit`, { answers }),
  getAcademicActivities: () => api.get('/operator/school-activities'),
  createAcademicActivity: (data) => api.post('/operator/school-activities', data),
  updateAcademicActivity: (id, data) => api.put(`/operator/school-activities/${id}`, data),
  deleteAcademicActivity: (id) => api.delete(`/operator/school-activities/${id}`),

  // Manajemen Pengguna
  getUsers: (params) => api.get('/operator/users', { params }),
  createUser: (data) => api.post('/operator/users', data, data instanceof FormData ? {
    headers: { 'Content-Type': 'multipart/form-data' }
  } : undefined),
  updateUser: (id, data) => api.put(`/operator/users/${id}`, data, data instanceof FormData ? {
    headers: { 'Content-Type': 'multipart/form-data' }
  } : undefined),
  deleteUser: (id) => api.delete(`/operator/users/${id}`),
  toggleUserStatus: (id) => api.patch(`/operator/users/${id}/toggle-status`),
  offboardUser: (id, payload) => api.post(`/operator/users/${id}/offboard`, payload),
  reactivateUser: (id) => api.post(`/operator/users/${id}/reactivate`),
  acceptUser: (id) => api.post(`/operator/users/${id}/accept`),
  impersonateUser: (id) => api.post(`/operator/users/${id}/impersonate`),
  stopImpersonation: () => api.delete('/operator/impersonate'),
  backupImpersonatedUserData: () => api.post('/operator/impersonate/backup'),
  acceptAllUsers: () => api.post('/operator/users/accept-all'),
  deleteAllUsers: () => api.delete('/operator/users/clear-all'),
  importAcademicMembers: (formData) => api.post('/operator/users/import-academic-members', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  exportMembersExcel: () => api.get('/operator/users/export-excel', { responseType: 'blob' }),
  assignStaffTask: (data) => api.post('/operator/staff-tasks', data),

  // Master Akademik
  getMasterData: () => api.get('/operator/master-data'),
  createMasterClass: (data) => api.post('/operator/master-data/classes', data),
  syncMasterClasses: (data) => api.post('/operator/master-data/classes/sync', data),
  updateSchoolClass: (id, data) => api.put(`/operator/master-data/classes/${id}`, data),
  deleteSchoolClass: (id) => api.delete(`/operator/master-data/classes/${id}`),
  assignHomeroomTeacher: (id, data) => api.patch(`/operator/master-data/classes/${id}/homeroom`, data),
  createTeacherSubjectAssignment: (data) => api.post('/operator/master-data/teacher-subjects', data),
  syncSubjects: (data) => api.post('/operator/master-data/subjects/sync', data),
  deleteSubject: (id) => api.delete(`/operator/master-data/subjects/${id}`),
  resetMasterData: () => api.delete('/operator/master-data/reset'),
  // Jurusan CRUD
  createJurusan: (data) => api.post('/operator/master-data/jurusan', data),
  updateJurusan: (id, data) => api.patch(`/operator/master-data/jurusan/${id}`, data),
  deleteJurusan: (id) => api.delete(`/operator/master-data/jurusan/${id}`),

  // Sarana Prasarana
  getSarana: () => api.get('/operator/sarana'),
  createLearningRoom: (data) => api.post('/operator/sarana/rooms', data),
  updateLearningRoom: (id, data) => api.patch(`/operator/sarana/rooms/${id}`, data),
  deleteLearningRoom: (id) => api.delete(`/operator/sarana/rooms/${id}`),
  createInventory: (data) => api.post('/operator/sarana/inventories', data),
  updateInventory: (id, data) => api.patch(`/operator/sarana/inventories/${id}`, data),
  deleteInventory: (id) => api.delete(`/operator/sarana/inventories/${id}`),

  // Fasilitas Terpadu (2 tab kepemilikan + 4 alur aset)
  getFasilitas: () => api.get('/operator/fasilitas'),
  createFasilitasRoom: (data) => api.post('/operator/fasilitas/rooms', data),
  updateFasilitasRoom: (id, data) => api.patch(`/operator/fasilitas/rooms/${id}`, data),
  deleteFasilitasRoom: (id) => api.delete(`/operator/fasilitas/rooms/${id}`),
  createFasilitasInventory: (data) => api.post('/operator/fasilitas/inventories', data),
  updateFasilitasInventory: (id, data) => api.patch(`/operator/fasilitas/inventories/${id}`, data),
  deleteFasilitasInventory: (id) => api.delete(`/operator/fasilitas/inventories/${id}`),
  allocateFasilitasInventory: (id, jurusan_id) => api.patch(`/operator/fasilitas/inventories/${id}/allocate`, { jurusan_id }),
  updateFasilitasStatus: (id, data) => api.patch(`/operator/fasilitas/assets/${id}/status`, data),
  createFasilitasBorrowing: (data) => api.post('/operator/fasilitas/borrowings', data),
  updateFasilitasBorrowingStatus: (id, data) => api.patch(`/operator/fasilitas/borrowings/${id}/status`, data),
  deleteFasilitasBorrowing: (id) => api.delete(`/operator/fasilitas/borrowings/${id}`),
  createFasilitasMaintenance: (data) => api.post('/operator/fasilitas/maintenances', data),
  updateFasilitasMaintenanceStatus: (id, data) => api.patch(`/operator/fasilitas/maintenances/${id}/status`, data),
  deleteFasilitasMaintenance: (id) => api.delete(`/operator/fasilitas/maintenances/${id}`),
  pinjamFasilitasUmum: (data) => api.post('/operator/fasilitas/umum/pinjam', data),
  kembalikanFasilitasPinjam: (id, data) => api.patch(`/operator/fasilitas/borrowings/${id}/kembalikan`, data || {}),

  // Log Aktivitas
  getActivityLog: (params) => api.get('/operator/activity-log', { params }),
  clearActivityLog: () => api.delete('/operator/activity-log'),
  getOnlineUsers: () => api.get('/operator/security/online-users'),
  getSecurityBackups: () => api.get('/operator/security/backups'),
  createSecurityBackup: (data) => api.post('/operator/security/backups', data),
  downloadSecurityBackup: (fileName) => api.get(`/operator/security/backups/${encodeURIComponent(fileName)}/download`, {
    responseType: 'blob'
  }),
  deleteSecurityBackup: (fileName) => api.delete(`/operator/security/backups/${encodeURIComponent(fileName)}`),
  resetSecurityAdminPassword: (id) => api.post(`/operator/security/admins/${id}/reset-password`),
  suspendSecurityAdminAccess: (id) => api.post(`/operator/security/admins/${id}/suspend`),
  logoutSecurityAdmin: (id) => api.post(`/operator/security/admins/${id}/logout`),

  // Backup & Alumni Management (TAHAP 2 & 4)
  getBackupHistory: (params) => api.get('/operator/backup/history', { params }),
  generateUniqueCode: (params) => api.get('/operator/users/generate-code', { params }),
  backupGlobal: () => api.post('/operator/backup/global'),
  backupByRole: (data) => api.post('/operator/backup/by-role', data),
  backupAlumni: (data) => api.post('/operator/backup/alumni', data),
  deleteBackupRecord: (id) => api.delete(`/operator/backup/${id}`),
  deleteBackupHistoryBulk: (filter) => api.delete('/operator/backup/history', { data: { filter } }),
  restoreBackup: (id) => api.post(`/operator/backup/${id}/restore`),
  setAlumniReminder: (data) => api.post('/operator/alumni/set-reminder', data),
  checkAlumniReminder: () => api.get('/alumni/check-reminder'),
  dismissAlumniReminder: () => api.post('/alumni/dismiss-reminder'),
  // Pengaturan pengingat kedaluwarsa portal alumni (toggle + milestone H-30/H-7/H-3)
  getAlumniReminderSettings: () => api.get('/operator/alumni/reminder-settings'),
  saveAlumniReminderSettings: (data) => api.put('/operator/alumni/reminder-settings', data),
  runAlumniReminders: () => api.post('/operator/alumni/run-reminders'),

  // Pengumuman
  getAnnouncements: () => api.get('/operator/announcements'),
  createAnnouncement: (data) => api.post('/operator/announcements', data),
  deleteAnnouncement: (id) => api.delete(`/operator/announcements/${id}`),
};

export const adminGradesAPI = {
  getOptions: () => api.get('/operator/grades/options'),
  getSubjects: (kelas_id) => api.get('/operator/grades/subjects', { params: { kelas_id } }),
  getRecap: (params) => api.get('/operator/grades/recap', { params }),
  syncExams: (data) => api.post('/operator/grades/sync-exams', data),
  save: (data) => api.put('/operator/grades', data),
  // Restructure Penilaian Admin Akademik
  getMatrix: (params) => api.get('/operator/grades/matrix', { params }),
  toggleLock: (data) => api.post('/operator/grades/lock', data),
  getLedger: (params) => api.get('/operator/grades/ledger', { params }),
  getWeightRules: () => api.get('/operator/grades/weight-rules'),
  saveWeightRules: (data) => api.post('/operator/grades/weight-rules', data),
  getKkm: () => api.get('/operator/grades/kkm'),
  saveKkm: (data) => api.post('/operator/grades/kkm', data),
  getPredikat: () => api.get('/operator/grades/predikat'),
  savePredikat: (data) => api.post('/operator/grades/predikat', data),
};

export const staffAPI = {
  getDashboard: () => api.get('/staff/dashboard'),
  checkIn: (data) => api.post('/staff/presence/check-in', data),
  checkOut: () => api.post('/staff/presence/check-out'),
  createLog: (data) => api.post('/staff/logs', data),
  updateTaskStatus: (id, data) => api.patch(`/staff/tasks/${id}/status`, data),
};

// Profil resmi sekolah (kop rapor & dokumen resmi) — dibaca semua role, disimpan oleh operator.
export const schoolAPI = {
  getProfile: () => api.get('/school-profile'),
  updateProfile: (data) => api.put('/school-profile', data),
};

export const teacherAPI = {
  getStats: () => api.get('/teacher/stats'),
  getDashboardKPI: () => api.get('/teacher/dashboard-kpi'),
  getAssignments: () => api.get('/teacher/assignments'),
  getQuestionBank: () => api.get('/teacher/question-bank'),
    createQuestionPackageDocx: (formData, onUploadProgress) => api.post('/teacher/question-bank/docx', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),
  getQuestionDrafts: () => api.get('/teacher/question-drafts'),
  getJournals: (params) => api.get('/teacher/journals', { params }),
  getLastJournal: () => api.get('/teacher/journals/last'),
  createJournal: (data) => api.post('/teacher/journals', data),
  updateJournal: (id, data) => api.put(`/teacher/journals/${id}`, data),
  deleteJournal: (id) => api.delete(`/teacher/journals/${id}`),
  getAttendanceStudents: (params) => api.get('/teacher/attendance/students', { params }),
  getAttendanceRecap: (params) => api.get('/teacher/attendance/recap', { params }),
  getTeacherAttendanceRecap: (params) => api.get('/teacher/attendance/teacher-recap', { params }),
  saveAttendance: (data) => api.post('/teacher/attendance', data),
  // Nilai & Rapor
  getGradeOptions: () => api.get('/teacher/grades/options'),
  getSubjectsByClass: (kelas_id) => api.get('/teacher/grades/subjects', { params: { kelas_id } }),
  getGradingStudents: (params) => api.get('/teacher/grades/students', { params }),
  getTaskAverage: (params) => api.get('/teacher/grades/task-average', { params }),
  saveGrades: (data) => api.post('/teacher/grades', data),
  getRaporData: (params) => api.get('/teacher/grades/rapor', { params }),
  saveRapor: (data) => api.post('/teacher/grades/rapor', data),
  getGradingTemplate: () => api.get('/teacher/grades/template'),
  importGrades: (data) => api.post('/teacher/grades/import', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  // Materi Ajar
  getMaterials: (params) => api.get('/teacher/materials', { params }),
  getMaterial: (id) => api.get(`/teacher/materials/${id}`),
  saveMaterial: (data) => api.post('/teacher/materials', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateMaterial: (id, data) => api.post(`/teacher/materials/${id}?_method=PUT`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteMaterial: (id) => api.delete(`/teacher/materials/${id}`),
  downloadMaterial: (id) => api.get(`/teacher/materials/download/${id}`, { responseType: 'blob' }),
  getSchedules: (params) => api.get('/teacher/schedules', { params }),
  // Wali Kelas — Command Center
  getHomeroom: () => api.get('/teacher/homeroom'),  getHomeroomStudent: (id) => api.get(`/teacher/homeroom/student/${id}`),
  saveHomeroomRapor: (data) => api.post('/teacher/homeroom/rapor', data),
  publishHomeroomRapor: (data) => api.post('/teacher/homeroom/publish', data),
  addHomeroomPrestasi: (data) => api.post('/teacher/homeroom/prestasi', data),
  updateHomeroomPrestasi: (id, data) => api.put(`/teacher/homeroom/prestasi/${id}`, data),
  deleteHomeroomPrestasi: (id) => api.delete(`/teacher/homeroom/prestasi/${id}`),
  addHomeroomBk: (data) => api.post('/teacher/homeroom/bk', data),
  deleteHomeroomBk: (id) => api.delete(`/teacher/homeroom/bk/${id}`),
  getClasses: () => api.get('/teacher/classes'),
  uploadFile: (formData) => api.post('/teacher/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  // Absensi Mengajar
  getMySchedule: (params) => api.get('/teacher/my-schedule', { params }),
  getAbsensiMengajar: (params) => api.get('/teacher/absensi-mengajar', { params }),
  saveAbsensiMengajar: (data) => api.post('/teacher/absensi-mengajar', data),
  saveKbmSession: (data) => api.post('/teacher/kbm/session', data),
};

export const adminAkademikAPI = {
  getClassStudents: (classId, params) => api.get(`/admin/classes/${classId}/students`, { params }),
  assignClassStudent: (classId, data) => api.post(`/admin/classes/${classId}/students`, data),
  removeClassStudent: (classId, studentId) => api.delete(`/admin/classes/${classId}/students/${studentId}`),
  // Workspace Manajemen KBM — riwayat aktivitas terintegrasi
  getKbmLogs: (params) => api.get('/admin/kbm/logs', { params }),
  createKbmLog: (data) => api.post('/admin/kbm/logs', data),
  // Transisi Tahun Ajaran (4-tahap atomik) — lihat & jalankan
  previewAcademicTransition: (data) => api.post('/admin/kbm/academic-transition/preview', data),
  executeAcademicTransition: (data) => api.post('/admin/kbm/academic-transition/execute', data),
  getAbsensiHarian: (params) => api.get('/admin/absensi-mengajar/harian', { params }),
  getKbmMonitoring: (params) => api.get('/admin/monitoring-kbm', { params }),
  getStaffPresenceDaily: (params) => api.get('/admin/staff-presences', { params }),
  overrideStaffPresence: (userId, data) => api.put(`/admin/staff-presences/${userId}/override`, data),
  overrideBulkStaffPresence: (data) => api.post('/admin/staff-presences/bulk', data),
  getTeacherPresenceDaily: (params) => api.get('/admin/teacher-presences', { params }),
  overrideTeacherPresence: (userId, data) => api.put(`/admin/teacher-presences/${userId}/override`, data),
  overrideKbmMonitoring: (scheduleId, data) => api.put(`/admin/monitoring-kbm/${scheduleId}/override`, data),
  replaceTodayKbmTeachers: (data) => api.post('/admin/monitoring-kbm/penggantian-hari-ini', data),
  getAbsensiRekap: (params) => api.get('/admin/absensi-mengajar', { params }),
  overrideAbsensi: (id, data) => api.put(`/admin/absensi-mengajar/${id}`, data),
  // Jadwal Guru CRUD
  getJadwalGuru: (params) => api.get('/admin/jadwal-guru', { params }),
    getTimeSlots: () => api.get('/admin/time-slots'),
  createJadwalGuru: (data) => api.post('/admin/jadwal-guru', data),
  updateJadwalGuru: (id, data) => api.put(`/admin/jadwal-guru/${id}`, data),
  deleteJadwalGuru: (id) => api.delete(`/admin/jadwal-guru/${id}`),
  getJadwalKelas: (classId, params) => api.get(`/admin/jadwal-kelas/${classId}`, { params }),
  // Presensi Siswa (New)
  getStudentRecap: (params) => api.get('/admin/presensi', { params }),
  getStudentAttendanceMonitoring: (params) => api.get('/admin/presensi/monitoring', { params }),
  getStudentAttendanceSession: (scheduleId, params) => api.get(`/admin/presensi/monitoring/${scheduleId}`, { params }),
  overrideStudentAttendanceSession: (scheduleId, studentId, data) => api.put(`/admin/presensi/monitoring/${scheduleId}/students/${studentId}`, data),
  updateStudentAttendance: (id, data) => api.put(`/admin/presensi/${id}`, data),
  getAttendanceDashboard: () => api.get('/admin/presensi/dashboard'),
  // Kurikulum & Silabus
  getCurriculumDocuments: (params) => api.get('/admin/curriculum/documents', { params }),
  uploadCurriculumDocument: (formData) => api.post('/admin/curriculum/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateCurriculumDocument: (id, formData) => api.post(`/admin/curriculum/documents/${id}?_method=PUT`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteCurriculumDocument: (id) => api.delete(`/admin/curriculum/documents/${id}`),
};

export const tugasAPI = {
  getFilters: () => api.get('/teacher/tugas/filters'),
  getAll: (params) => api.get('/teacher/tugas', { params }),
  create: (data) => api.post('/teacher/tugas', data, data instanceof FormData ? {
    headers: { 'Content-Type': 'multipart/form-data' }
  } : undefined),
  update: (id, data) => api.post(`/teacher/tugas/${id}`, data, data instanceof FormData ? {
    headers: { 'Content-Type': 'multipart/form-data' }
  } : undefined), // using POST because form-data put might be tricky in Laravel without _method spoofing, wait, better to use POST and add _method='PUT' in FormData, but let's assume standard PUT for non-file or use post with _method spoofing for file uploads. Actually let's use post for update and we'll send _method='PUT'.
  delete: (id) => api.delete(`/teacher/tugas/${id}`),
  show: (id) => api.get(`/teacher/tugas/${id}`),
  getKoreksi: (id) => api.get(`/teacher/tugas/${id}/koreksi`),
  submitKoreksi: (id, data) => api.post(`/teacher/tugas/${id}/koreksi`, data),
  // Modul Kuis Guru (Fase 2/3) — Panel Kendali Sesi Guru.
  monitor: (id) => api.get(`/teacher/tugas/${id}/monitor`),
  previewToken: () => api.post('/teacher/tugas/preview-token'),
  regenerateToken: (id) => api.post(`/teacher/tugas/${id}/regenerate-token`),
  gradeSubmission: (id, submissionId, data) => api.post(`/teacher/tugas/${id}/submissions/${submissionId}/grade`, data),
};

export const bankSoalAPI = {
    getAll: (params) => api.get('/teacher/bank-soal', { params }),
    getFilters: () => api.get('/teacher/bank-soal/filters'),
    create: (data) => api.post('/teacher/bank-soal', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    update: (id, data) => api.post(`/teacher/bank-soal/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    delete: (id) => api.delete(`/teacher/bank-soal/${id}`),
    import: (data) => api.post('/teacher/bank-soal/import', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

export const studentAPI = {
  getDashboard: () => api.get('/student/dashboard'),
  getSchedule: () => api.get('/student/schedule'),
  joinClass: (kode_belajar) => api.post('/student/classes/join', { kode_belajar }),
  submitQuiz: (data) => api.post('/student/submissions/quiz', data),
  submitExamReview: (data) => api.post('/student/exam-reviews', data),
  uploadAssignment: (formData) => api.post('/student/submissions/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  submitTask: (taskId, formData) => api.post(`/student/tasks/${taskId}/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  // Modul Kuis Guru (Fase 3) — submit jawaban sesi guru (1-pintu teacher_quiz).
  submitCbt: (taskId, data) => api.post(`/student/tugas/${taskId}/submit-cbt`, data),
  startQuiz: (taskId) => api.post(`/student/tugas/${taskId}/start`),
  saveProgress: (taskId, data) => api.post(`/student/tugas/${taskId}/save-progress`, data),
  submitEssay: (taskId, formData) => api.post(`/student/tugas/${taskId}/submit-essay`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  confirmPayment: (formData) => api.post('/student/payments/confirm', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getMaterials: () => api.get('/student/materials'),
  getAttendance: (params) => api.get('/student/attendance', { params }),
  getActivities: (params) => api.get('/student/activities', { params }),
  ajukanPrestasi: (formData) => api.post('/student/activities/prestasi', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getRapor: (params) => api.get('/student/rapor', { params }),
  getRaporAnnual: (params) => api.get('/student/rapor/annual', { params }),
  getRaporTranscript: () => api.get('/student/rapor/transcript'),
  getPkl: () => api.get('/student/pkl'),
  storePklLogbook: (data) => api.post('/student/pkl/logbook', data),
  storePklLaporan: (formData) => api.post('/student/pkl/laporan', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getPklSertifikat: () => api.get('/student/pkl/sertifikat'),
};

export const cashierAPI = {
  getDashboard: () => api.get('/cashier/dashboard'),
  getHistory: (params) => api.get('/cashier/history', { params }),
  getClasses: () => api.get('/cashier/classes'),
  getBillingOptions: () => api.get('/cashier/billing-options'),
  searchStudents: (params) => api.get('/cashier/students', { params }),
  getStudentBilling: (studentId) => api.get(`/cashier/students/${studentId}`),
  exportDirectoryExcel: (params) => api.get('/cashier/students/export', { params, responseType: 'blob' }),
  downloadBillingTemplate: () => api.get('/cashier/billings/template', {
    responseType: 'blob'
  }),
  getBillings: (params) => api.get('/cashier/billings', { params }),
  createBillings: (formData) => api.post('/cashier/billings', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateBilling: (id, data) => api.put(`/cashier/billings/${id}`, data),
  deleteBilling: (id) => api.delete(`/cashier/billings/${id}`),
  createPosPayment: (data) => api.post('/cashier/payments/pos', data, data instanceof FormData ? {
    headers: { 'Content-Type': 'multipart/form-data' }
  } : undefined),
  getVerifications: (params) => api.get('/cashier/verifications', { params }),
  approveVerification: (submissionId, data) => api.post(`/cashier/verifications/${submissionId}/approve`, data),
  rejectVerification: (submissionId, data) => api.post(`/cashier/verifications/${submissionId}/reject`, data),
  // Kas Kecil (Petty Cash) — sistem baru
  getPettyCash: (params) => api.get('/cashier/petty-cash', { params }),
  createPettyCash: (data) => api.post('/cashier/petty-cash', data),
  updatePettyCash: (id, data) => api.put(`/cashier/petty-cash/${id}`, data),
  deletePettyCash: (id) => api.delete(`/cashier/petty-cash/${id}`),
  exportPettyCash: (params) => api.get('/cashier/petty-cash/export', { params, responseType: 'blob' }),
  // Buku Kas Umum - Dana Non-Siswa & Belanja Program
  getCashBook: (params) => api.get('/cashier/cash-book', { params }),
  exportCashBook: (params) => api.get('/cashier/cash-book/export', { params, responseType: 'blob' }),
  createCashBookEntry: (data) => api.post('/cashier/cash-book', data),
  updateCashBookEntry: (id, data) => api.put(`/cashier/cash-book/${id}`, data),
  deleteCashBookEntry: (id) => api.delete(`/cashier/cash-book/${id}`),
  // Tunggakan Siswa
  getArrears: (params) => api.get('/cashier/arrears', { params }),
  exportArrears: (params) => api.get('/cashier/arrears/export', { params, responseType: 'blob' }),
  sendArrearReminder: (data) => api.post('/cashier/arrears/send-reminder', data),
  // Legacy stubs — dipertahankan agar menu executive tidak crash (endpoint sudah tidak aktif)
  approveExpense: (transactionId, data) => api.post(`/cashier/expenses/${transactionId}/approve`, data),
  rejectExpense: (transactionId, data) => api.post(`/cashier/expenses/${transactionId}/reject`, data),
  getReports: (params) => api.get('/cashier/reports', { params }),
  exportFinancialReport: (params) => api.get('/cashier/reports/export', { params, responseType: 'blob' }),
  voidTransaction: (transactionId, data) => api.post(`/cashier/transactions/${transactionId}/void`, data),
  // Laporan Bulanan
  getMonthlyReports: () => api.get('/cashier/monthly-reports'),
  generateMonthlyReport: (data) => api.post('/cashier/monthly-reports/generate', data, { responseType: 'blob' }),
  downloadMonthlyReport: (id) => api.get(`/cashier/monthly-reports/${id}/download`, { responseType: 'blob' }),
  deleteMonthlyReport: (id) => api.delete(`/cashier/monthly-reports/${id}`),
};

export const examAPI = {
  previewDocx: (formData) => api.post('/exams/docx/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getQuestionBank: (params) => api.get('/exams/bank', { params }),
  getPaketSoalByCode: (code) => api.get(`/exams/code/${code}`),
  getPaketSoal: (id, params) => api.get(`/exams/${id}`, { params }),
  updatePaketSoal: (id, data) => api.put(`/exams/${id}`, data),
  deletePaketSoal: (id) => api.delete(`/exams/${id}`),
  updateQuestion: (id, data) => api.put(`/exams/questions/${id}`, data),
  deleteQuestion: (id) => api.delete(`/exams/questions/${id}`),
};

export const examSessionAPI = {
  getAll: () => api.get('/exam-sessions'),
  create: (data) => api.post('/exam-sessions', data),
  createFromDocx: (formData, onUploadProgress) => api.post('/exam-sessions/from-docx', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  }),
  update: (id, data) => api.put(`/exam-sessions/${id}`, data),
  remove: (id) => api.delete(`/exam-sessions/${id}`),
  generateToken: (id) => api.post(`/exam-sessions/${id}/token`),
  getActiveForStudent: () => api.get('/student/exam-sessions'),
  verifyStudentToken: (data) => api.post('/student/exams/verify-token', data),
  checkStudentToken: (data) => api.post('/student/exams/check-token', data),
  // Keamanan ujian CBT (murid) — konfigurasi Admin Akademik + attempt/lock nyata.
  getStudentExamSettings: () => api.get('/student/exam-settings'),
  startExam: (data) => api.post('/student/exam/start', data),
  getExamAttempt: (examId) => api.get(`/student/exam-attempt/${examId}`),
  autosaveExam: (examId, answers) => api.post(`/student/exam-attempt/${examId}/autosave`, { answers }),
  reportTabSwitch: (examId) => api.post(`/student/exam-attempt/${examId}/tab-switch`),
  lockExam: (examId, reason) => api.post(`/student/exam-attempt/${examId}/lock`, { reason }),
};

export const pusatJurusanAPI = {
  getJurusans: () => api.get('/pusat-jurusan/jurusans'),
  getMyJurusan: () => api.get('/pusat-jurusan/my-jurusan'),
  getStats: (id) => api.get(`/pusat-jurusan/stats/${id}`),
  getDashboardSummary: (id) => api.get(`/pusat-jurusan/dashboard-summary/${id}`),
  getSubjects: (id, tingkat = 'X') => api.get(`/pusat-jurusan/subjects/${id}`, { params: { tingkat } }),
  storeSubject: (jurusanId, data) => api.post(`/pusat-jurusan/subjects/${jurusanId}`, data),
  updateSubject: (jurusanId, id, data) => api.put(`/pusat-jurusan/subjects/${jurusanId}/${id}`, data),
  deleteSubject: (jurusanId, id) => api.delete(`/pusat-jurusan/subjects/${jurusanId}/${id}`),
  getSubjectDetail: (jurusanId, id) => api.get(`/pusat-jurusan/subjects/${jurusanId}/${id}/detail`),
  getCurriculumSummary: (jurusanId, tingkat = 'X') => api.get(`/pusat-jurusan/curriculum-summary/${jurusanId}`, { params: { tingkat } }),
  // Dokumen kurikulum (terisolasi per jurusan)
  getCurriculumDocuments: (jurusanId) => api.get(`/pusat-jurusan/curriculum-documents/${jurusanId}`),
  uploadCurriculumDocument: (jurusanId, formData) => api.post(`/pusat-jurusan/curriculum-documents/${jurusanId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteCurriculumDocument: (jurusanId, id) => api.delete(`/pusat-jurusan/curriculum-documents/${jurusanId}/${id}`),
  getStudents: (jurusanId) => api.get(`/pusat-jurusan/students/${jurusanId}`),
  // Nilai & Kejuruan: praktik/UKK + keuangan read-only
  getPraktikUkk: (jurusanId, tingkat) => api.get(`/pusat-jurusan/praktik-ukk/${jurusanId}`, { params: tingkat ? { tingkat } : {} }),
  savePraktikUkk: (jurusanId, data) => api.post(`/pusat-jurusan/praktik-ukk/${jurusanId}`, data),
  verifikasiPraktikUkk: (jurusanId, data) => api.post(`/pusat-jurusan/praktik-ukk/${jurusanId}/verifikasi`, data || {}),
  getBillingJurusan: (jurusanId, tingkat) => api.get(`/pusat-jurusan/billing/${jurusanId}`, { params: tingkat ? { tingkat } : {} }),
  getPklRecap: (jurusanId, tingkat) => api.get(`/pusat-jurusan/pkl-recap/${jurusanId}`, { params: tingkat ? { tingkat } : {} }),
  getInventory: (id) => api.get(`/pusat-jurusan/inventory/${id}`),
  updateInventory: (id, data) => api.put(`/pusat-jurusan/inventory/${id}`, data),
  getInventoryIssues: (id) => api.get(`/pusat-jurusan/inventory/${id}/issues`),
  updateInventoryIssueStatus: (issueId, data) => api.patch(`/pusat-jurusan/inventory-issue/${issueId}`, data),

  // Fasilitas Terpadu Pusat Jurusan (CRUD milik sendiri, read-only Fasilitas Umum)
  getFasilitas: () => api.get('/pusat-jurusan/fasilitas'),
  createFasilitasRoom: (data) => api.post('/pusat-jurusan/fasilitas/rooms', data),
  updateFasilitasRoom: (id, data) => api.patch(`/pusat-jurusan/fasilitas/rooms/${id}`, data),
  deleteFasilitasRoom: (id) => api.delete(`/pusat-jurusan/fasilitas/rooms/${id}`),
  createFasilitasInventory: (data) => api.post('/pusat-jurusan/fasilitas/inventories', data),
  updateFasilitasInventory: (id, data) => api.patch(`/pusat-jurusan/fasilitas/inventories/${id}`, data),
  deleteFasilitasInventory: (id) => api.delete(`/pusat-jurusan/fasilitas/inventories/${id}`),
  updateFasilitasStatus: (id, data) => api.patch(`/pusat-jurusan/fasilitas/assets/${id}/status`, data),
  createFasilitasBorrowing: (data) => api.post('/pusat-jurusan/fasilitas/borrowings', data),
  updateFasilitasBorrowingStatus: (id, data) => api.patch(`/pusat-jurusan/fasilitas/borrowings/${id}/status`, data),
  deleteFasilitasBorrowing: (id) => api.delete(`/pusat-jurusan/fasilitas/borrowings/${id}`),
  createFasilitasMaintenance: (data) => api.post('/pusat-jurusan/fasilitas/maintenances', data),
  updateFasilitasMaintenanceStatus: (id, data) => api.patch(`/pusat-jurusan/fasilitas/maintenances/${id}/status`, data),
  deleteFasilitasMaintenance: (id) => api.delete(`/pusat-jurusan/fasilitas/maintenances/${id}`),
  pinjamFasilitasUmum: (data) => api.post('/pusat-jurusan/fasilitas/umum/pinjam', data),
  kembalikanFasilitasPinjam: (id, data) => api.patch(`/pusat-jurusan/fasilitas/borrowings/${id}/kembalikan`, data || {}),
  getJournals: (id) => api.get(`/pusat-jurusan/journals/${id}`),
  getPendingSoals: (id) => api.get(`/pusat-jurusan/pending-soals/${id}`),
  getAchievements: (id, params) => api.get(`/pusat-jurusan/achievements/${id}`, { params }),
  getAchievementsSummary: (id) => api.get(`/pusat-jurusan/achievements/${id}/summary`),
  storeAchievement: (jurusanId, data) => api.post(`/pusat-jurusan/achievements/${jurusanId}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateAchievement: (jurusanId, id, data) => {
    // Because FormData with PUT can be tricky in PHP, sometimes POST with _method=PUT is used.
    // Assuming standard axios put for now, or FormData with _method if needed.
    data.append('_method', 'PUT');
    return api.post(`/pusat-jurusan/achievements/${jurusanId}/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteAchievement: (jurusanId, id) => api.delete(`/pusat-jurusan/achievements/${jurusanId}/${id}`),
  // Magang / PKL
  getMagangSiswa: (id, params) => api.get(`/pusat-jurusan/magang/${id}`, { params }),
  getMagangSummary: (id) => api.get(`/pusat-jurusan/magang/${id}/summary`),
  getSiswaKelasPkl: (id, kelasId) => api.get(`/pusat-jurusan/magang/${id}/siswa-kelas`, { params: { kelas_id: kelasId } }),
  getLaporanMagang: (id) => api.get(`/pusat-jurusan/magang/${id}/laporan`),
  storeMagangSiswa: (id, data) => api.post(`/pusat-jurusan/magang/${id}`, data),
  updateMagangSiswa: (id, magangId, data) => api.put(`/pusat-jurusan/magang/${id}/${magangId}`, data),
  deleteMagangSiswa: (id, magangId) => api.delete(`/pusat-jurusan/magang/${id}/${magangId}`),
  sendPengingatLaporan: (id, data) => api.post(`/pusat-jurusan/magang/${id}/pengingat`, data),
  // PKL end-to-end (Langkah 2)
  getGuruJurusan: (id) => api.get(`/pusat-jurusan/magang/${id}/guru`, { params: { _cb: Date.now() } }),
  getPklDetail: (id, pklId) => api.get(`/pusat-jurusan/magang/${id}/${pklId}`),
  verifyLaporanMagang: (id, laporanId) => api.post(`/pusat-jurusan/magang/${id}/laporan/${laporanId}/verifikasi`),
  storePenilaianMagang: (id, pklId, data) => api.post(`/pusat-jurusan/magang/${id}/${pklId}/penilaian`, data),
  finalisasiPkl: (id, pklId) => api.post(`/pusat-jurusan/magang/${id}/${pklId}/finalisasi`),
  terbitkanSertifikat: (id, pklId) => api.post(`/pusat-jurusan/magang/${id}/${pklId}/sertifikat`),
  saveLastJurusan: (data) => api.post('/pusat-jurusan/save-last-jurusan', data),
  validateSoal: (id, status) => api.post(`/pusat-jurusan/soals/${id}/validate`, { status }),
  addFeedback: (id, feedback) => api.post(`/pusat-jurusan/journals/${id}/feedback`, { feedback }),
  addInventoryItem: (data) => api.post('/pusat-jurusan/inventory', data),
  reportInventoryIssue: (data) => api.post('/pusat-jurusan/inventory/report-issue', data),
  clearAllInventory: () => api.delete('/pusat-jurusan/inventory/clear-all'),
  deleteInventoryItem: (id) => api.delete(`/pusat-jurusan/inventory/${id}`),
  clearInventory: (jurusanId) => api.delete(`/pusat-jurusan/inventory/clear/${jurusanId}`),
  updateInventoryStatus: (id, status) => api.patch(`/pusat-jurusan/inventory/${id}/condition`, { condition: status }),
  // Verifikasi Nilai endpoints
  getVerifikasiNilai: (jurusanId, params) => api.get(`/pusat-jurusan/verifikasi-nilai/${jurusanId}`, { params }),
  getRingkasanVerifikasiNilai: (jurusanId) => api.get(`/pusat-jurusan/verifikasi-nilai/${jurusanId}/ringkasan`),
  getCatatanVerifikasi: (jurusanId) => api.get(`/pusat-jurusan/verifikasi-nilai/${jurusanId}/catatan`),
  getFilterOptionsVerifikasi: (jurusanId) => api.get(`/pusat-jurusan/verifikasi-nilai/${jurusanId}/filter-options`),
  approveSemuaVerifikasiNilai: (jurusanId) => api.post(`/pusat-jurusan/verifikasi-nilai/${jurusanId}/approve-all`),
  approveVerifikasiNilai: (jurusanId, id) => api.post(`/pusat-jurusan/verifikasi-nilai/${jurusanId}/${id}/approve`),
  kirimCatatanVerifikasi: (jurusanId, id, data) => api.post(`/pusat-jurusan/verifikasi-nilai/${jurusanId}/${id}/catatan`, data),
  // Monitoring KBM endpoints
  getMonitoringKBM: (jurusanId, params = {}) => api.get(`/pusat-jurusan/monitoring/${jurusanId}`, { params }),
  getJurnalRiwayat: (jurusanId, params = {}) => api.get(`/pusat-jurusan/monitoring/${jurusanId}/riwayat`, { params }),
  // Plotting endpoints
  getPlottingKelas: (jurusanId) => api.get(`/pusat-jurusan/plotting/${jurusanId}/kelas`),
  getPlottingJadwalJurusan: (jurusanId) => api.get(`/pusat-jurusan/plotting/${jurusanId}/jadwal`),
  getPlottingMapel: (jurusanId, kelasId) => api.get(`/pusat-jurusan/plotting/${jurusanId}/mapel`, { params: { kelas_id: kelasId } }),
  getPlottingGuru: (jurusanId, mapelId) => api.get(`/pusat-jurusan/plotting/${jurusanId}/guru`, { params: { mapel_id: mapelId } }),
  storePlotting: (jurusanId, data) => api.post(`/pusat-jurusan/plotting/${jurusanId}`, data),
  deletePlotting: (jurusanId, jadwalId) => api.delete(`/pusat-jurusan/plotting/${jurusanId}/${jadwalId}`),
};

export const calendarAPI = {
  getCalendar: () => api.get('/academic-calendar'),
  listTerms: () => api.get('/academic-calendar/list'),
  previewCalendar: () => api.get('/academic-calendar/file', {
    responseType: 'blob'
  }),
  saveCalendar: (formData) => api.post('/academic-calendar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteCalendar: (data) => api.delete('/academic-calendar', data ? { data } : undefined),

  // Manual Events
  getEvents: () => api.get('/academic-calendar/events'),
  storeEvent: (data) => api.post('/academic-calendar/events', data),
  deleteEvent: (id) => api.delete(`/academic-calendar/events/${id}`),
};

// Direktori & Cetak Transkrip Alumni (riil, tanpa dummy)
export const alumniAPI = {
  // search: { search, jurusan, tahun_lulus, per_page }
  list: (params) => api.get('/alumni', { params }),
  getTranscript: (id) => api.get(`/alumni/${id}/transcript`),
  updateAchievements: (id, data) => api.put(`/alumni/${id}/achievements`, data),
};

export const informationCenterAPI = {
    getAll: (params) => api.get('/information-center', { params }),
    getInfos: (params) => api.get('/information-center', { params }),
    getUnreadCount: () => api.get('/information-center/unread-count'),
    getManageInfos: (params) => api.get('/information-center/manage', { params }),
    getStats: () => api.get('/information-center/stats'),
    markAsRead: (id) => api.post(`/information-center/${id}/read`),
    storeInfo: (formData) => api.post('/information-center', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    updateInfo: (id, formData) => api.post(`/information-center/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    archiveInfo: (id) => api.post(`/information-center/${id}/archive`),
    deleteInfo: (id) => api.delete(`/information-center/${id}`),
};

export const pesanUserAPI = {
  getInbox: () => api.get('/pesan-user/inbox'),
  getSent: () => api.get('/pesan-user/sent'),
  send: (data) => {
    if (data instanceof FormData) {
      return api.post('/pesan-user', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.post('/pesan-user', data);
  },
  markRead: (id) => api.post(`/pesan-user/${id}/read`),
  deleteMessage: (id) => api.delete(`/pesan-user/${id}`),
  getUnreadCount: () => api.get('/pesan-user/unread-count'),
  searchUsers: () => api.get('/pesan-user/search-users'),
  getConversations: () => api.get('/pesan-user/conversations'),
  getConversation: (contactId) => api.get(`/pesan-user/conversation/${contactId}`),
  deleteConversation: (contactId) => api.delete(`/pesan-user/conversation/${contactId}`),
  reply: (data) => {
    if (data instanceof FormData) {
      return api.post('/pesan-user/reply', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.post('/pesan-user/reply', data);
  },
};

export const systemAPI = {
  getSettings: () => api.get('/operator/system/settings'),
  updateSleep: (data) => api.post('/operator/system/sleep', data),
  toggleMaintenance: (data) => api.post('/operator/system/maintenance', data),
  triggerCleaning: (data) => api.post('/operator/system/cleaning', data),
  getCleaningStatus: () => api.get('/operator/system/cleaning-status'),
};

export default api;
