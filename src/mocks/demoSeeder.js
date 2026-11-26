// Central demo seeder. Builds a realistic, interconnected dataset for every
// module and writes it into localStorage under the `demo:` namespace.
//
//   ensureSeeded()  -> idempotent: seeds once, or re-seeds when SEED_VERSION changes.
//   resetDemoData() -> wipes all demo collections + session, then re-seeds.
//
// Accounts are taken from "Tutorial dan Data User.md" (the single source of truth
// for the original project) so the demo matches the documented credentials.

import { KEYS, write, read, wipeAll, dayOffset, monthAgoLabel, nowIso } from './db';

export const SEED_VERSION = '2026-11-26-2';

const SCHOOL = 'SMK Cerdas Satu Bangsa';
const ACADEMIC_YEAR = '2026/2027';
const SEMESTER = 'Ganjil';

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const JURUSANS = [
  { id: 1, name: 'Rekayasa Perangkat Lunak', code: 'RPL', head_user_id: 6001, head_name: 'Hendra Sanjaya' },
  { id: 2, name: 'Teknik Komputer & Jaringan', code: 'TKJ', head_user_id: 6001, head_name: 'Hendra Sanjaya' },
  { id: 3, name: 'Multimedia', code: 'MM', head_user_id: 6001, head_name: 'Hendra Sanjaya' },
];

const SUBJECTS = [
  { id: 1, nama: 'Matematika', kode: 'MTK', kelompok: 'Umum', jam_per_minggu: 4 },
  { id: 2, nama: 'Bahasa Indonesia', kode: 'BIND', kelompok: 'Umum', jam_per_minggu: 4 },
  { id: 3, nama: 'Bahasa Inggris', kode: 'BING', kelompok: 'Umum', jam_per_minggu: 3 },
  { id: 4, nama: 'Informatika', kode: 'INF', kelompok: 'Dasar Jurusan', jam_per_minggu: 5 },
  { id: 5, nama: 'Basis Data', kode: 'BD', kelompok: 'Kejuruan', jam_per_minggu: 6 },
  { id: 6, nama: 'Pemrograman Web', kode: 'PW', kelompok: 'Kejuruan', jam_per_minggu: 8 },
  { id: 7, nama: 'Jaringan Komputer', kode: 'JARKOM', kelompok: 'Kejuruan', jam_per_minggu: 6 },
  { id: 8, nama: 'Produktif RPL', kode: 'PRPL', kelompok: 'Kejuruan', jam_per_minggu: 10 },
  { id: 9, nama: 'PPKn', kode: 'PPKn', kelompok: 'Umum', jam_per_minggu: 2 },
  { id: 10, nama: 'Sejarah', kode: 'SEJ', kelompok: 'Umum', jam_per_minggu: 2 },
];

const TEACHERS = [
  { id: 3001, name: 'Budi Santoso', mapel: 'Informatika', subject_id: 4, homeroom_class: 1 },
  { id: 3002, name: 'Putri Widya', mapel: 'Matematika', subject_id: 1, homeroom_class: 3 },
  { id: 3003, name: 'Siti Aminah', mapel: 'Bahasa Indonesia', subject_id: 2, homeroom_class: 2 },
  { id: 3004, name: 'Dedi Kurnia', mapel: 'Jaringan Komputer', subject_id: 7, homeroom_class: 5 },
  { id: 3005, name: 'Rina Melati', mapel: 'Basis Data', subject_id: 5, homeroom_class: 6 },
  { id: 3006, name: 'Yanto Pratama', mapel: 'Produktif RPL', subject_id: 8, homeroom_class: 4 },
];

const CLASSES = [
  { id: 1, name: 'X RPL 1', tingkat: 'X', jurusan: 'RPL', jurusan_id: 1 },
  { id: 2, name: 'X RPL 2', tingkat: 'X', jurusan: 'RPL', jurusan_id: 1 },
  { id: 3, name: 'XI RPL 1', tingkat: 'XI', jurusan: 'RPL', jurusan_id: 1 },
  { id: 4, name: 'XII RPL 1', tingkat: 'XII', jurusan: 'RPL', jurusan_id: 1 },
  { id: 5, name: 'X TKJ 1', tingkat: 'X', jurusan: 'TKJ', jurusan_id: 2 },
  { id: 6, name: 'XI TKJ 1', tingkat: 'XI', jurusan: 'TKJ', jurusan_id: 2 },
  { id: 7, name: 'XII MM 1', tingkat: 'XII', jurusan: 'MM', jurusan_id: 3 },
];

const STUDENT_FIRST = ['Agus', 'Dewi', 'Rizky', 'Nur', 'Fajar', 'Lestari', 'Bagas', 'Citra', 'Doni', 'Eka',
  'Fitri', 'Galih', 'Hana', 'Irfan', 'Joko', 'Kirana', 'Lukman', 'Maya', 'Naufal', 'Oktavia'];
