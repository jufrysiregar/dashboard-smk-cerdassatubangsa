import { toast } from 'react-hot-toast';
import schoolLogo from '../assets/logos/logo22.png';
import { loadSchoolProfile } from './raporPdf';

const dash = (v) => { const s = v == null ? '' : String(v).trim(); return s !== '' ? s : '-'; };
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
 * Laporan Rekap Nilai & Ketuntasan KKM — Wakil Kepala Sekolah.
 * 100% data nyata (nilai_siswa + rapor + jadwal_guru + subjects) via section
 * wakasek_graduation. autoTable(doc, ...) dipanggil sebagai fungsi (bukan doc.autoTable).
 * Kop dari DB + blok tanda tangan "Mengetahui, Wakil Kepala Sekolah" (nama wakasek login).
 */
async function buildWakasekRekapNilaiPDF({ rows = [], period = {}, wakilName, wakilNip, school }) {
  const loadingToast = toast.loading('Menyiapkan laporan rekap nilai & KKM...');
  try {
    const prof = school || await loadSchoolProfile();
    const { jsPDF, autoTable } = await loadPdfLibs();
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), M = 16;
    const logo = await loadLogoAsset();

    let y = drawKop(doc, prof, logo, M, pageW);

    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 33, 61);
    doc.text('LAPORAN REKAP NILAI & KETUNTASAN KKM', pageW / 2, y, { align: 'center' });
    y += 6;
    doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(51, 65, 85);
    const periodeTxt = `Tahun Ajaran ${dash(period.tahun_ajaran)}${period.semester ? ` / Semester ${period.semester}` : ''}`;
    doc.text(`${periodeTxt}    -    Dicetak: ${tanggalIndo()}`, pageW / 2, y, { align: 'center' });
    y += 8;

    const body = rows.length
      ? rows.map((r, i) => [
          String(i + 1),
          dash(r.mapel_name),
          dash(r.kelas_name),
          dash(r.guru_name),
          dash(r.guru_nip),
          `${r.nilai_masuk ?? 0}/${r.total_siswa_rombel ?? 0}`,
          r.average == null ? '-' : String(r.average),
          String(r.kkm ?? 75),
          r.tuntas_pct == null ? '-' : `${r.tuntas_pct}%`,
          String(r.remedial ?? 0),
          dash(r.status_rapor),
        ])
      : [['-', 'Belum ada mapel terjadwal', '-', '-', '-', '-', '-', '-', '-', '-', '-']];

    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['No', 'Mata Pelajaran', 'Rombel', 'Guru Pengampu', 'NIP', 'Nilai/Total', 'Rata-rata', 'KKM', 'Tuntas', 'Remedial', 'Status Rapor']],
      body, theme: 'grid',
      styles: { font: 'times', fontSize: 8.5, cellPadding: 1.5, lineColor: [148, 163, 184], lineWidth: 0.1, textColor: [30, 41, 59] },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 38 },
        2: { cellWidth: 22 },
        3: { cellWidth: 40 },
        4: { cellWidth: 34 },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 14, halign: 'center' },
        8: { cellWidth: 16, halign: 'center' },
        9: { cellWidth: 16, halign: 'center' },
        10: { cellWidth: 30, halign: 'center' },
      },
    });

    let sigY = doc.lastAutoTable.finalY + 20;
    if (sigY > pageH - 44) { doc.addPage(); sigY = M + 6; }
    const rightX = pageW - M;
    doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 41, 59);
    doc.text('Mengetahui,', rightX, sigY, { align: 'right' });
    doc.text('Wakil Kepala Sekolah', rightX, sigY + 5, { align: 'right' });
    doc.setFont('times', 'bold'); doc.setFontSize(11);
    const wakilTxt = dash(wakilName) !== '-' ? wakilName : '( ______________________ )';
    doc.text(wakilTxt, rightX, sigY + 30, { align: 'right' });
    doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.setTextColor(51, 65, 85);
    if (wakilNip) doc.text(`NIP: ${wakilNip}`, rightX, sigY + 35, { align: 'right' });

    const safe = (s) => String(s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    toast.dismiss(loadingToast);
    return { doc, filename: `Rekap_Nilai_KKM_${safe(period.tahun_ajaran || 'Periode')}.pdf` };
  } catch (err) {
    console.error('Gagal membuat laporan rekap nilai & KKM PDF:', err);
    toast.error(`Gagal membuat laporan: ${(err && err.message) || 'kesalahan tidak diketahui'}`, { id: loadingToast, duration: 9000 });
    throw err;
  }
}

export async function previewWakasekRekapNilaiPDF(params) {
  const built = await buildWakasekRekapNilaiPDF(params);
  if (!built) return null;
  toast.success('Laporan siap.');
  return { url: URL.createObjectURL(built.doc.output('blob')), filename: built.filename };
}
