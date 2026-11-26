import { toast } from 'react-hot-toast';
import api from './api';
import schoolLogo from '../assets/logos/logo22.png';

// ── Identitas instansi untuk kop surat rapor ──────────────────────────────
// Sumber data = database (tabel system_settings key school_*, diedit lewat
// Settings > Profil Sekolah oleh operator/admin akademik). TIDAK ada lagi
// placeholder hardcoded: nilai yang belum diisi di DB tampil '-' jujur.
let schoolProfileCache = null;

export async function loadSchoolProfile(force = false) {
  if (schoolProfileCache && !force) return schoolProfileCache;
  try {
    const r = await api.get('/school-profile');
    schoolProfileCache = r.data?.data || {};
  } catch {
    schoolProfileCache = {};
  }
  return schoolProfileCache;
}

// Fallback nama institusi = merk aplikasi (bukan data karangan); field kop lain
// tanpa nilai DB ditampilkan '-' sampai diisi lewat pengaturan profil sekolah.
const FALLBACK_SCHOOL_NAME = 'SMK CERDAS SATU BANGSA';

// Helper: label semester "ganjil/genap" menjadi teks resmi rapor.
export const semesterLabel = (sem) => {
  const s = String(sem || 'ganjil').toLowerCase();
  if (s === 'genap' || s === '2' || s === 'dua') return 'Genap (2)';
  return 'Ganjil (1)';
};

// Helper: predikat huruf dari nilai angka.
export const predikatHuruf = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  const v = Number(n);
  if (v >= 85) return 'A';
  if (v >= 75) return 'B';
  if (v >= 65) return 'C';
  return 'D';
};

const dash = (v) => {
  const s = v === null || v === undefined ? '' : String(v).trim();
  return s !== '' ? s : '-';
};

// Tingkat kelas berikutnya utk keputusan "Naik ke Kelas ..." (semester genap).
const nextLevel = (level) => {
  const l = String(level || '').toUpperCase();
  if (l === 'X') return 'XI';
  if (l === 'XI') return 'XII';
  return l;
};

const KEPUTUSAN_LABEL = {
  naik: (classInfo) => `Naik ke Kelas ${nextLevel(classInfo?.level)}${classInfo?.department ? ` ${classInfo.department}` : ''}`,
  tidak_naik: 'Tidak Naik Kelas',
  lulus: 'Lulus',
  tidak_lulus: 'Tidak Lulus',
};

// Dimensi alami logo (aspek rasio asli) — mencegah logo 847x795 dipaksa ke
// kotak 22x22 yang bikin teks bawaan logo tampak terpotong/berantakan.
const measureImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
  img.onerror = () => resolve({ w: 0, h: 0 });
  img.src = src;
});

/**
 * Membangun dokumen PDF rapor resmi (jsPDF, A4 portrait) dari data DB.
 * Dipakai bersama oleh portal Wali Kelas dan portal Murid sehingga format rapor
 * resmi hanya ada satu sumber; hasil dipratinjau dulu di layar (previewRaporPDF),
 * unduhan terjadi hanya bila user menekan tombol di dalam modal pratinjau.
 *
 * @param {object}   student          Identitas + subject_grades + catatan/sikap (semua dari DB).
 * @param {Array}    subjects         Daftar mapel [{ id, name, code, kkme }].
 * @param {object}   classInfo        { name, level, department } kelas siswa.
 * @param {object}   homeroomTeacher  { name, academic_title, nip } wali kelas (NIP asli dari DB).
 * @param {string}   fallbackTeacherName Nama guru cadangan bila wali kelas kosong.
 * @param {object}   report           Ringkasan riil: { poinPrestasi, skorAkhir, peringkat,
 *                                    jumlahSiswa, ketidakhadiran: {sakit, izin, alpha},
 *                                    prestasiList: [{nama_kegiatan, tingkat, poin}],
 *                                    keputusan, pkl: {nilai_akhir} }.
 */