const STUDENT_LAST = ['Sari', 'Wijaya', 'Pratama', 'Hidayat', 'Ramadhan', 'Anggraini', 'Setiawan', 'Permana',
  'Nugroho', 'Lestari', 'Maulana', 'Saputra', 'Rahayu', 'Firmansyah', 'Kusuma'];

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildStaffUsers() {
  return [
    {
      id: 9324, name: 'Super Admin Operator', school_id: 'superadmin@164990', username: 'superadmin@164990',
      email: 'superadmin@smkcerdasbangsa.sch.id', password: 'Super!138.', access_role: 'operator', role: 'operator',
      role_name: 'Super Admin - Operator', position_status: 'tetap', is_active: true, nisn_nip: '199001012020011001',
      joined_at: '2020-01-01', class_name: null,
    },
    {
      id: 1002, name: 'Randy Asha', school_id: 'randyasha@000058', username: 'randyasha@000058',
      email: 'randy.asha@smkcerdasbangsa.sch.id', password: 'Super!140.', access_role: 'admin_akademik', role: 'admin_akademik',
      role_name: 'Admin Akademik - Operator', position_status: 'tetap', is_active: true, nisn_nip: '199202022021122001',
      joined_at: '2021-02-01', class_name: null,
    },
    {
      id: 4001, name: 'Ahmad JKK', school_id: 'ahmadjkk@000055', username: 'ahmadjkk@000055',
      email: 'ahmad.jkk@smkcerdasbangsa.sch.id', password: 'Adhmad123_', access_role: 'cashier', role: 'cashier',
      role_name: 'Kasir', position_status: 'tetap', is_active: true, nisn_nip: '198803032019031002', joined_at: '2019-03-01', class_name: null,
    },
    {
      id: 5001, name: 'Muhtadin', school_id: 'muhtadinn@000053', username: 'muhtadinn@000053',
      email: 'muhtadin@smkcerdasbangsa.sch.id', password: 'Muhtadin123_', access_role: 'kepala_sekolah', role: 'kepala_sekolah',
      role_name: 'Kepala Sekolah', position_status: 'tetap', is_active: true, nisn_nip: '197504042010011003', joined_at: '2010-04-01', class_name: null,
    },
    {
      id: 5002, name: 'Elina Ph', school_id: 'elinaph@000054', username: 'elinaph@000054',
      email: 'elina.ph@smkcerdasbangsa.sch.id', password: 'Elina123_', access_role: 'wakil_sekolah', role: 'wakil_sekolah',
      role_name: 'Wakil Kepala Sekolah', position_status: 'tetap', is_active: true, nisn_nip: '198205052015021004', joined_at: '2015-05-01',
      executive_scope: 'kurikulum', class_name: null,
    },
    {
      id: 6001, name: 'Hendra Sanjaya', school_id: 'hendrasanjaya@000059', username: 'hendrasanjaya@000059',
      email: 'hendra.sanjaya@smkcerdasbangsa.sch.id', password: 'Hendra123_', access_role: 'pusat_jurusan', role: 'pusat_jurusan',
      role_name: 'Pusat Jurusan', position_status: 'tetap', is_active: true, nisn_nip: '198506062012031005', joined_at: '2012-06-01',
      jurusan_id: 1, class_name: null,
    },
    {
      id: 7001, name: 'Farhan Laburehia', school_id: 'farhanlaburehia@000065', username: 'farhanlaburehia@000065',
      email: 'farhan.laburehia@smkcerdasbangsa.sch.id', password: 'Farhan123_', access_role: 'magang', role: 'magang',
      role_name: 'Magang', position_status: 'magang', is_active: true, nisn_nip: '200207072025071006', joined_at: '2025-07-01',
      contract_end_date: dayOffset(120),
      magang: { penempatan_di: 'PT Digital Nusantara', pembimbing_id: 3001, tanggal_mulai: dayOffset(-60), tanggal_selesai: dayOffset(120), status: 'aktif', catatan_super_admin: 'Peserta magang bidang front-end.' },
      class_name: null,
    },
    {
      id: 7002, name: 'Bagus Setiawan', school_id: 'bagussetiawan@000063', username: 'bagussetiawan@000063',
      email: 'bagus.setiawan@smkcerdasbangsa.sch.id', password: 'Bagus123_', access_role: 'honorer', role: 'honorer',
      role_name: 'Honorer', position_status: 'honorer', is_active: true, nisn_nip: '199808082024081007', joined_at: '2024-08-01',
      contract_end_date: dayOffset(200),
      honorer: { penempatan_di: 'Lab Komputer', penanggung_jawab_id: 3001, kontrak_mulai: dayOffset(-200), kontrak_selesai: dayOffset(200), status: 'aktif', catatan_super_admin: 'Staf honorer laboratorium.' },
      class_name: null,
    },
  ];
}

function buildTeacherUsers() {
  // Tutorial credentials for the two named teachers; others get generic demo logins.
  const credMap = {
    3001: { school_id: 'budisantoso@000040', password: 'Budi123_' },
    3002: { school_id: 'putriwidya@000064', password: 'PutriW12_' },
  };
  return TEACHERS.map((t, i) => {
    const cred = credMap[t.id] || { school_id: `guru${t.id}@000000`, password: 'Guru123_' };
    return {
      id: t.id, name: t.name, school_id: cred.school_id, username: cred.school_id,
      email: `${t.name.toLowerCase().replace(/\s+/g, '.')}@smkcerdasbangsa.sch.id`, password: cred.password,
      access_role: 'guru', role: 'guru', role_name: 'Guru', position_status: 'tetap', is_active: true,
      nisn_nip: `1990010${(i + 1)}201801100${i + 1}`, joined_at: '2018-07-01',
      subject_name: t.mapel, subject_id: t.subject_id,
      isHomeroomTeacher: Boolean(t.homeroom_class), homeroom_class_id: t.homeroom_class || null,
      class_name: t.homeroom_class ? (CLASSES.find((c) => c.id === t.homeroom_class) || {}).name : null,
    };
  });
}

