import { toast } from 'react-hot-toast';
import schoolLogo from '../assets/logos/logo22.png';
import { loadSchoolProfile } from './raporPdf';

// ── helper ─────────────────────────────────────────────────────
const dash = (v) => { const s = v == null ? '' : String(v).trim(); return s !== '' ? s : '-'; };
const tanggalIndo = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const JENIS_LABEL = { lomba: 'Lomba', sertifikasi: 'Sertifikasi', juara_kelas: 'Juara Kelas', lainnya: 'Lainnya' };
const TINGKAT_LABEL = { sekolah: 'Sekolah', kecamatan: 'Kecamatan', kabupaten: 'Kabupaten / Kota', provinsi: 'Provinsi', nasional: 'Nasional', internasional: 'Internasional' };
const TIPE_KEGIATAN = { perlombaan: 'Perlombaan', pertukaran_siswa: 'Pertukaran Siswa', study_tour: 'Study Tour', ekstrakurikuler: 'Ekstrakurikuler', magang: 'Magang' };
const VERIF_LABEL = { menunggu: 'Menunggu Verifikasi', terverifikasi: 'Terverifikasi', ditolak: 'Ditolak' };

const measureImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
  img.onerror = () => resolve({ w: 0, h: 0 });
  img.src = src;
});

async function loadLogoAsset() {
  try {
    const resp = await fetch(schoolLogo);
    const blob = await resp.blob();
    const logoData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    let logoRatio = 1;
    if (logoData) { const dims = await measureImage(schoolLogo); if (dims.w > 0 && dims.h > 0) logoRatio = dims.w / dims.h; }
    return { logoData, logoRatio };
  } catch { return { logoData: null, logoRatio: 1 }; }
}

async function loadPdfLibs() {
  const m = await import('jspdf');
  const jsPDF = m.jsPDF || m.default;
  if (typeof jsPDF !== 'function') throw new Error('jsPDF gagal dimuat. Coba hard-refresh (Ctrl+Shift+R).');
  const at = await import('jspdf-autotable');
  const autoTable = at.autoTable || at.default;
  if (typeof autoTable !== 'function') throw new Error('jspdf-autotable gagal dimuat.');
  return { jsPDF, autoTable };
}

function drawKop(doc, school, logo, M, pageW) {
  const logoH = 16, logoW = Math.round(logoH * (logo.logoRatio || 1));
  let y = 13;
  if (logo.logoData) { try { doc.addImage(logo.logoData, 'PNG', M, y, logoW, logoH); } catch { /* tanpa logo */ } }
  const cx = pageW / 2;
  doc.setFont('times', 'bold'); doc.setFontSize(15); doc.setTextColor(20, 33, 61);
  doc.text(dash(school.school_name), cx, y + 5, { align: 'center' });
  doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.setTextColor(51, 65, 85);
  doc.text(dash(school.school_address), cx, y + 11, { align: 'center' });
  doc.text(`Telp. ${dash(school.school_phone)}  |  E-mail: ${dash(school.school_email)}  |  NPSN: ${dash(school.school_npsn)}`, cx, y + 16, { align: 'center' });
  const ruleY = y + 19;
  doc.setDrawColor(30, 58, 138); doc.setLineWidth(0.9); doc.line(M, ruleY, pageW - M, ruleY);
  doc.setLineWidth(0.3); doc.line(M, ruleY + 1.4, pageW - M, ruleY + 1.4);
  return ruleY + 11;
}

function sectionTitle(doc, text, x, y) {
  doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 58, 138);
  doc.text(text.toUpperCase(), x, y);
  doc.setDrawColor(30, 58, 138); doc.setLineWidth(0.4);
  doc.line(x, y + 1.2, x + 60, y + 1.2);
  return y + 5;
}