async function buildRaporPDF({
  student,
  subjects = [],
  classInfo = null,
  homeroomTeacher = null,
  kepalaSekolah = null,
  draft = false,
  fallbackTeacherName = 'Bapak/Ibu Guru',
  report = null,
}) {
  if (!student) return;
  const loadingToast = toast.loading('Menyiapkan rapor PDF...');
  try {
    // Profil sekolah dari DB (cache modul; gagal load => field '-' jujur).
    const school = await loadSchoolProfile();
    const rep = report || {};

    // jsPDF (±370 kB) + autoTable diunduh hanya saat benar-benar mencetak.
    // Import defensif: pastikan keduanya benar-benar fungsi sebelum dipakai, supaya
    // kegagalan load chunk (mis. cache lama / CSP) memunculkan pesan jelas, bukan
    // "undefined is not a function" yang membingungkan.
    const jsPdfModule = await import('jspdf');
    const jsPDF = jsPdfModule.jsPDF || jsPdfModule.default;
    if (typeof jsPDF !== 'function') {
      throw new Error('Library jsPDF gagal dimuat (modul kosong). Coba hard-refresh (Ctrl+Shift+R).');
    }
    const atModule = await import('jspdf-autotable');
    const autoTable = atModule.autoTable || atModule.default;
    if (typeof autoTable !== 'function') {
      throw new Error('Library jspdf-autotable gagal dimuat (autoTable bukan fungsi).');
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();   // 210
    const pageH = doc.internal.pageSize.getHeight();  // 297
    const M = 15;
    const contentW = pageW - M * 2;

    const className = classInfo?.name || '';
    const wali = homeroomTeacher || {};
    const teacherName = wali.name || fallbackTeacherName;
    const teacherTitle = wali.academic_title ? `, ${wali.academic_title}` : '';
    // NIP asli dari DB; kosong => '-' (dilarang hardcode).
    const teacherNip = dash(wali.nip);
    const semRaw = String(student.semester || 'ganjil').toLowerCase();
    // Label semester di PDF tanpa angka dalam kurung: "Ganjil" / "Genap".
    const semLabel = semRaw === 'genap' ? 'Genap' : 'Ganjil';
    const tahunAjaran = student.tahun_ajaran || '-';
    const kkmDefault = 75;

    // ── Logo → dataURL (untuk addImage) — aspek rasio asli dipertahankan ──
    let logoData = null;
    let logoRatio = 1;
    try {
      const resp = await fetch(schoolLogo);
      const blob = await resp.blob();
      logoData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (logoData) {
        const dims = await measureImage(schoolLogo);
        if (dims.w > 0 && dims.h > 0) logoRatio = dims.w / dims.h;
      }
    } catch { logoData = null; }

    // ── KOP SURAT ──
    const logoH = 17;
    const logoW = Math.round(logoH * logoRatio);
    let y = 13;
    if (logoData) {
      try { doc.addImage(logoData, 'PNG', M, y, logoW, logoH); } catch { /* logo gagal, lanjut tanpa logo */ }
    }
    // Teks kop rata tengah penuh halaman (layout kop resmi), tidak menabrak logo
    // karena blok teks mulai di bawah area logo bila nama/alamat melebar.
    const kopCX = pageW / 2;
    doc.setFont('times', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(20, 33, 61);
    doc.text(dash(school.school_name) === '-' ? FALLBACK_SCHOOL_NAME : school.school_name, kopCX, y + 5, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(dash(school.school_address), kopCX, y + 11, { align: 'center' });
    doc.text(
      `Telp. ${dash(school.school_phone)}  |  E-mail: ${dash(school.school_email)}  |  NPSN: ${dash(school.school_npsn)}`,
      kopCX, y + 16, { align: 'center' },
    );

    // Garis ganda kop
    const ruleY = y + 19;
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.9);
    doc.line(M, ruleY, pageW - M, ruleY);
    doc.setLineWidth(0.3);
    doc.line(M, ruleY + 1.4, pageW - M, ruleY + 1.4);

    y = ruleY + 11;

    // ── JUDUL ──
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 33, 61);
    doc.text('LAPORAN HASIL BELAJAR PESERTA DIDIK (RAPOR)', pageW / 2, y, { align: 'center' });
    // Subjudul "Semester ... · Tahun Ajaran ..." dihapus sesuai permintaan —
    // info semester & tahun ajaran tetap ada di tabel IDENTITAS SISWA.
    y += 7;

    // ── IDENTITAS SISWA (ringkas: dua sisi kiri/kanan, TANPA garis tabel) ──
    // Kiri: Nama + Kelas. Kanan: Tahun Ajaran + Semester. Label & value pakai
    // offset tetap tiap sisi supaya sejajar; value sisi kiri di-wrap bila panjang
    // (nama murid panjang tidak menabrak kolom kanan).
    const idLabelWLeft = 24;   // "Nama :" / "Kelas :"
    const idLabelWRight = 30;  // "Tahun Ajaran :" / "Semester :"
    const idRightX = M + Math.round(contentW * 0.52);
    const idLeftValueX = M + idLabelWLeft;
    const idRightValueX = idRightX + idLabelWRight;
    const idLeftValueMax = idRightX - idLeftValueX - 6;
    const idLines = [
      ['Nama', student.name || '-', 'Tahun Ajaran', tahunAjaran],
      ['Kelas', className || '-', 'Semester', semLabel],
    ];
    {
      let iy = y + 4;
      doc.setFontSize(10.5);
      idLines.forEach(([l1, v1, l2, v2]) => {
        // Kata label RATA KIRI di posisi tetap; kolon digambar terpisah di garis
        // x yang sama tiap sisi => ":" sejajar vertikal atas-bawah, kata nggak bergerigi.
        doc.setFont('times', 'bold');
        doc.text(l1, M, iy);
        doc.text(':', idLeftValueX - 2, iy);
        doc.setFont('times', 'normal');
        const v1Wrapped = doc.splitTextToSize(String(v1), idLeftValueMax);
        doc.text(v1Wrapped, idLeftValueX, iy);
        doc.setFont('times', 'bold');
        doc.text(l2, idRightX, iy);
        doc.text(':', idRightValueX - 2, iy);
        doc.setFont('times', 'normal');
        doc.text(String(v2), idRightValueX, iy);
        iy += 5.5 * (v1Wrapped.length || 1) + 1.5;
      });
      y = iy + 1;
    }
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(M, y, pageW - M, y);
    y += 6;

    // ── TABEL NILAI (termasuk PKL utk kelas XII) ──
    const gradeRows = (subjects || []).map((sub, i) => {
      const g = student.subject_grades?.[sub.id] || {};
      const kkm = Number(g.kkm ?? sub.kkme ?? kkmDefault);
      const raw = g.akhir;
      const akhir = (raw === null || raw === undefined || raw === '') ? null : Number(raw);
      const status = akhir === null ? 'Belum Ada Nilai' : (akhir >= kkm ? 'Tuntas' : 'Belum Tuntas');
      return [
        i + 1,
        sub.name || sub.code || '-',
        kkm,
        akhir === null ? '-' : akhir,
        akhir === null ? '-' : predikatHuruf(akhir),
        status,
      ];
    });

    // PKL dari Pusat Jurusan (pkl_siswa) bila belum tampil sebagai mapel terjadwal.
    const pklSudahJadiMapel = (subjects || []).some((s) => /pkl|prakerin/i.test(String(s.name || '')));
    if (rep.pkl && rep.pkl.nilai_akhir != null && !pklSudahJadiMapel) {
      gradeRows.push([
        gradeRows.length + 1,
        'PKL / Prakerin',
        '-',
        Number(rep.pkl.nilai_akhir),
        predikatHuruf(rep.pkl.nilai_akhir),
        'Dari Pusat Jurusan',
      ]);
    }

    const avg = student.grade_avg != null ? Number(student.grade_avg) : null;
    const poin = rep.poinPrestasi != null ? Number(rep.poinPrestasi) : null;
    const skor = rep.skorAkhir != null ? Number(rep.skorAkhir) : null;
    const rankText = rep.peringkat
      ? `Peringkat ${rep.peringkat} dari ${rep.jumlahSiswa || '?'} Siswa`
      : 'Belum terbentuk';

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['No', 'Mata Pelajaran', 'KKM', 'Nilai Angka', 'Nilai Huruf', 'Keterangan']],
      body: gradeRows.length ? gradeRows : [['-', 'Belum ada data nilai mata pelajaran', '-', '-', '-', '-']],
      foot: [
        [
          { content: 'RATA-RATA NILAI MATA PELAJARAN', colSpan: 3, styles: { halign: 'left' } },
          avg ?? '-',
          avg !== null ? predikatHuruf(avg) : '-',
          avg !== null ? (avg >= kkmDefault ? 'Tuntas' : 'Belum Tuntas') : 'Tanpa Data',
        ],
        [
          { content: 'POIN TAMBAHAN PRESTASI (WALI KELAS)', colSpan: 4, styles: { halign: 'left' } },
          { content: poin != null ? `+${poin}` : '-', colSpan: 2 },
        ],
        [
          { content: 'SKOR AKHIR & PERINGKAT KELAS', colSpan: 3, styles: { halign: 'left' } },
          { content: skor != null ? `Skor ${skor}` : 'Skor -' },
          { content: rankText, colSpan: 2 },
        ],
      ],
      theme: 'grid',
      styles: { font: 'times', fontSize: 9.5, cellPadding: 1.6, lineColor: [148, 163, 184], lineWidth: 0.1, textColor: [30, 41, 59] },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center' },
      footStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left' },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'center', cellWidth: 22 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 30 },
      },
      didParseCell: (h) => {
        if (h.section === 'body' && h.column.index === 5) {
          const v = String(h.cell.raw);
          if (v === 'Tuntas') { h.cell.styles.textColor = [4, 120, 87]; h.cell.styles.fontStyle = 'bold'; }
          else if (v === 'Belum Tuntas') { h.cell.styles.textColor = [190, 18, 60]; h.cell.styles.fontStyle = 'bold'; }
          else { h.cell.styles.textColor = [100, 116, 139]; }
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ── REKAP KETIDAKHADIRAN (S / I / A) ──
    // Angka akhir = rekap presensi + koreksi wali kelas (sudah digabung pemanggil
    // di report.ketidakhadiran). Tanpa data presensi => 0 jujur, bukan angka karangan.
    const kd = rep.ketidakhadiran || {};
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['REKAP KETIDAKHADIRAN', 'Sakit', 'Izin', 'Tanpa Keterangan (Alpa)']],
      body: [[
        { content: 'Jumlah (semester ini)', styles: { fontStyle: 'bold' } },
        Number(kd.sakit ?? 0),
        Number(kd.izin ?? 0),
        Number(kd.alpha ?? 0),
      ]],
      theme: 'grid',
      styles: { font: 'times', fontSize: 9.5, cellPadding: 1.6, lineColor: [148, 163, 184], lineWidth: 0.1, textColor: [30, 41, 59], halign: 'center' },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'left', cellWidth: 70 } },
    });
    // Catatan kaki: y = baseline teks, jadi dikasih ruang ekstra dari tabel.
    y = doc.lastAutoTable.finalY + 5;
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Termasuk koreksi akhir Sakit / Izin / Alpa oleh wali kelas bila tersedia.', M, y);
    y += 5;

    // ── CATATAN & EVALUASI ──
    // Data yang kosong di DB dibiarkan kosong di PDF — tidak ada teks default palsu.
    const catatan = (student.catatan_wali_kelas ?? '').toString().trim();
    const prestasiText = (student.prestasi ?? '').toString().trim();
    const prestasiList = Array.isArray(rep.prestasiList) ? rep.prestasiList : [];
    const sikapSpr = (student.sikap_spiritual ?? '').toString().trim();
    const sikapSos = (student.sikap_sosial ?? '').toString().trim();
    const isGenap = semRaw === 'genap';
    const keputusanLabel = isGenap
      ? (KEPUTUSAN_LABEL[student.keputusan] ? (typeof KEPUTUSAN_LABEL[student.keputusan] === 'function'
        ? KEPUTUSAN_LABEL[student.keputusan](classInfo)
        : KEPUTUSAN_LABEL[student.keputusan]) : 'Belum ditetapkan')
      : null;

    // Estimasi tinggi blok agar tidak terpotong; jika penuh, pindah halaman.
    const prestasiLines = prestasiList.length
      ? prestasiList.length
      : (prestasiText ? doc.splitTextToSize(prestasiText, contentW - 8).length : 1);
    const catatanLines = catatan ? doc.splitTextToSize(catatan, contentW - 8).length : 1;
    const blockH = 22 + catatanLines * 5 + prestasiLines * 5 + (isGenap ? 12 : 0);
    if (y + blockH > pageH - 12) { doc.addPage(); y = 16; }

    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 33, 61);
    doc.text('CATATAN & EVALUASI', M, y, { align: 'left' });
    y += 2;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(M, y, pageW - M, y);
    y += 6;

    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Sikap Spiritual : ${dash(sikapSpr)}`, M + 2, y); y += 5.5;
    doc.text(`Sikap Sosial     : ${dash(sikapSos)}`, M + 2, y); y += 6.5;

    doc.setFont('times', 'bold');
    doc.text('Catatan Wali Kelas:', M + 2, y); y += 5;
    doc.setFont('times', 'normal');
    if (catatan) {
      const catatanWrapped = doc.splitTextToSize(catatan, contentW - 6);
      doc.text(catatanWrapped, M + 2, y);
      y += catatanWrapped.length * 5 + 2;
    } else {
      y += 8; // dikosongkan — wali kelas belum mengisi
    }

    doc.setFont('times', 'bold');
    doc.text('Prestasi / Penghargaan:', M + 2, y); y += 5;
    doc.setFont('times', 'normal');
    if (prestasiList.length) {
      // Rinci dari DB: nama kegiatan + tingkat + poin.
      prestasiList.forEach((p) => {
        const line = `• ${p.nama_kegiatan} (${p.tingkat}) — +${p.poin} poin`;
        const wrapped = doc.splitTextToSize(line, contentW - 8);
        doc.text(wrapped, M + 4, y);
        y += wrapped.length * 5;
      });
      y += 2;
    } else if (prestasiText) {
      const prestasiWrapped = doc.splitTextToSize(prestasiText, contentW - 6);
      doc.text(prestasiWrapped, M + 2, y);
      y += prestasiWrapped.length * 5 + 2;
    } else {
      y += 8; // dikosongkan — belum ada prestasi tercatat
    }

    // Kotak keputusan (semester genap): Naik ke Kelas ... / Lulus.
    if (isGenap) {
      const hasKeputusan = !!student.keputusan;
      if (hasKeputusan) doc.setDrawColor(30, 58, 138); else doc.setDrawColor(148, 163, 184);
      doc.setLineDashPattern(hasKeputusan ? [] : [0.6, 0.6], 0);
      doc.setLineWidth(0.3);
      doc.roundedRect(M + 2, y - 1, contentW - 4, 9, 1.5, 1.5);
      doc.setLineDashPattern([], 0);
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 33, 61);
      doc.text(`Keputusan Akhir Semester Genap: ${keputusanLabel}`, M + 6, y + 4.8);
      doc.setFont('times', 'normal');
      y += 13;
    }

    // ── TANDA TANGAN ──
    // Susunan: Orang Tua (kiri) + Wali Kelas (kanan), lalu blok "Mengetahui,
    // Kepala Sekolah" di tengah bawah. Nama & NIP diambil asli dari DB.
    const ttdBlockH = 84;
    if (y + ttdBlockH > pageH - 10) { doc.addPage(); y = 16; }

    const ty = y + 2;
    const leftX = M + 40;
    const rightX = pageW - M - 40;
    const centerX = pageW / 2;

    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Wali Kelas${className ? ` ${className}` : ''}`, rightX, ty, { align: 'center' });
    doc.text('Orang Tua / Wali Murid,', leftX, ty, { align: 'center' });

    // Ruang tanda tangan
    const nameY = ty + 28;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text(`${teacherName}${teacherTitle}`, rightX, nameY, { align: 'center' });
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.3);
    doc.line(rightX - 35, nameY + 1, rightX + 35, nameY + 1);
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`NIP. ${teacherNip}`, rightX, nameY + 5.5, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10.5);
    doc.text('( ______________________ )', leftX, nameY, { align: 'center' });

    // Blok "Mengetahui, Kepala Sekolah" (tengah, di bawah dua blok pertama).
    const kepNama = kepalaSekolah?.name ? String(kepalaSekolah.name) : '';
    const kepTitle = kepalaSekolah?.academic_title ? `, ${kepalaSekolah.academic_title}` : '';
    const kepNip = dash(kepalaSekolah?.nip);
    const kty = nameY + 16;
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Mengetahui,', centerX, kty, { align: 'center' });
    doc.text('Kepala Sekolah', centerX, kty + 5, { align: 'center' });
    const knameY = kty + 26;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text(kepNama ? `${kepNama}${kepTitle}` : '( ______________________ )', centerX, knameY, { align: 'center' });
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.3);
    doc.line(centerX - 38, knameY + 1, centerX + 38, knameY + 1);
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`NIP. ${kepNip}`, centerX, knameY + 5.5, { align: 'center' });

    // Watermark "DRAF SEMENTARA" bila rapor belum dipublikasikan wali kelas.
    if (draft) stampDraftWatermark(doc, pageW, pageH);

    // ── Simpan ──
    const safe = (s) => String(s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    const filename = `Rapor_${safe(student.name)}_${safe(className)}.pdf`;
    toast.dismiss(loadingToast);
    return { doc, filename };
  } catch (err) {
    console.error('Gagal mencetak rapor PDF:', err);
    const msg = (err && (err.message || String(err))) || 'kesalahan tidak diketahui';
    toast.error(`Gagal membuat rapor PDF: ${msg}`, { id: loadingToast, duration: 9000 });
    throw err;
  }
}

