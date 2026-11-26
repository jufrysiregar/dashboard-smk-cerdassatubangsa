import { toast } from 'react-hot-toast';
import schoolLogo from '../assets/logos/logo22.png';
import { loadSchoolProfile } from './raporPdf';

// ── helper ─────────────────────────────────────────────────────
const rupiah = (v) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(v) || 0));
const dash = (v) => { const s = v == null ? '' : String(v).trim(); return s !== '' ? s : '-'; };
const tanggalIndo = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const STATUS_LABEL = {
  belum_bayar: 'Belum Bayar', proses_verifikasi: 'Menunggu Verifikasi',
  lunas: 'LUNAS', ditolak: 'Ditolak', dibatalkan: 'Dibatalkan',
};

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

function drawLunasStamp(doc, x, y, status) {
  const label = status === 'lunas' ? 'LUNAS' : status === 'proses_verifikasi' ? 'MENUNGGU VERIFIKASI' : status === 'ditolak' ? 'DITOLAK' : String(status || '-');
  const color = status === 'lunas' ? [4, 120, 87] : status === 'ditolak' ? [190, 18, 60] : [217, 119, 6];
  doc.saveGraphicsState?.();
  try { if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.9 })); } catch { /* opsional */ }
  doc.setDrawColor(...color); doc.setLineWidth(0.8);
  doc.roundedRect(x, y, 46, 14, 2, 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...color);
  doc.text(label, x + 23, y + 8.7, { align: 'center' });
  doc.restoreGraphicsState?.();
}

/** Kuitansi / tanda terima pembayaran satu tagihan. */
async function buildKuitansiPDF({ student, item, school }) {
  if (!student || !item) return null;
  const loadingToast = toast.loading('Menyiapkan kuitansi...');
  try {
    const prof = school || await loadSchoolProfile();
    const { jsPDF } = await loadPdfLibs();
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), M = 18;
    const logo = await loadLogoAsset();
    let y = drawKop(doc, prof, logo, M, pageW);

    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 33, 61);
    doc.text('KUITANSI / TANDA TERIMA PEMBAYARAN', pageW / 2, y, { align: 'center' });
    y += 4;
    doc.setFont('times', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
    doc.text('No. Transaksi: ' + dash(item.transaction_no), M, y + 4);
    doc.text('Tanggal: ' + tanggalIndo(item.payment_date || item.verified_at), pageW - M, y + 4, { align: 'right' });
    y += 12;

    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3); doc.roundedRect(M, y, pageW - 2 * M, 60, 2, 2);
    const lines = [
      ['Telah diterima dari', `${student.name || '-'}${item.class_name ? ` (${item.class_name})` : ''}`],
      ['Keperluan', `${dash(item.title)}${item.category ? ` — ${item.category}` : ''}`],
      ['Nominal', rupiah(item.accepted_amount ?? item.paid_amount ?? item.amount)],
      ['Metode / Kanal', dash(item.payment_channel || item.payment_method)],
      ['Bukti Transfer', dash(item.proof_name)],
    ];
    let ly = y + 10;
    lines.forEach(([l, v]) => {
      doc.setFont('times', 'bold'); doc.setFontSize(10.5); doc.setTextColor(51, 65, 85);
      doc.text(l + ' :', M + 5, ly);
      doc.setFont('times', 'normal'); doc.setTextColor(30, 41, 59);
      doc.text(String(v), M + 55, ly);
      ly += 10;
    });
    // Stempel status di kanan dalam kotak.
    drawLunasStamp(doc, pageW - M - 52, y + 40, item.status);
    y += 72;

    doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 41, 59);
    doc.text(`Status tagihan: ${STATUS_LABEL[item.status] || dash(item.status)}`, M, y);
    if (item.status === 'ditolak' && item.rejection_reason) {
      y += 6; doc.setTextColor(190, 18, 60); doc.text('Alasan penolakan: ' + item.rejection_reason, M, y);
    }
    y += 16;

    // Tanda tangan kasir verifikator.
    const rightX = pageW - M - 34;
    doc.setTextColor(30, 41, 59); doc.setFont('times', 'normal'); doc.setFontSize(10.5);
    doc.text('Menyetujui,', rightX, y, { align: 'center' });
    doc.text('Bendahara / Kasir', rightX, y + 5, { align: 'center' });
    doc.setFont('times', 'bold'); doc.setFontSize(11);
    doc.text(dash(item.verified_by_name), rightX, y + 32, { align: 'center' });
    doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.3);
    doc.line(rightX - 34, y + 33, rightX + 34, y + 33);

    const safe = (s) => String(s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    toast.dismiss(loadingToast);
    return { doc, filename: `Kuitansi_${safe(item.transaction_no || item.bill_code)}.pdf` };
  } catch (err) {
    console.error('Gagal membuat kuitansi PDF:', err);
    toast.error(`Gagal membuat kuitansi: ${(err && err.message) || 'kesalahan tidak diketahui'}`, { id: loadingToast, duration: 9000 });
    throw err;
  }
}