/** Portofolio Kegiatan & Prestasi siswa (kop sekolah dari DB, tanpa data dummy). */
async function buildPortofolioPDF({ student, classInfo, academicPeriod, prestasi = [], pkl = null, kegiatan = [], school }) {
  if (!student) return null;
  const loadingToast = toast.loading('Menyiapkan portofolio...');
  try {
    const prof = school || await loadSchoolProfile();
    const { jsPDF } = await loadPdfLibs();
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), M = 18;
    const logo = await loadLogoAsset();

    let y = drawKop(doc, prof, logo, M, pageW);

    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 33, 61);
    doc.text('PORTOFOLIO KEGIATAN & PRESTASI SISWA', pageW / 2, y, { align: 'center' });
    y += 8;

    // Identitas
    doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 41, 59);
    const idLeft = M + 2, idRight = M + 58;
    const idRows = [
      ['Nama', dash(student.name)],
      ['NIS / NISN', dash(student.nis || student.nisn)],
      ['Kelas', dash(classInfo?.name)],
      ['Tahun Ajaran', `${dash(academicPeriod?.academic_year)}${academicPeriod?.semester ? ` / ${academicPeriod.semester}` : ''}`],
    ];
    idRows.forEach(([k, v]) => { doc.text(`${k}:`, idLeft, y); doc.text(String(v), idRight, y); y += 5.4; });
    y += 2;

    // 1. Prestasi terverifikasi
    y = sectionTitle(doc, 'A. Prestasi & Penghargaan', M, y);
    const verified = (prestasi || []).filter((p) => (p.status_verifikasi || 'menunggu') === 'terverifikasi');
    const presRows = verified.length
      ? verified.map((p, i) => [
          String(i + 1),
          dash(p.nama_prestasi),
          TINGKAT_LABEL[p.tingkat] || dash(p.tingkat),
          JENIS_LABEL[p.jenis_prestasi] || dash(p.jenis_prestasi),
          dash(p.tahun),
        ])
      : [['-', 'Belum ada prestasi terverifikasi', '-', '-', '-']];
    doc.autoTable({
      startY: y, margin: { left: M, right: M },
      head: [['No', 'Nama Prestasi', 'Tingkat', 'Jenis', 'Tahun']],
      body: presRows, theme: 'grid',
      styles: { font: 'times', fontSize: 9, cellPadding: 1.4, lineColor: [148, 163, 184], lineWidth: 0.1, textColor: [30, 41, 59] },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 2: { cellWidth: 32 }, 3: { cellWidth: 26 }, 4: { cellWidth: 16, halign: 'center' } },
    });
    y = doc.lastAutoTable.finalY + 8;

    // 2. PKL / Magang
    y = sectionTitle(doc, 'B. PKL / Magang', M, y);
    doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 41, 59);
    if (pkl) {
      const pklRows = [
        ['Instansi (DUDI)', dash(pkl.tempat_magang)],
        ['Alamat', dash(pkl.alamat_magang)],
        ['Periode', `${tanggalIndo(pkl.tanggal_mulai)} s/d ${tanggalIndo(pkl.tanggal_selesai)}`],
        ['Guru Pembimbing', dash(pkl.guru_pembimbing?.name || pkl.pembimbing)],
        ['Status', dash(pkl.status)],
        ['Nilai PKL', pkl.nilai_akhir == null ? '-' : dash(pkl.nilai_akhir)],
      ];
      pklRows.forEach(([k, v]) => { doc.text(`${k}:`, M + 2, y); doc.text(String(v), M + 52, y); y += 5.4; });
    } else {
      doc.text('Belum ada penempatan PKL / Magang.', M + 2, y); y += 5.4;
    }
    y += 3;

    // 3. Kegiatan sekolah
    if (y > pageH - 60) { doc.addPage(); y = M; }
    y = sectionTitle(doc, 'C. Kegiatan Sekolah', M, y);
    const kegRows = (kegiatan && kegiatan.length)
      ? kegiatan.map((a, i) => {
          const meta = Object.entries(a.meta || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
          return [String(i + 1), dash(a.title), TIPE_KEGIATAN[a.activity_type] || dash(a.activity_type), meta || '-'];
        })
      : [['-', 'Belum ada kegiatan tercatat', '-', '-']];
    doc.autoTable({
      startY: y, margin: { left: M, right: M },
      head: [['No', 'Kegiatan', 'Kategori', 'Keterangan']],
      body: kegRows, theme: 'grid',
      styles: { font: 'times', fontSize: 9, cellPadding: 1.4, lineColor: [148, 163, 184], lineWidth: 0.1, textColor: [30, 41, 59] },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 2: { cellWidth: 30 } },
    });
    y = doc.lastAutoTable.finalY + 14;

    // Tanda tangan
    if (y > pageH - 40) { doc.addPage(); y = M + 6; }
    const rightX = pageW - M - 34;
    doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 41, 59);
    doc.text('Mengetahui,', rightX, y, { align: 'center' });
    doc.text('Wali Kelas', rightX, y + 5, { align: 'center' });
    doc.setFont('times', 'bold'); doc.setFontSize(11);
    doc.text(dash(classInfo?.homeroom_teacher) === '-' ? '( ______________________ )' : classInfo.homeroom_teacher, rightX, y + 30, { align: 'center' });
    doc.setFont('times', 'normal'); doc.setFontSize(10.5);
    doc.text('Kepala Sekolah', M + 2, y);
    doc.text(dash(prof.head_name) === '-' ? '' : prof.head_name, M + 2, y + 30);
    doc.setFont('times', 'bold'); doc.setFontSize(11);
    if (dash(prof.head_name) === '-') doc.text('( ______________________ )', M + 2, y + 30);

    const safe = (s) => String(s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    toast.dismiss(loadingToast);
    return { doc, filename: `Portofolio_Kegiatan_${safe(student.name || 'Siswa')}.pdf` };
  } catch (err) {
    console.error('Gagal membuat portofolio PDF:', err);
    toast.error(`Gagal membuat portofolio: ${(err && err.message) || 'kesalahan tidak diketahui'}`, { id: loadingToast, duration: 9000 });
    throw err;
  }
}

export async function previewPortofolioPDF(params) {
  const built = await buildPortofolioPDF(params);
  if (!built) return null;
  toast.success('Portofolio siap.');
  return { url: URL.createObjectURL(built.doc.output('blob')), filename: built.filename };
}