/**
 * Bangun rapor sebagai Blob URL utk pratinjau di layar (iframe).
 * Return { url, filename } — pemanggil WAJIB URL.revokeObjectURL(url) saat modal ditutup.
 */
export async function previewRaporPDF(params) {
  const built = await buildRaporPDF(params);
  if (!built) return null;
  const blob = built.doc.output('blob');
  toast.success('Pratinjau rapor siap.');
  return { url: URL.createObjectURL(blob), filename: built.filename };
}

// ══════════════════════════════════════════════════════════════════════════
//  Helper bersama + pembangun dokumen akademik tambahan (Rekap 1 Tahun &
//  Transkrip Nilai). Semua data dari DB; kosong tampil kosong (tanpa dummy).
// ══════════════════════════════════════════════════════════════════════════
const safeName = (s) => String(s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

async function loadPdfLibs() {
  const jsPdfModule = await import('jspdf');
  const jsPDF = jsPdfModule.jsPDF || jsPdfModule.default;
  if (typeof jsPDF !== 'function') throw new Error('jsPDF gagal dimuat. Coba hard-refresh (Ctrl+Shift+R).');
  const atModule = await import('jspdf-autotable');
  const autoTable = atModule.autoTable || atModule.default;
  if (typeof autoTable !== 'function') throw new Error('jspdf-autotable gagal dimuat.');
  return { jsPDF, autoTable };
}

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

function drawKop(doc, school, logo, M, pageW) {
  const logoH = 17;
  const logoW = Math.round(logoH * (logo.logoRatio || 1));
  let y = 13;
  if (logo.logoData) { try { doc.addImage(logo.logoData, 'PNG', M, y, logoW, logoH); } catch { /* lanjut tanpa logo */ } }
  const cx = pageW / 2;
  doc.setFont('times', 'bold'); doc.setFontSize(15); doc.setTextColor(20, 33, 61);
  doc.text(dash(school.school_name) === '-' ? FALLBACK_SCHOOL_NAME : school.school_name, cx, y + 5, { align: 'center' });
  doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.setTextColor(51, 65, 85);
  doc.text(dash(school.school_address), cx, y + 11, { align: 'center' });
  doc.text(`Telp. ${dash(school.school_phone)}  |  E-mail: ${dash(school.school_email)}  |  NPSN: ${dash(school.school_npsn)}`, cx, y + 16, { align: 'center' });
  const ruleY = y + 19;
  doc.setDrawColor(30, 58, 138); doc.setLineWidth(0.9); doc.line(M, ruleY, pageW - M, ruleY);
  doc.setLineWidth(0.3); doc.line(M, ruleY + 1.4, pageW - M, ruleY + 1.4);
  return ruleY + 11;
}

function stampDraftWatermark(doc, pageW, pageH) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    try {
      if (doc.GState && doc.saveGraphicsState) {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.12 }));
        doc.setFont('helvetica', 'bold'); doc.setFontSize(58); doc.setTextColor(220, 38, 38);
        doc.text('DRAF SEMENTARA', pageW / 2, pageH / 2, { align: 'center', angle: 45 });
        doc.restoreGraphicsState();
      } else {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(58); doc.setTextColor(226, 232, 240);
        doc.text('DRAF SEMENTARA', pageW / 2, pageH / 2, { align: 'center', angle: 45 });
      }
    } catch { /* watermark opsional — abaikan bila API tak tersedia */ }
  }
}

