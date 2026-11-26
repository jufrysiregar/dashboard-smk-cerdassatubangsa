import { toast } from 'react-hot-toast';
import schoolLogo from '../assets/logos/logo22.png';
import { loadSchoolProfile } from './raporPdf';

const dash = (v) => { const s = v == null ? '' : String(v).trim(); return s !== '' ? s : '-'; };
const rupiah = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;
const pct = (v) => (v == null ? '-' : `${Number(v).toFixed(1)}%`);
const tanggalIndo = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

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

/**
 * Laporan Eksekutif Sekolah (Kepala Sekolah) — ringkasan kondisi lintas modul.
 * Semua angka riil dari getStats() overview section; kosong tampil '-' / 0 (jujur).
 */
async function buildLaporanEksekutifPDF({ overview = {}, principalName, school }) {
  const loadingToast = toast.loading('Menyiapkan laporan eksekutif sekolah...');
  try {
    const prof = school || await loadSchoolProfile();
    const { jsPDF, autoTable } = await loadPdfLibs();
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), M = 16;
    const logo = await loadLogoAsset();
    const pop = overview.populasi || {};
    const kbm = overview.kbm || {};
    const keu = overview.keuangan || {};
    const ev = overview.evaluasi_audit || {};
    const period = overview.period || {};

    let y = drawKop(doc, prof, logo, M, pageW);

    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 33, 61);
    doc.text('LAPORAN EKSEKUTIF SEKOLAH', pageW / 2, y, { align: 'center' });
    y += 6;
    doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(51, 65, 85);
    doc.text(`Periode: TA ${dash(period.tahun_ajaran)}${period.semester ? ` / ${period.semester}` : ''}    -    Dicetak: ${tanggalIndo()}`, pageW / 2, y, { align: 'center' });
    y += 8;

    const body = [
      ['Populasi & SDM', 'Siswa Aktif', String(pop.siswa_aktif ?? 0)],
      ['', 'Siswa Ter-enroll', String(pop.siswa_enrolled ?? 0)],
      ['', 'Tenaga Didik / Guru', String(pop.guru_aktif ?? 0)],
      ['', 'Staf / Operator', String(pop.staf ?? 0)],
      ['', 'Rombel Aktif', String(pop.rombel ?? 0)],
      ['KBM & Akademik', 'Jadwal Mengajar', String(kbm.jadwal_total ?? 0)],
      ['', 'Jurnal KBM Terisi', String(kbm.jurnal_terisi ?? 0)],
      ['', 'Rata-rata Nilai Akhir', kbm.rata_nilai == null ? 'Belum ada' : String(kbm.rata_nilai)],
      ['', 'Rapor Published', String(kbm.rapor_published ?? 0)],
      ['Keuangan', 'Pemasukan Bulan Ini', rupiah(keu.pemasukan_bulan)],
      ['', 'Tunggakan SPP', rupiah(keu.tunggakan_spp)],
      ['', 'Rasio Pelunasan', pct(keu.rasio_pelunasan_pct)],
      ['', 'Approval Menunggu', String(keu.approval_pending ?? 0)],
      ['Evaluasi & Audit', 'Tenaga Didik Dinilai (PKG)', `${ev.pkg_done ?? 0}/${ev.pkg_total ?? 0}`],
      ['', 'Akun Perlu Audit Identitas', String(ev.akun_perlu_audit ?? 0)],
      ['', 'Kepatuhan Identitas', pct(ev.kepatuhan_identitas_pct)],
    ];

    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Bidang', 'Indikator', 'Nilai']],
      body, theme: 'grid',
      styles: { font: 'times', fontSize: 9.5, cellPadding: 1.6, lineColor: [148, 163, 184], lineWidth: 0.1, textColor: [30, 41, 59] },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'left' },
      columnStyles: { 0: { cellWidth: 34, fontStyle: 'bold' }, 1: { cellWidth: 70 }, 2: { cellWidth: 60, halign: 'right' } },
      didParseCell: (data) => { if (data.section === 'body' && data.column.index === 0 && data.cell.raw === '') data.cell.styles.fillColor = [248, 250, 252]; },
    });

    let sigY = doc.lastAutoTable.finalY + 20;
    if (sigY > pageH - 40) { doc.addPage(); sigY = M + 6; }
    const rightX = pageW - M;
    doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 41, 59);
    doc.text('Mengetahui,', rightX, sigY, { align: 'right' });
    doc.text('Kepala Sekolah', rightX, sigY + 5, { align: 'right' });
    doc.setFont('times', 'bold'); doc.setFontSize(11);
    const name = principalName || (prof.principal?.name ? `${prof.principal.name}${prof.principal.academic_title ? `, ${prof.principal.academic_title}` : ''}` : '( ______________________ )');
    doc.text(name, rightX, sigY + 30, { align: 'right' });
    if (prof.principal?.nip) { doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.setTextColor(51, 65, 85); doc.text(`NIP: ${prof.principal.nip}`, rightX, sigY + 35, { align: 'right' }); }

    toast.dismiss(loadingToast);
    return { doc, filename: `Laporan_Eksekutif_Sekolah_${tanggalIndo().replace(/[^\w]+/g, '_')}.pdf` };
  } catch (err) {
    console.error('Gagal membuat laporan eksekutif PDF:', err);
    toast.error(`Gagal membuat laporan: ${(err && err.message) || 'kesalahan tidak diketahui'}`, { id: loadingToast, duration: 9000 });
    throw err;
  }
}

export async function previewLaporanEksekutifPDF(params) {
  const built = await buildLaporanEksekutifPDF(params);
  if (!built) return null;
  toast.success('Laporan siap.');
  return { url: URL.createObjectURL(built.doc.output('blob')), filename: built.filename };
}
