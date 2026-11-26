import { toast } from 'react-hot-toast';
import schoolLogo from '../assets/logos/logo22.png';
import { loadSchoolProfile } from './raporPdf';

const dash = (v) => { const s = v == null ? '' : String(v).trim(); return s !== '' ? s : '-'; };
const rupiah = (v) => 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(v || 0));
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
 * Rekap Keuangan & Tunggakan (Kepala Sekolah). Kop + identitas dari DB nyata.
 * Baris = kelas terfilter; nilai riil (Rp 0 bila memang belum ada tagihan).
 */
async function buildKeuanganKepsekPDF({ rows = [], kpis = {}, period = {}, school }) {
  const loadingToast = toast.loading('Menyiapkan rekap keuangan...');
  try {
    const prof = school || await loadSchoolProfile();
    const { jsPDF, autoTable } = await loadPdfLibs();
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), M = 16;
    const logo = await loadLogoAsset();

    let y = drawKop(doc, prof, logo, M, pageW);

    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 33, 61);
    doc.text('REKAP KEUANGAN & TUNGGAKAN SISWA', pageW / 2, y, { align: 'center' });
    y += 6;
    doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(51, 65, 85);
    const periodeTxt = `Tahun Ajaran ${dash(period.tahun_ajaran)}${period.semester ? ` / Semester ${period.semester}` : ''}`;
    doc.text(`${periodeTxt}    -    Dicetak: ${tanggalIndo()}`, pageW / 2, y, { align: 'center' });
    y += 8;

    // Ringkasan singkat
    const ringkas = [
      ['Total Tagihan', rupiah(kpis.total_tagihan)],
      ['Total Terbayar', rupiah(kpis.total_terbayar)],
      ['Total Tunggakan', rupiah(kpis.total_tunggakan)],
      ['Rasio Pelunasan', kpis.rasio_pelunasan == null ? '-' : `${kpis.rasio_pelunasan}%`],
      ['Siswa Menunggak', String(kpis.siswa_menunggak ?? 0)],
    ];
    doc.setFontSize(10);
    ringkas.forEach(([k, v]) => { doc.text(`${k}:`, M + 2, y); doc.setFont('times', 'bold'); doc.text(String(v), M + 55, y); doc.setFont('times', 'normal'); y += 5.2; });
    y += 3;

    const body = rows.length
      ? rows.map((r, i) => [
          String(i + 1),
          dash(r.name),
          dash(r.homeroom_teacher),
          String(r.active_students ?? 0),
          rupiah(r.total_tagihan),
          rupiah(r.total_terbayar),
          rupiah(r.sisa_tunggakan),
          r.pct_lunas == null ? '-' : `${r.pct_lunas}%`,
        ])
      : [['-', 'Belum ada data kelas', '-', '-', '-', '-', '-', '-']];

    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['No', 'Kelas', 'Wali Kelas', 'Siswa', 'Total Tagihan', 'Terbayar', 'Sisa Tunggakan', '% Lunas']],
      body, theme: 'grid',
      styles: { font: 'times', fontSize: 9, cellPadding: 1.6, lineColor: [148, 163, 184], lineWidth: 0.1, textColor: [30, 41, 59] },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 48 },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 32, halign: 'right' },
        5: { cellWidth: 32, halign: 'right' },
        6: { cellWidth: 32, halign: 'right' },
        7: { cellWidth: 18, halign: 'center' },
      },
    });

    let sigY = doc.lastAutoTable.finalY + 18;
    if (sigY > pageH - 40) { doc.addPage(); sigY = M + 6; }
    const rightX = pageW - M;
    doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 41, 59);
    doc.text('Mengetahui,', rightX, sigY, { align: 'right' });
    doc.text('Kepala Sekolah', rightX, sigY + 5, { align: 'right' });
    doc.setFont('times', 'bold'); doc.setFontSize(11);
    const principalName = prof.principal?.name ? `${prof.principal.name}${prof.principal.academic_title ? `, ${prof.principal.academic_title}` : ''}` : '( ______________________ )';
    doc.text(principalName, rightX, sigY + 30, { align: 'right' });
    doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.setTextColor(51, 65, 85);
    if (prof.principal?.nip) doc.text(`NIP: ${prof.principal.nip}`, rightX, sigY + 35, { align: 'right' });

    const safe = (s) => String(s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    toast.dismiss(loadingToast);
    return { doc, filename: `Rekap_Keuangan_${safe(period.tahun_ajaran || 'Periode')}.pdf` };
  } catch (err) {
    console.error('Gagal membuat rekap keuangan PDF:', err);
    toast.error(`Gagal membuat rekap keuangan: ${(err && err.message) || 'kesalahan tidak diketahui'}`, { id: loadingToast, duration: 9000 });
    throw err;
  }
}

export async function previewKeuanganKepsekPDF(params) {
  const built = await buildKeuanganKepsekPDF(params);
  if (!built) return null;
  toast.success('Rekap keuangan siap.');
  return { url: URL.createObjectURL(built.doc.output('blob')), filename: built.filename };
}