function drawSignatures(doc, { M, pageW, pageH, y, className, wali, kepala, includeOrangTua = false, fallbackTeacherName = 'Bapak/Ibu Guru' }) {
  const blockH = 84;
  if (y + blockH > pageH - 10) { doc.addPage(); y = 16; }
  const centerX = pageW / 2;
  const leftX = M + 40;
  const rightX = pageW - M - 40;
  const ty = y + 2;
  const waliName = wali?.name || fallbackTeacherName;
  const waliTitle = wali?.academic_title ? `, ${wali.academic_title}` : '';
  const waliNip = dash(wali?.nip);

  doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 41, 59);
  doc.text(`Wali Kelas${className ? ` ${className}` : ''}`, rightX, ty, { align: 'center' });
  if (includeOrangTua) doc.text('Orang Tua / Wali Murid,', leftX, ty, { align: 'center' });

  const nameY = ty + 28;
  doc.setFont('times', 'bold'); doc.setFontSize(11);
  doc.text(`${waliName}${waliTitle}`, rightX, nameY, { align: 'center' });
  doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.3); doc.line(rightX - 35, nameY + 1, rightX + 35, nameY + 1);
  doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(51, 65, 85);
  doc.text(`NIP. ${waliNip}`, rightX, nameY + 5.5, { align: 'center' });
  if (includeOrangTua) { doc.setTextColor(30, 41, 59); doc.setFontSize(10.5); doc.text('( ______________________ )', leftX, nameY, { align: 'center' }); }

  const kepNama = kepala?.name ? String(kepala.name) : '';
  const kepTitle = kepala?.academic_title ? `, ${kepala.academic_title}` : '';
  const kepNip = dash(kepala?.nip);
  const kty = nameY + 16;
  doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 41, 59);
  doc.text('Mengetahui,', centerX, kty, { align: 'center' });
  doc.text('Kepala Sekolah', centerX, kty + 5, { align: 'center' });
  const knameY = kty + 26;
  doc.setFont('times', 'bold'); doc.setFontSize(11);
  doc.text(kepNama ? `${kepNama}${kepTitle}` : '( ______________________ )', centerX, knameY, { align: 'center' });
  doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.3); doc.line(centerX - 38, knameY + 1, centerX + 38, knameY + 1);
  doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(51, 65, 85);
  doc.text(`NIP. ${kepNip}`, centerX, knameY + 5.5, { align: 'center' });
  return knameY + 8;
}