function buildStudents() {
  const students = [];
  let id = 2001;
  let n = 0;
  const perClass = { 1: 10, 2: 8, 3: 8, 4: 7, 5: 8, 6: 7, 7: 6 };
  CLASSES.forEach((cls) => {
    const count = perClass[cls.id] || 6;
    for (let i = 0; i < count; i += 1) {
      const first = STUDENT_FIRST[n % STUDENT_FIRST.length];
      const last = STUDENT_LAST[(n * 3 + i) % STUDENT_LAST.length];
      const name = `${first} ${last}`;
      const isAgus = id === 2001;
      students.push({
        id,
        name: isAgus ? 'Agus Sari' : name,
        school_id: isAgus ? 'agussari@0028' : `siswa${id}@000000`,
        username: isAgus ? 'agussari@0028' : `siswa${id}@000000`,
        email: isAgus ? 'agussari@smkcerdasbangsa.sch.id' : `siswa${id}@smkcerdasbangsa.sch.id`,
        password: isAgus ? 'Agussari123_' : 'Murid123_',
        access_role: 'murid', role: 'murid', role_name: 'Murid', position_status: null, is_active: true,
        nisn: `100000${String(id).padStart(4, '0')}`,
        nisn_nip: `100000${String(id).padStart(4, '0')}`,
        kelas_id: cls.id, class_name: cls.name, jurusan: cls.jurusan,
        gender: i % 2 === 0 ? 'L' : 'P',
        ttl: `${['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Semarang'][i % 5]}, ${2009 + (cls.tingkat === 'X' ? 1 : cls.tingkat === 'XI' ? 0 : -1)}-0${(i % 9) + 1}-15`,
      });
      id += 1;
      n += 1;
    }
  });
  return students;
}

// ---------------------------------------------------------------------------

function buildClasses(students) {
  return CLASSES.map((c) => {
    const members = students.filter((s) => s.kelas_id === c.id);
    const homeroom = TEACHERS.find((t) => t.homeroom_class === c.id);
    return {
      id: c.id, nama: c.name, name: c.name, tingkat: c.tingkat, jurusan: c.jurusan, jurusan_id: c.jurusan_id,
      kapasitas: 36, homeroom_teacher_id: homeroom ? homeroom.id : null,
      homeroom_teacher_name: homeroom ? homeroom.name : null,
      semester: SEMESTER, tahun_ajaran: ACADEMIC_YEAR, academic_year: ACADEMIC_YEAR,
      student_ids: members.map((m) => m.id),
    };
  });
}

function buildTeacherSubjects() {
  const rows = [];
  let id = 1;
  TEACHERS.forEach((t) => {
    // each teacher teaches their subject in 3 classes
    CLASSES.slice(0, 3).forEach((c, ci) => {
      rows.push({
        id: id++, guru_id: t.id, guru_nama: t.name, subject_id: t.subject_id, mata_pelajaran: t.mapel,
        kelas_id: c.id, kelas_nama: c.name, hari: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'][ci % 5],
        jam: '07:30 - 09:00', tahun_ajaran: ACADEMIC_YEAR, semester: SEMESTER, kategori_jadwal: 'Wajib',
        ruang: `R. ${c.name}`, kode_belajar: `KB${c.id}${t.subject_id}`,
      });
    });
  });
  return rows;
}

function buildQuestions() {
  // Official CBT paket (id 1) — 10 pilihan ganda A–E. Field names match StudentExamRunner:
  // {id, paket_soal_id, teks, pilihan:{A..E}, kunci}
  const topics = [
    ['Apa kepanjangan dari HTML?', { A: 'Hyper Text Markup Language', B: 'High Text Machine Language', C: 'Hyperlinks and Text Markup Language', D: 'Home Tool Markup Language', E: 'Hyper Tool Multi Language' }, 'A'],
    ['Tag HTML untuk membuat tautan adalah?', { A: '<link>', B: '<a>', C: '<href>', D: '<url>', E: '<nav>' }, 'B'],
    ['CSS digunakan untuk?', { A: 'Struktur data', B: 'Manipulasi basis data', C: 'Mengatur tampilan/gaya halaman', D: 'Server scripting', E: 'Query jaringan' }, 'C'],
    ['Manakah yang BUKAN tipe data JavaScript?', { A: 'string', B: 'number', C: 'boolean', D: 'char', E: 'undefined' }, 'D'],
    ['Perintah Git untuk mengirim commit ke remote adalah?', { A: 'git pull', B: 'git push', C: 'git commit', D: 'git fetch', E: 'git merge' }, 'B'],
    ['Basis data relasi menyimpan data dalam bentuk?', { A: 'Dokumen', B: 'Grafik', C: 'Tabel', D: 'Key-value', E: 'Kolom keluarga' }, 'C'],
    ['SQL untuk mengambil data dari tabel adalah?', { A: 'INSERT', B: 'UPDATE', C: 'DELETE', D: 'SELECT', E: 'ALTER' }, 'D'],
    ['Protokol untuk mengirim email adalah?', { A: 'HTTP', B: 'FTP', C: 'SMTP', D: 'SSH', E: 'DNS' }, 'C'],
    ['Algoritma sorting dengan kompleksitas rata-rata O(n log n)?', { A: 'Bubble Sort', B: 'Merge Sort', C: 'Selection Sort', D: 'Insertion Sort', E: 'Linear Search' }, 'B'],
    ['Singkatan dari API adalah?', { A: 'Application Programming Interface', B: 'Applied Program Integration', C: 'Automated Process Input', D: 'Advanced Protocol Index', E: 'Application Process Interaction' }, 'A'],
  ];
  return topics.map((t, i) => ({
    id: i + 1, paket_soal_id: 1, no: i + 1, teks: t[0], pilihan: t[1], pilihan_gambar: {}, gambar: null, kunci: t[2],
  }));
}