/** Rekapitulasi keuangan (semua tagihan + total). */
async function buildRekapKeuanganPDF({ student, items = [], summary = {}, school }) {
  const loadingToast = toast.loading('Menyiapkan rekap keuangan...');
  try {
    const prof = school || await loadSchoolProfile();
    const { jsPDF, autoTable } = await loadPdfLibs();
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth(), M = 15;
    const logo = await loadLogoAsset();
    let y = drawKop(doc, prof, logo, M, pageW);

    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 33, 61);
    doc.text('REKAPITULASI KEUANGAN PESERTA DIDIK', pageW / 2, y, { align: 'center' });
    y += 8;

    doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 41, 59);
    doc.text(`Nama : ${student?.name || '-'}`, M, y);
    doc.text(`Kelas : ${student?.class_name || '-'}`, M + 110, y);
    y += 6;
    doc.text(`NISN : ${student?.nisn || '-'}`, M, y);
    doc.text(`Dicetak : ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, M + 110, y);
    y += 10;

    const rows = items.map((it) => [
      dash(it.bill_code), it.title || '-', it.category || '-', dash(it.due_date),
      rupiah(it.amount), rupiah(it.paid_amount), rupiah(it.remaining_amount),
      STATUS_LABEL[it.status] || dash(it.status),
    ]);
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Kode', 'Tagihan', 'Kategori', 'Jatuh Tempo', 'Nominal', 'Terbayar', 'Sisa', 'Status']],
      body: rows.length ? rows : [['-', 'Belum ada tagihan', '-', '-', '-', '-', '-', '-']],
      foot: [[
        { content: 'TOTAL', colSpan: 4, styles: { halign: 'left' } },
        rupiah(summary.total_billed ?? 0), rupiah(summary.paid_total ?? 0), rupiah(summary.total_due ?? 0),
        `${summary.progress_percentage ?? 0}% lunas`,
      ]],
      theme: 'grid',
      styles: { font: 'times', fontSize: 8.5, cellPadding: 1.4, lineColor: [148, 163, 184], lineWidth: 0.1, textColor: [30, 41, 59] },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center' },
      footStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { cellWidth: 26 }, 1: { halign: 'left' }, 7: { halign: 'center' } },
    });
    y = doc.lastAutoTable.finalY + 16;

    doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 41, 59);
    const rightX = pageW - M - 34;
    doc.text('Mengetahui,', rightX, y, { align: 'center' });
    doc.text('Bendahara / Kasir', rightX, y + 5, { align: 'center' });
    doc.setFont('times', 'bold'); doc.setFontSize(11);
    doc.text('( ______________________ )', rightX, y + 32, { align: 'center' });
    doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.3); doc.line(rightX - 34, y + 33, rightX + 34, y + 33);

    const safe = (s) => String(s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    toast.dismiss(loadingToast);
    return { doc, filename: `Rekap_Keuangan_${safe(student?.name || 'Siswa')}.pdf` };
  } catch (err) {
    console.error('Gagal membuat rekap keuangan PDF:', err);
    toast.error(`Gagal membuat rekap: ${(err && err.message) || 'kesalahan tidak diketahui'}`, { id: loadingToast, duration: 9000 });
    throw err;
  }
}

export async function previewKuitansiPDF(params) {
  const built = await buildKuitansiPDF(params);
  if (!built) return null;
  toast.success('Kuitansi siap.');
  return { url: URL.createObjectURL(built.doc.output('blob')), filename: built.filename };
}

export async function previewRekapKeuanganPDF(params) {
  const built = await buildRekapKeuanganPDF(params);
  if (!built) return null;
  toast.success('Rekap keuangan siap.');
  return { url: URL.createObjectURL(built.doc.output('blob')), filename: built.filename };
}