/** Rekap hasil belajar SATU TAHUN ajaran (Ganjil vs Genap). */
async function buildAnnualPDF({ student, classInfo = null, homeroomTeacher = null, kepalaSekolah = null, annual = null, draft = false }) {
  if (!student || !annual) return null;
  const loadingToast = toast.loading('Menyiapkan Rekap 1 Tahun...');
  try {
    const school = await loadSchoolProfile();
    const { jsPDF, autoTable } = await loadPdfLibs();
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), M = 15;
    const logo = await loadLogoAsset();
    let y = drawKop(doc, school, logo, M, pageW);
    const className = classInfo?.name || '-';
    const ta = annual.tahun_ajaran || '-';

    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 33, 61);
    doc.text('REKAPITULASI HASIL BELAJAR SATU TAHUN AJARAN', pageW / 2, y, { align: 'center' });
    y += 9;
    doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 41, 59);
    doc.text(`Nama : ${student.name || '-'}`, M, y);
    doc.text(`Kelas : ${className}`, M + Math.round((pageW - 2 * M) * 0.42), y);
    doc.text(`Tahun Ajaran : ${ta}`, M + Math.round((pageW - 2 * M) * 0.72), y);
    y += 8;

    const rows = (annual.rows || []).map((r, i) => [i + 1, r.subject_name || '-', r.ganjil ?? '-', r.genap ?? '-', r.rata ?? '-', r.keterangan || '-']);
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['No', 'Mata Pelajaran', 'Nilai Ganjil', 'Nilai Genap', 'Rata-rata 1 Tahun', 'Keterangan']],
      body: rows.length ? rows : [['-', 'Belum ada data nilai pada tahun ajaran ini', '-', '-', '-', '-']],
      foot: [[{ content: 'RATA-RATA TAHUNAN', colSpan: 4, styles: { halign: 'left' } }, annual.yearly_average ?? '-', '']],
      theme: 'grid',
      styles: { font: 'times', fontSize: 9.5, cellPadding: 1.6, lineColor: [148, 163, 184], lineWidth: 0.1, textColor: [30, 41, 59] },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center' },
      footStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 1: { halign: 'left' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center', cellWidth: 28 }, 5: { halign: 'center', cellWidth: 30 } },
    });
    y = doc.lastAutoTable.finalY + 8;

    const a = annual.attendance || {};
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['REKAP KETIDAKHADIRAN 1 TAHUN', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Persentase Kehadiran']],
      body: [['Jumlah', a.hadir ?? 0, a.sakit ?? 0, a.izin ?? 0, a.alpha ?? 0, a.percentage != null ? `${a.percentage}%` : '-']],
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
      styles: { font: 'times', fontSize: 9.5, cellPadding: 1.6, halign: 'center', textColor: [30, 41, 59] },
      columnStyles: { 0: { halign: 'left', cellWidth: 70 } },
    });
    y = doc.lastAutoTable.finalY + 6;

    const naik = annual.kenaikan || {};
    const naikLabel = naik.status
      ? (naik.status === 'naik' ? `Naik ke Kelas ${nextLevel(classInfo?.level)}`
        : naik.status === 'tidak_naik' ? 'Tidak Naik Kelas'
          : naik.status === 'lulus' ? 'Lulus'
            : naik.status === 'tidak_lulus' ? 'Tidak Lulus' : String(naik.status))
      : 'Belum ditetapkan';
    doc.setFont('times', 'bold'); doc.setFontSize(10.5); doc.setTextColor(20, 33, 61);
    doc.text(`Status Kenaikan Tingkat: ${naikLabel}`, M, y);
    if (!naik.published) {
      doc.setFont('times', 'italic'); doc.setFontSize(8.5); doc.setTextColor(180, 83, 9);
      doc.text('  (belum dipublikasikan wali kelas)', M + doc.getTextWidth(`Status Kenaikan Tingkat: ${naikLabel}`), y);
    }
    y += 12;

    drawSignatures(doc, { M, pageW, pageH, y, className, wali: homeroomTeacher, kepala: kepalaSekolah, includeOrangTua: false });
    if (draft) stampDraftWatermark(doc, pageW, pageH);

    const filename = `Rekap_1Tahun_${safeName(student.name)}_${safeName(ta)}.pdf`;
    toast.dismiss(loadingToast);
    return { doc, filename };
  } catch (err) {
    console.error('Gagal membuat Rekap 1 Tahun PDF:', err);
    toast.error(`Gagal membuat PDF: ${(err && err.message) || 'kesalahan tidak diketahui'}`, { id: loadingToast, duration: 9000 });
    throw err;
  }
}