function buildPaketSoal() {
  return [
    {
      id: 1, title: 'Penilaian Harian Informatika', judul: 'Penilaian Harian Informatika',
      description: 'Soal PH Informatika kelas X RPL — 10 butir pilihan ganda.',
      subject: 'Informatika', mapel: 'Informatika', class_name: 'X RPL 1', kelas: 'X RPL 1', school_class_id: 1,
      question_format: 'pilihan_ganda', soals_count: 10, jumlah_soal: 10, type_label: 'Pilihan Ganda',
      is_active: true, exam_code: 'CBT8H2K4', delivery_mode: 'realtime', duration_minutes: 60,
      show_score: true, created_by: 'Budi Santoso', created_at: dayOffset(-3),
    },
    {
      id: 2, title: 'Bank Soal Esai Basis Data', judul: 'Bank Soal Esai Basis Data',
      description: 'Kumpulan soal esai Basis Data untuk kelas XI.',
      subject: 'Basis Data', mapel: 'Basis Data', class_name: 'XI RPL 1', kelas: 'XI RPL 1', school_class_id: 3,
      question_format: 'esai', soals_count: 5, jumlah_soal: 5, type_label: 'Esai',
      is_active: true, exam_code: 'ESAI-BD', delivery_mode: 'deadline', duration_minutes: 120,
      show_score: true, created_by: 'Rina Melati', created_at: dayOffset(-10),
    },
  ];
}

function buildExamSessions() {
  return [
    {
      id: 1, nama: 'Penilaian Harian Informatika', mapel: 'Informatika', target: 'X RPL 1',
      kelas_id: 1, subject_id: 4, paket_soal_id: 1, show_score: true, jenis: 'cbt', exam_type: 'cbt',
      token: 'CBT8H2K4', duration_minutes: 60, end_time: dayOffset(2) + 'T18:00:00', status: 'aktif',
    },
  ];
}

function buildTasks() {
  // Teacher tasks surfaced in StudentDashboard.evaluations.upload_tasks and
  // teacher Tugas list. mode_soal: 'cbt_docx' | 'esai_pdf' | null.
  return [
    {
      id: 101, judul: 'Kuis Pemrograman Web', title: 'Kuis Pemrograman Web', school_class_id: 1,
      subject_id: 6, kelas_nama: 'X RPL 1', mapel_nama: 'Pemrograman Web', mode_soal: 'cbt_docx',
      deskripsi: 'Kuis singkat seputar HTML/CSS.', bobot: 20, token_akses: 'WEBQ01',
      starts_at: dayOffset(-1) + 'T08:00:00', deadline_at: dayOffset(3) + 'T23:59:00', duration_minutes: 30,
      acak_soal: false, tampilkan_nilai: true, izinkan_ketik: true, izinkan_upload_foto: false,
      total_poin: 100, created_by: 'Budi Santoso', display_status: 'Aktif',
      // teacher-quiz CBT questions (fields match TeacherQuizWorkspaceModal): text/options/option_images
      questions: [
        { id: 1, no: 1, text: 'Properti CSS untuk warna teks adalah?', options: { A: 'color', B: 'text-color', C: 'font-color', D: 'textstyle', E: 'bgcolor' }, option_images: {}, image_url: null, kunci: 'A' },
        { id: 2, no: 2, text: 'Elemen HTML semantik untuk navigasi?', options: { A: '<div>', B: '<nav>', C: '<span>', D: '<section>', E: '<header>' }, option_images: {}, image_url: null, kunci: 'B' },
        { id: 3, no: 3, text: 'Unit relatif terhadap ukuran font root?', options: { A: 'px', B: 'em', C: 'rem', D: 'pt', E: 'cm' }, option_images: {}, image_url: null, kunci: 'C' },
        { id: 4, no: 4, text: 'Pseudo-class untuk elemen saat disorot kursor?', options: { A: ':active', B: ':focus', C: ':hover', D: ':visited', E: ':target' }, option_images: {}, image_url: null, kunci: 'C' },
        { id: 5, no: 5, text: 'Flexbox: properti untuk sumbu utama?', options: { A: 'align-items', B: 'justify-content', C: 'flex-wrap', D: 'order', E: 'gap' }, option_images: {}, image_url: null, kunci: 'B' },
      ],
      pdf_url: null, soal_pdf_api_url: null,
    },
    {
      id: 102, judul: 'Tugas Esai: Analisis Basis Data', title: 'Tugas Esai: Analisis Basis Data', school_class_id: 1,
      subject_id: 5, kelas_nama: 'X RPL 1', mapel_nama: 'Basis Data', mode_soal: 'esai_pdf',
      deskripsi: 'Baca lembar soal PDF lalu jawab menggunakan rich text editor atau unggah foto.',
      bobot: 30, token_akses: 'ESAI01', starts_at: dayOffset(-2) + 'T08:00:00', deadline_at: dayOffset(5) + 'T23:59:00',
      duration_minutes: 90, acak_soal: false, tampilkan_nilai: true, izinkan_ketik: true, izinkan_upload_foto: true,
      total_poin: 100, created_by: 'Rina Melati', display_status: 'Aktif',
      questions: [], pdf_url: '/demo-soal-esai.pdf', soal_pdf_api_url: '',
    },
    {
      id: 103, judul: 'Tugas Mandiri Matematika', title: 'Tugas Mandiri Matematika', school_class_id: 1,
      subject_id: 1, kelas_nama: 'X RPL 1', mapel_nama: 'Matematika', mode_soal: null,
      deskripsi: 'Kerjakan soal latihan bab 2 dan unggah foto pekerjaan.', bobot: 10,
      deadline_at: dayOffset(4) + 'T23:59:00', starts_at: dayOffset(-3) + 'T08:00:00', duration_minutes: 0,
      tampilkan_nilai: true, total_poin: 100, created_by: 'Putri Widya', display_status: 'Aktif', questions: [],
    },
  ];
}

function buildSubmissions(students) {
  // Pre-existing submissions so teacher grading + student leaderboard have data.
  const c1 = students.filter((s) => s.kelas_id === 1);
  const rows = [];
  let sid = 5001;
  // CBT task 101 — several students submitted with scores.
  const cbtScores = [90, 80, 100, 70, 60];
  c1.slice(1, 6).forEach((s, i) => {
    rows.push({
      id: sid++, task_id: 101, siswa_id: s.id, name: s.name, nisn: s.nisn, state: 'selesai',
      nilai_cbt: cbtScores[i % cbtScores.length], feedback: i % 2 === 0 ? 'Kerja bagus!' : null,
      poin_diperoleh: cbtScores[i % cbtScores.length], total_poin: 100, submitted_at: dayOffset(-1) + 'T10:00:00',
      jawaban_teks: null,
    });
  });
  // Essay task 102 — a couple submitted awaiting grading.
  rows.push({
    id: sid++, task_id: 102, siswa_id: c1[1].id, name: c1[1].name, nisn: c1[1].nisn, state: 'selesai',
    nilai_esai: null, feedback: null, poin_diperoleh: null, total_poin: 100, submitted_at: dayOffset(0) + 'T09:30:00',
    jawaban_teks: '<p>Normalisasi 1NF menghilangkan grup berulang pada tabel.</p>',
  });
  return rows;
}

function buildBillings(students) {
  const rows = [];
  let id = 7001;
  const months = ['Juli', 'Agustus', 'September'];
  students.forEach((s, idx) => {
    months.forEach((m, mi) => {
      // deterministic status: most lunas, some belum_bayar / proses
      let status = 'lunas';
      if (idx % 7 === 3) status = 'belum_bayar';
      if (idx % 11 === 5) status = 'proses_verifikasi';
      if (idx % 13 === 9) status = 'ditolak';
      // Agus (the demo student) gets a mix so the finance page is interesting
      if (s.id === 2001) status = mi === 0 ? 'lunas' : mi === 1 ? 'belum_bayar' : 'proses_verifikasi';
      const amount = 350000;
      const paid = status === 'lunas' ? amount : 0;
      rows.push({
        id: id++, student_id: s.id, title: `SPP ${m} ${ACADEMIC_YEAR}`, bill_code: `SPP-${s.id}-${mi + 1}`,
        category: 'SPP', base_amount: amount, amount, discount_amount: 0, subsidy_type: null, discount_note: null,
        paid_amount: paid, remaining_amount: amount - paid, due_date: dayOffset(-30 + mi * 30),
        status, created_at: dayOffset(-60 + mi * 30),
      });
    });
  });
  return rows;
}

function buildPayments(students) {
  const rows = [];
  const methods = ['cash', 'qris', 'transfer', 'beasiswa'];
  const channels = ['Tunai', 'QRIS Bank', 'Transfer Virtual Account', 'Beasiswa'];
  let id = 9001;
  for (let i = 0; i < 40; i += 1) {
    const s = students[i % students.length];
    const mi = i % 4;
    rows.push({
      id: id++, receipt_code: `RCT-${9000 + i}`, transaction_code: `TRX-${120000 + i}`,
      student_id: s.id, student_name: s.name, class_name: s.class_name,
      title: `SPP ${['Juli', 'Agustus', 'September'][i % 3]} ${ACADEMIC_YEAR}`, category: 'SPP',
      amount: 350000, payment_method: methods[mi], channel: channels[mi],
      transaction_date: dayOffset(-(i % 28)), status: 'approved', petugas: 'Ahmad JKK',
      cash_received: methods[mi] === 'cash' ? 400000 : null, change_amount: methods[mi] === 'cash' ? 50000 : null,
    });
  }
  return rows;
}