/** Transkrip nilai lintas semester/tingkat (tanpa peringkat). */
async function buildTranscriptPDF({ student, classInfo = null, kepalaSekolah = null, transcript = null }) {
  if (!student || !transcript) return null;
  const loadingToast = toast.loading('Menyiapkan Transkrip Nilai...');
  try {
    const school = await loadSchoolProfile();
    const { jsPDF, autoTable } = await loadPdfLibs();
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), M = 15;
    const logo = await loadLogoAsset();
    let y = drawKop(doc, school, logo, M, pageW);
    const className = classInfo?.name || '-';

    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 33, 61);
    doc.text('TRANSKRIP NILAI PESERTA DIDIK', pageW / 2, y, { align: 'center' });
    y += 9;
    doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 41, 59);
    doc.text(`Nama : ${student.name || '-'}`, M, y);
    doc.text(`NISN : ${student.nisn || '-'}`, M + Math.round((pageW - 2 * M) * 0.45), y);
    y += 5.5;
    doc.text(`Kelas Terakhir : ${className}`, M, y);
    y += 8;

    const groups = transcript.groups || [];
    const body = [];
    let no = 0;
    groups.forEach((grp) => {
      const semLabel = String(grp.semester || '').toLowerCase() === 'genap' ? 'Genap' : 'Ganjil';
      const level = grp.level || (grp.class_name ? String(grp.class_name).split(' ')[0] : '');
      body.push([{ content: `${grp.tahun_ajaran}  ·  Semester ${semLabel}${level ? `  ·  Tingkat ${level}` : ''}`, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [238, 242, 255], halign: 'left' } }]);
      (grp.rows || []).forEach((r) => {
        no += 1;
        body.push([no, r.subject_name || '-', r.class_name || '-', r.akhir ?? '-', predikatHuruf(r.akhir)]);
      });
    });

    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['No', 'Mata Pelajaran', 'Kelas', 'Nilai Akhir', 'Predikat']],
      body: body.length ? body : [['-', 'Belum ada nilai yang pernah ditempuh', '-', '-', '-']],
      theme: 'grid',
      styles: { font: 'times', fontSize: 9.5, cellPadding: 1.6, lineColor: [148, 163, 184], lineWidth: 0.1, textColor: [30, 41, 59] },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { halign: 'center', cellWidth: 12 }, 1: { halign: 'left' }, 2: { halign: 'center', cellWidth: 30 }, 3: { halign: 'center', cellWidth: 24 }, 4: { halign: 'center', cellWidth: 20 } },
    });
    y = doc.lastAutoTable.finalY + 8;

    doc.setFont('times', 'bold'); doc.setFontSize(10.5); doc.setTextColor(20, 33, 61);
    doc.text(`Total Mata Pelajaran : ${transcript.total_mapel ?? 0}`, M, y); y += 6;
    doc.text(`Rata-Rata Kumulatif : ${transcript.cumulative_average != null ? transcript.cumulative_average : '-'}`, M, y); y += 10;

    drawSignatures(doc, { M, pageW, pageH, y, className, wali: null, kepala: kepalaSekolah, includeOrangTua: false });

    const filename = `Transkrip_${safeName(student.name)}.pdf`;
    toast.dismiss(loadingToast);
    return { doc, filename };
  } catch (err) {
    console.error('Gagal membuat Transkrip PDF:', err);
    toast.error(`Gagal membuat PDF: ${(err && err.message) || 'kesalahan tidak diketahui'}`, { id: loadingToast, duration: 9000 });
    throw err;
  }
}

export async function previewAnnualPDF(params) {
  const built = await buildAnnualPDF(params);
  if (!built) return null;
  const blob = built.doc.output('blob');
  toast.success('Pratinjau Rekap 1 Tahun siap.');
  return { url: URL.createObjectURL(blob), filename: built.filename };
}

export async function previewTranscriptPDF(params) {
  const built = await buildTranscriptPDF(params);
  if (!built) return null;
  const blob = built.doc.output('blob');
  toast.success('Pratinjau Transkrip Nilai siap.');
  return { url: URL.createObjectURL(blob), filename: built.filename };
}