function buildVerifications(students) {
  const c1 = students.filter((s) => s.kelas_id === 1);
  return [
    { id: 1, student_id: c1[0].id, student_name: c1[0].name, amount: 350000, payment_method: 'transfer',
      status: 'proses_verifikasi', proof_name: 'bukti-transfer.jpg', proof_url: '/storage/proof-1.jpg',
      student_note: 'Transfer via VA, mohon diverifikasi.', submitted_at: dayOffset(0) + 'T08:15:00' },
    { id: 2, student_id: c1[1] ? c1[1].id : c1[0].id, student_name: (c1[1] || c1[0]).name, amount: 350000, payment_method: 'qris',
      status: 'proses_verifikasi', proof_name: 'qr-bayar.png', proof_url: '/storage/proof-2.png',
      student_note: 'QRIS berhasil.', submitted_at: dayOffset(0) + 'T09:40:00' },
  ];
}

function buildPettyCash() {
  return [
    { id: 1, transaction_date: dayOffset(-2), transaction_code: 'KK-001', description: 'Pembelian ATK Lab', type: 'expense', amount: 250000, balance_after: 1750000, petugas: 'Ahmad JKK', notes: 'Kertas, tinta printer.' },
    { id: 2, transaction_date: dayOffset(-5), transaction_code: 'KK-002', description: 'Setoran dana BOS tahap 2', type: 'income', amount: 2000000, balance_after: 2000000, petugas: 'Ahmad JKK', notes: '' },
    { id: 3, transaction_date: dayOffset(-9), transaction_code: 'KK-003', description: 'Konsumsi rapat guru', type: 'expense', amount: 400000, balance_after: 500000, petugas: 'Ahmad JKK', notes: '' },
  ];
}

function buildCashBook() {
  return [
    { id: 1, transaction_date: dayOffset(-15), description: 'Sumbangan komite', category: 'Dana Non-Siswa', type: 'income', amount: 5000000, source: 'Komite', petugas: 'Ahmad JKK' },
    { id: 2, transaction_date: dayOffset(-12), description: 'Belanja perangkat jaringan', category: 'Belanja Program', type: 'expense', amount: 3200000, source: 'Program TKJ', petugas: 'Ahmad JKK' },
    { id: 3, transaction_date: dayOffset(-6), description: 'Pemasukan kantin sekolah', category: 'Dana Non-Siswa', type: 'income', amount: 1500000, source: 'Kantin', petugas: 'Ahmad JKK' },
  ];
}

function buildMaterials() {
  return [
    { id: 1, judul: 'Pengantar Algoritma', kategori: 'Modul', topik: 'Flowchart & Pseudocode', kelas_id: 1, mapel_id: 4, file_name: 'modul-algoritma.pdf', file_type: 'pdf', file_size: '1.2 MB', created_at: dayOffset(-20) },
    { id: 2, judul: 'Dasar HTML & CSS', kategori: 'Materi', topik: 'Struktur dokumen web', kelas_id: 1, mapel_id: 6, file_name: 'html-css.pdf', file_type: 'pdf', file_size: '860 KB', created_at: dayOffset(-15) },
  ];
}

function buildJournals() {
  return [
    { id: 1, tanggal: dayOffset(-1), jam_ke: '1-2', kelas_id: 1, mapel_id: 4, guru_id: 3001, materi_pokok: 'Variabel & Tipe Data', catatan: 'Siswa aktif.', hambatan: 'Beberapa siswa terlambat.', class_name: 'X RPL 1', subject_name: 'Informatika', kehadiran: { total: 10, hadir: 9, terlambat: 1, sakit: 0, izin: 0, alpha: 0 } },
    { id: 2, tanggal: dayOffset(-3), jam_ke: '3-4', kelas_id: 1, mapel_id: 6, guru_id: 3001, materi_pokok: 'Semantic HTML', catatan: '', hambatan: '', class_name: 'X RPL 1', subject_name: 'Pemrograman Web', kehadiran: { total: 10, hadir: 10, terlambat: 0, sakit: 0, izin: 0, alpha: 0 } },
  ];
}

function buildAchievements(students) {
  const c1 = students.filter((s) => s.kelas_id === 1);
  return [
    { id: 1, siswa_id: c1[0].id, siswa_nama: c1[0].name, jenis_prestasi: 'lomba', nama_prestasi: 'Juara 1 Olimpiade Informatika', tingkat: 'Kota', tahun: 2026, deskripsi: 'Tingkat SMA/SMK se-kota.', jurusan_id: 1 },
    { id: 2, siswa_id: (c1[1] || c1[0]).id, siswa_nama: (c1[1] || c1[0]).name, jenis_prestasi: 'sertifikasi', nama_prestasi: 'TOEFL Prediction 550', tingkat: 'Sekolah', tahun: 2026, deskripsi: '', jurusan_id: 1 },
  ];
}

function buildAnnouncements() {
  return [
    { id: 1, title: 'Selamat Datang di Demo SekolahKU', content: 'Portal ini berjalan 100% di browser menggunakan data contoh (localStorage). Coba fitur login cepat, ujian CBT, tugas esai PDF, dan kasir.', type: 'pengumuman', priority: 'tinggi', author_role: 'operator', author: { name: 'Super Admin Operator' }, is_read: false, created_at: dayOffset(-1) + 'T07:00:00', published_at: dayOffset(-1) + 'T07:00:00' },
    { id: 2, title: 'Jadwal Penilaian Harian Informatika', content: 'PH Informatika kelas X RPL 1 menggunakan token CBT123. Pastikan hadir tepat waktu.', type: 'akademik', priority: 'sedang', author_role: 'admin_akademik', author: { name: 'Randy Asha' }, is_read: false, created_at: dayOffset(-2) + 'T13:00:00', published_at: dayOffset(-2) + 'T13:00:00' },
    { id: 3, title: 'Pembayaran SPP September', content: 'Bagi siswa yang belum membayar SPP September agar segera melakukan pembayaran melalui kasir.', type: 'keuangan', priority: 'sedang', author_role: 'cashier', author: { name: 'Ahmad JKK' }, is_read: true, created_at: dayOffset(-4) + 'T09:00:00', published_at: dayOffset(-4) + 'T09:00:00' },
  ];
}

function buildActivityLog() {
  return [
    { id: 1, created_at: nowIso(), type: 'login', user_name: 'Super Admin Operator', admin_name: 'Super Admin Operator', user_role: 'operator', action: 'Login', description: 'Login berhasil ke dashboard', time_human: 'baru saja' },
    { id: 2, created_at: dayOffset(0) + 'T08:30:00', type: 'create', user_name: 'Randy Asha', admin_name: 'Randy Asha', user_role: 'admin_akademik', action: 'Buat Jadwal', description: 'Menambahkan jadwal Pemrograman Web X RPL 1', time_human: '2 jam lalu' },
    { id: 3, created_at: dayOffset(-1) + 'T10:00:00', type: 'update', user_name: 'Ahmad JKK', admin_name: 'Ahmad JKK', user_role: 'cashier', action: 'Verifikasi Pembayaran', description: 'Menyetujui pembayaran SPP', time_human: 'kemarin' },
  ];
}

function buildMagang(students) {
  const c4 = students.filter((s) => s.kelas_id === 4);
  const places = ['PT Digital Nusantara', 'CV Web Prima', 'PT Cloud Teknologi'];
  return c4.slice(0, 5).map((s, i) => ({
    id: 8001 + i, siswa_id: s.id, nama_siswa: s.name, nisn: s.nisn, kelas: s.class_name, school_class_id: 4,
    tempat_magang: places[i % places.length], alamat_magang: 'Jl. Teknologi No. ' + (i + 1) + ', Bandung',
    guru_pembimbing_id: 3001, guru_pembimbing_name: 'Budi Santoso', pembimbing: 'Mentor ' + (i + 1),
    kontak_pembimbing: '0812-0000-000' + i, tanggal_mulai: dayOffset(-40), tanggal_selesai: dayOffset(40),
    status: i === 0 ? 'belum' : 'aktif', nilai_akhir: i < 3 ? 85 + i : null, laporan_terverifikasi: i < 2,
    status_final: i === 0 ? null : 'diproses', punya_sertifikat: false,
  }));
}

function buildFasilitas() {
  return {
    actor_jurusan_id: 1,
    rooms: [
      { id: 1, nama: 'Lab RPL 1', type_code: 'LAB', kapasitas: 32, lantai: 2, usage_status: 'aktif', kepemilikan: 'jurusan', jurusan_id: 1, editable: true, contents: [] },
      { id: 2, nama: 'Ruang Kelas X RPL 1', type_code: 'KELAS', kapasitas: 36, lantai: 1, usage_status: 'aktif', kepemilikan: 'jurusan', jurusan_id: 1, editable: true, contents: [] },
    ],
    inventories: [
      { id: 1, nama: 'PC Desktop', category_code: 'KOMPUTER', funding_source: 'BOS', jumlah: 30, unit: 'unit', lokasi: 'Lab RPL 1', condition_code: 'baik', qty_baik: 28, qty_rusak: 2, qty_dipinjam: 0, qty_perbaikan: 0, qty_hilang: 0, kepemilikan: 'jurusan', editable: true },
      { id: 2, nama: 'Proyektor', category_code: 'MULTIMEDIA', funding_source: 'Komite', jumlah: 5, unit: 'unit', lokasi: 'Lab RPL 1', condition_code: 'baik', qty_baik: 4, qty_rusak: 0, qty_dipinjam: 1, qty_perbaikan: 0, qty_hilang: 0, kepemilikan: 'jurusan', editable: true },
    ],
    borrowings: [
      { id: 1, item: 'Proyektor', peminjam: 'Yanto Pratama', tanggal: dayOffset(-2), status: 'dipinjam' },
    ],
    maintenances: [
      { id: 1, item: 'PC Desktop #12', tanggal: dayOffset(-5), status: 'selesai', teknisi: 'Bagus Setiawan' },
    ],
    references: {},
  };
}

function buildStaffData() {
  return {
    reports: [
      { id: 1, tanggal_kegiatan: dayOffset(-1), judul: 'Setup lingkungan pengembangan', deskripsi: 'Instalasi Node.js & VS Code di lab.', status_verifikasi: 'disetujui', lampirans: JSON.stringify([{ path: '/storage/laporan1.pdf', original_name: 'laporan1.pdf' }]), catatan_pembimbing: 'Rapi, lanjutkan.' },
      { id: 2, tanggal_kegiatan: dayOffset(0), judul: 'Bug fixing modul auth', deskripsi: 'Memperbaiki validasi token login.', status_verifikasi: 'menunggu', lampirans: JSON.stringify([]), catatan_pembimbing: null },
    ],
    tasks: {
      new: [{ id: 1, judul_tugas: 'Buat dokumentasi API', deskripsi: 'Dokumentasikan endpoint auth.', deadline: dayOffset(5) }],
      past: [{ id: 2, judul_tugas: 'Onboarding tools', deskripsi: 'Kenalkan git ke tim.', deadline: dayOffset(-3) }],
    },
  };
}

function buildCalendarEvents() {
  return [
    { id: 1, title: 'Awal Semester Ganjil', event_date: dayOffset(-30), catatan: 'Upacara pembukaan.', type: 'akademik', is_published: true, created_at: dayOffset(-40) },
    { id: 2, title: 'Penilaian Harian Informatika', event_date: dayOffset(2), catatan: 'Kelas X RPL 1.', type: 'ujian', is_published: true, created_at: dayOffset(-5) },
    { id: 3, title: 'Libur Tengah Semester', event_date: dayOffset(30), catatan: 'Selama 1 minggu.', type: 'libur', is_published: true, created_at: dayOffset(-1) },
  ];
}

function buildAttendance(students) {
  // Simple recent attendance per student for X RPL 1 (monthly rollups computed in handler).
  const c1 = students.filter((s) => s.kelas_id === 1);
  const rows = [];
  let id = 1;
  c1.forEach((s, si) => {
    for (let d = 0; d < 6; d += 1) {
      const status = (si === 2 && d === 3) ? 'sakit' : (si === 4 && d === 1) ? 'izin' : (d === 5 && si === 6) ? 'alpha' : 'hadir';
      rows.push({ id: id++, siswa_id: s.id, tanggal: dayOffset(-d - 1), status, kelas_id: 1 });
    }
  });
  return rows;
}

function buildTeacherAttendance() {
  return TEACHERS.map((t, i) => ({
    teacher_id: t.id, name: t.name, nisn_nip: `1990010${(i + 1)}201801100${i + 1}`, school_id: `guru${t.id}@000000`,
    status: i % 4 === 3 ? 'sakit' : 'hadir', jam_masuk: '07:05', jam_keluar: '14:00', tanggal: dayOffset(-1),
  }));
}

function buildMessages() {
  return {
    inbox: [{ id: 1, from_name: 'Randy Asha', subject: 'Rekap nilai', body: 'Jangan lupa finalisasi nilai PH.', read: false, created_at: dayOffset(-1) }],
    sent: [{ id: 2, to_name: 'Budi Santoso', subject: 'Jadwal wali kelas', body: 'Tolong input rapor.', read: true, created_at: dayOffset(-2) }],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildAllData() {
  const students = buildStudents();
  const staff = buildStaffUsers();
  const teachers = buildTeacherUsers();
  const users = [...staff, ...teachers, ...students];
  const classes = buildClasses(students);
  const staffData = buildStaffData();
  return {
    version: SEED_VERSION,
    users,
    jurusans: JURUSANS,
    classes,
    subjects: SUBJECTS,
    teacherSubjects: buildTeacherSubjects(),
    attendance: buildAttendance(students),
    teacherAttendance: buildTeacherAttendance(),
    billings: buildBillings(students),
    payments: buildPayments(students),
    verifications: buildVerifications(students),
    pettyCash: buildPettyCash(),
    cashBook: buildCashBook(),
    examSessions: buildExamSessions(),
    paketSoal: buildPaketSoal(),
    questions: buildQuestions(),
    attempts: [],
    tasks: buildTasks(),
    submissions: buildSubmissions(students),
    bankSoal: buildPaketSoal(),
    materials: buildMaterials(),
    journals: buildJournals(),
    achievements: buildAchievements(students),
    announcements: buildAnnouncements(),
    activityLog: buildActivityLog(),
    notifications: [],
    magang: buildMagang(students),
    fasilitas: buildFasilitas(),
    staffReports: staffData.reports,
    staffTasks: staffData.tasks,
    messages: buildMessages(),
    calendarEvents: buildCalendarEvents(),
    settings: { sleep: { active: false }, maintenance: { active: false }, cleaning: { active: false } },
    schoolProfile: {
      school_name: SCHOOL, address: 'Jl. Pendidikan No. 1, Indonesia',
      finance_account_number: '123-4567-890', finance_bank_name: 'Bank Sekolah', finance_account_holder: 'SMK Cerdas Satu Bangsa',
      finance_payment_channels: 'Tunai, Transfer, QRIS',
    },
  };
}

function persist(data) {
  Object.keys(data).forEach((key) => {
    if (key === 'version') return;
    const storageKey = KEYS[key] || key;
    write(storageKey, data[key]);
  });
  write(KEYS.version, data.version);
}

export function ensureSeeded() {
  const current = read(KEYS.version);
  if (current === SEED_VERSION) return false;
  persist(buildAllData());
  return true;
}

export function resetDemoData() {
  wipeAll();
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  persist(buildAllData());
}
