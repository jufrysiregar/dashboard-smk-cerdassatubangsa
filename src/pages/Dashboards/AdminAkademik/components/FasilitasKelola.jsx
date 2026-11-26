import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X as XIcon, Loader2, Building2, Package, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';
import ConfirmDialog from '../../../../components/dashboard/shared/ConfirmDialog';
import { FasilitasDetailModal } from '../../../../components/dashboard/shared/FasilitasItemDetail';
import ModalCloseControl from '../../../../components/dashboard/shared/ModalCloseControl';
import useEscapeKey from '../../../../utils/useEscapeKey';

// Notifikasi: selalu 1 baris, tapi animasi "masuk" terputar ulang tiap trigger (id baru + dismiss
// yang lama), hilang otomatis (error 3 detik / sukses 3,2 detik) bila tidak dipicu lagi.
let lastAlertId = null;
const notifyError = (text) => { if (lastAlertId) toast.dismiss(lastAlertId); const id = `fas-${Date.now()}`; lastAlertId = id; toast.error(text, { id, duration: 3000, style: { maxWidth: '420px', fontSize: '12px', fontWeight: 800 } }); };
const notifySuccess = (text) => { if (lastAlertId) toast.dismiss(lastAlertId); const id = `fas-${Date.now()}`; lastAlertId = id; toast.success(text, { id, duration: 3200 }); };

/**
 * FasilitasKelola — interaksi Card Fasilitas Admin Akademik (pola dropdown + form dinamis,
 * mengikuti Kegiatan Ekstra). mode='manage' = 3 opsi form; mode='detail' = ringkasan 2 tab.
 * Opsi Ruangan mendukung PELETAKAN isi dari 3 sumber: aset Operator (Umum), aset Pusjur
 * (Jurusan, read-only), dan input manual — disimpan nyata ke kolom contents ruangan.
 */
const STATUS_LABEL = { baik: 'Baik', rusak: 'Rusak', perbaikan: 'Perbaikan', dipinjam: 'Dipinjam' };

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const lblCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400';

const JENIS_OPTIONS = [
  { value: 'peralatan', label: 'Tambah Peralatan / Barang', Icon: Package },
  { value: 'ruangan', label: 'Tambah Ruangan & Peletakan Isi Fasilitas', Icon: Building2 },
  { value: 'laporan', label: 'Laporan Kondisi & Peminjaman', Icon: ClipboardList },
];

const emptyEquip = { name: '', funding_source: 'dana_bos', quantity: '', ownership: 'umum', jurusan_id: '' };
const emptyRoom = { name: '', ownership: 'umum', jurusan_id: '', capacity: '' };
const emptyLapor = { asset_type: 'inventaris', asset_id: '', status: 'baik', peminjam_nama: '', tanggal_pinjam: '', notes: '' };

export default function FasilitasKelola({ api, mode = 'manage', onSync, onClose }) {
  const [data, setData] = useState({ rooms: [], inventories: [], borrowings: [], references: {} });
  const [loading, setLoading] = useState(true);

  const [jenis, setJenis] = useState('');
  const [saving, setSaving] = useState(false);
  const [equipForm, setEquipForm] = useState(emptyEquip);
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [roomContents, setRoomContents] = useState([]); // {name, quantity, inventory_id, source}
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [laporForm, setLaporForm] = useState(emptyLapor);

  const [tab, setTab] = useState('umum');
  const [confirm, setConfirm] = useState(null);
  const [rincian, setRincian] = useState(null); // { id, form, saving }
  const closeRincian = useCallback(() => setRincian((r) => (r && !r.saving ? null : r)), []);
  useEscapeKey(Boolean(rincian), closeRincian);
  const [detail, setDetail] = useState(null); // id inventaris untuk Modal Detail (baris live diambil dari data)
  const [savingKembali, setSavingKembali] = useState(null); // id peminjaman yang sedang dikembalikan

  const refs = data.references || {};
  const umumEquip = useMemo(() => (data.inventories || []).filter((i) => i.kepemilikan === 'umum'), [data]);
  const jurusanEquip = useMemo(() => (data.inventories || []).filter((i) => i.kepemilikan === 'jurusan'), [data]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getFasilitas();
      setData({ rooms: [], inventories: [], borrowings: [], references: {}, ...(res.data?.data || {}) });
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Gagal memuat data fasilitas.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);
  useBodyScrollLock(!!rincian || !!detail);

  // Silent auto-sync: polling 16 detik + fokus/visibility tab — tanpa spinner (tidak berkedip),
  // sehingga perubahan status pinjam dari Pusat Jurusan langsung ter-update di sisi Operator.
  const pollSilent = useCallback(async () => {
    if (document.hidden) return;
    try {
      const res = await api.getFasilitas();
      setData({ rooms: [], inventories: [], borrowings: [], references: {}, ...(res.data?.data || {}) });
    } catch { /* abaikan kegagalan sesaat */ }
  }, [api]);
  useEffect(() => {
    const t = setInterval(pollSilent, 16000);
    const onFocus = () => pollSilent();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [pollSilent]);

  const resetForms = () => {
    setEquipForm(emptyEquip); setRoomForm(emptyRoom); setRoomContents([]);
    setManualName(''); setManualQty('1'); setLaporForm(emptyLapor); setJenis('');
  };

  // ── isi ruangan: tambah/hapus chip ────────────────────────────────
  const addFromList = (list, id, source) => {
    const it = list.find((x) => String(x.id) === String(id));
    if (!it) return;
    if (roomContents.some((c) => c.inventory_id && String(c.inventory_id) === String(it.id))) {
      toast('Item sudah ditambahkan.', { id: 'fas-dup-item' }); return;
    }
    setRoomContents((prev) => [...prev, { name: it.nama, quantity: 1, inventory_id: it.id, source }]);
  };
  const addManual = () => {
    const name = manualName.trim();
    if (!name) { notifyError('Isi nama alat manual.'); return; }
    setRoomContents((prev) => [...prev, { name, quantity: Math.max(1, Number(manualQty || 1)), inventory_id: null, source: 'manual' }]);
    setManualName(''); setManualQty('1');
  };
  const removeContent = (idx) => setRoomContents((prev) => prev.filter((_, i) => i !== idx));

  // ── MANAGE submit ──────────────────────────────────────────────────
  const submitManage = async () => {
    setSaving(true);
    try {
      if (jenis === 'peralatan') {
        if (!equipForm.name || equipForm.quantity === '') { notifyError('Nama & jumlah wajib diisi.'); setSaving(false); return; }
        if (equipForm.ownership === 'jurusan' && !equipForm.jurusan_id) { notifyError('Pilih jurusan untuk kepemilikan.'); setSaving(false); return; }
        await api.createFasilitasInventory({
          name: equipForm.name,
          funding_source: equipForm.funding_source || null,
          quantity: Number(equipForm.quantity),
          jurusan_id: equipForm.ownership === 'jurusan' ? Number(equipForm.jurusan_id) : null,
        });
        notifySuccess('Peralatan berhasil ditambahkan.');
      } else if (jenis === 'ruangan') {
        if (!roomForm.name || roomForm.capacity === '') { notifyError('Nama & kapasitas ruangan wajib diisi.'); setSaving(false); return; }
        if (roomForm.ownership === 'jurusan' && !roomForm.jurusan_id) { notifyError('Pilih jurusan untuk ruang praktek.'); setSaving(false); return; }
        await api.createFasilitasRoom({
          name: roomForm.name,
          room_type: roomForm.ownership === 'jurusan' ? 'lab_praktik' : 'ruang_kelas',
          capacity: Number(roomForm.capacity),
          status: 'baik',
          jurusan_id: roomForm.ownership === 'jurusan' ? Number(roomForm.jurusan_id) : null,
          contents: roomContents,
        });
        notifySuccess('Ruangan & isi fasilitas berhasil disimpan.');
      } else if (jenis === 'laporan') {
        if (!laporForm.asset_id) { notifyError('Pilih aset yang akan dilaporkan.'); setSaving(false); return; }
        if (laporForm.status === 'dipinjam' && (!laporForm.peminjam_nama || !laporForm.tanggal_pinjam)) { notifyError('Isi nama peminjam & tanggal saat Dipinjam.'); setSaving(false); return; }
        if (['rusak', 'perbaikan'].includes(laporForm.status) && !laporForm.notes) { notifyError('Isi keterangan kerusakan.'); setSaving(false); return; }
        await api.updateFasilitasStatus(Number(laporForm.asset_id), {
          asset_type: laporForm.asset_type,
          status: laporForm.status,
          peminjam_nama: laporForm.status === 'dipinjam' ? laporForm.peminjam_nama : null,
          tanggal_pinjam: laporForm.status === 'dipinjam' ? laporForm.tanggal_pinjam : null,
          notes: laporForm.notes || null,
        });
        notifySuccess('Status aset diperbarui.');
      }
      resetForms();
      onSync?.();
      onClose?.();
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Gagal menyimpan. Periksa kembali isian.');
    } finally {
      setSaving(false);
    }
  };

  // ── DETAIL actions ─────────────────────────────────────────────────
  // Ubah status tidak lagi inline; memakai Pop-Up Modal Edit Rincian Barang.
  const openRincian = (row) => {
    setRincian({
      id: row.id,
      saving: false,
      form: {
        name: row.nama || '',
        funding_source: row.funding_source || 'dana_bos',
        quantity: row.jumlah ?? '',
        qty_baik: row.qty_baik ?? 0,
        qty_rusak: row.qty_rusak ?? 0,
        qty_dipinjam: row.qty_dipinjam ?? 0,
        qty_perbaikan: row.qty_perbaikan ?? 0,
        qty_hilang: row.qty_hilang ?? 0,
        status_note: row.status_note || '',
      },
    });
  };

  const setRincianField = (key, val) => setRincian((r) => ({ ...r, form: { ...r.form, [key]: val } }));

  const saveRincian = async () => {
    const f = rincian.form;
    const total = Number(f.quantity || 0);
    const rincianSum = [f.qty_baik, f.qty_rusak, f.qty_dipinjam, f.qty_perbaikan, f.qty_hilang].reduce((a, b) => a + Number(b || 0), 0);
    if (!f.name) { notifyError('Nama barang wajib diisi.'); return; }
    if (total < 1) { notifyError('Total barang minimal 1.'); return; }
    if (rincianSum !== total) { notifyError(`Total rincian (${rincianSum}) harus sama dengan total barang (${total}).`); return; }
    setRincian((r) => ({ ...r, saving: true }));
    try {
      await api.updateFasilitasInventory(rincian.id, {
        name: f.name,
        funding_source: f.funding_source || null,
        quantity: total,
        qty_baik: Number(f.qty_baik || 0),
        qty_rusak: Number(f.qty_rusak || 0),
        qty_dipinjam: Number(f.qty_dipinjam || 0),
        qty_perbaikan: Number(f.qty_perbaikan || 0),
        qty_hilang: Number(f.qty_hilang || 0),
        status_note: f.status_note || null,
      });
      notifySuccess('Rincian barang tersimpan.');
      setRincian(null);
      await load();
      onSync?.();
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Gagal menyimpan rincian.');
      setRincian((r) => ({ ...r, saving: false }));
    }
  };

  const askDelete = (row) => {
    setConfirm({
      title: 'Hapus Fasilitas',
      message: `Hapus "${row.nama}" dari daftar? Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Ya, Hapus',
      onConfirm: async () => {
        try {
          if (row._type === 'ruangan') await api.deleteFasilitasRoom(row.id);
          else await api.deleteFasilitasInventory(row.id);
          notifySuccess('Data berhasil dihapus.');
          setConfirm(null); await load(); onSync?.();
        } catch (e) { notifyError(e?.response?.data?.message || 'Gagal menghapus.'); }
      },
    });
  };

  const kembalikanPinjam = async (b) => {
    setSavingKembali(b.id);
    try {
      await api.kembalikanFasilitasPinjam(b.id, {});
      notifySuccess(`Dikembalikan ${b.jumlah} unit ${b.objek_nama}.`);
      await load();
      onSync?.();
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Gagal mengembalikan.');
    } finally {
      setSavingKembali(null);
    }
  };

  const detailRows = useMemo(() => {
    const rooms = (data.rooms || []).map((r) => ({ ...r, _type: 'ruangan', _kategori: r.tipe, _contents: r.contents || [] }));
    const invs = (data.inventories || []).map((i) => ({
      ...i, _type: 'inventaris', _kategori: i.funding_source_label || i.kategori, _contents: [],
      _rincian: [
        { label: 'Baik', value: i.qty_baik ?? 0, cls: 'text-emerald-700' },
        { label: 'Rusak', value: i.qty_rusak ?? 0, cls: 'text-rose-700' },
        { label: 'Dipinjam', value: i.qty_dipinjam ?? 0, cls: 'text-sky-700' },
        { label: 'Perbaikan', value: i.qty_perbaikan ?? 0, cls: 'text-amber-700' },
        { label: 'Hilang', value: i.qty_hilang ?? 0, cls: 'text-slate-600' },
      ],
    }));
    return [...rooms, ...invs].filter((r) => (tab === 'umum' ? r.kepemilikan === 'umum' : r.kepemilikan === 'jurusan'));
  }, [data, tab]);

  // KELOLA (manage) langsung tampil — form tidak butuh data utk render; daftar aset terisi sendiri saat fetch selesai.
  // Loading hanya utk DETAIL (list yang memang butuh data).
  if (loading && mode === 'detail') {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Memuat data fasilitas...</div>;
  }

  return (
    <div className={mode === 'manage' ? 'flex min-h-0 flex-1 flex-col' : ''}>
      {mode === 'manage' ? renderManage() : renderDetail()}
      {rincian && renderRincianModal()}
      {detail && (
        <FasilitasDetailModal
          item={(data.inventories || []).find((i) => String(i.id) === String(detail)) || null}
          borrowings={data.borrowings || []}
          canKembalikan={() => tab === 'umum'}
          onKembalikan={kembalikanPinjam}
          savingId={savingKembali}
          onClose={() => setDetail(null)}
        />
      )}
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );

  function renderManage() {
    return (
      <>
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <label className={lblCls}>Pilih Jenis Pengelolaan Fasilitas <span className="text-rose-500">*</span></label>
          <select value={jenis} onChange={(e) => setJenis(e.target.value)} className={inputCls}>
            <option value="">— Silahkan pilih jenis pengelolaan fasilitas —</option>
            {JENIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {jenis === 'peralatan' && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nama Alat / Barang" full><input value={equipForm.name} onChange={(e) => setEquipForm({ ...equipForm, name: e.target.value })} className={inputCls} placeholder="misal: Proyektor, Papan Tulis, Spidol" /></Field>
              <Field label="Jenis Pengadaan / Kategori"><select value={equipForm.funding_source} onChange={(e) => setEquipForm({ ...equipForm, funding_source: e.target.value })} className={inputCls}>{(refs.funding_sources || []).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></Field>
              <Field label="Jumlah Unit"><input type="number" min="1" value={equipForm.quantity} onChange={(e) => setEquipForm({ ...equipForm, quantity: e.target.value })} className={inputCls} placeholder="0" /></Field>
              <Field label="Kepemilikan"><select value={equipForm.ownership} onChange={(e) => setEquipForm({ ...equipForm, ownership: e.target.value })} className={inputCls}><option value="umum">Umum / Operator</option><option value="jurusan">Alokasi ke Jurusan</option></select></Field>
              {equipForm.ownership === 'jurusan' && <Field label="Pilih Jurusan"><select value={equipForm.jurusan_id} onChange={(e) => setEquipForm({ ...equipForm, jurusan_id: e.target.value })} className={inputCls}><option value="">— Pilih jurusan —</option>{(refs.jurusans || []).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}</select></Field>}
            </div>
          </div>
        )}

        {jenis === 'ruangan' && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nama Ruangan" full><input value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} className={inputCls} placeholder="contoh: Lab TKJ 1, Ruang Kelas X-A" /></Field>
              <Field label="Jenis Ruangan"><select value={roomForm.ownership} onChange={(e) => setRoomForm({ ...roomForm, ownership: e.target.value })} className={inputCls}><option value="umum">Ruang Belajar Umum</option><option value="jurusan">Ruang Praktek Jurusan</option></select></Field>
              {roomForm.ownership === 'jurusan' && <Field label="Pilih Jurusan"><select value={roomForm.jurusan_id} onChange={(e) => setRoomForm({ ...roomForm, jurusan_id: e.target.value })} className={inputCls}><option value="">— Pilih jurusan —</option>{(refs.jurusans || []).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}</select></Field>}
              <Field label="Kapasitas"><input type="number" min="0" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} className={inputCls} placeholder="Jumlah orang" /></Field>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Isi Peralatan di Dalam Ruangan</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className={lblCls}>Pilih dari Peralatan Operator (Umum)</span>
                  <select value="" onChange={(e) => { addFromList(umumEquip, e.target.value, 'umum'); }} className={inputCls} disabled={umumEquip.length === 0}>
                    <option value="">{umumEquip.length ? '— Pilih peralatan —' : 'Belum ada peralatan umum'}</option>
                    {umumEquip.map((i) => <option key={i.id} value={i.id}>{i.nama} ({i.jumlah} {i.unit})</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={lblCls}>Pilih dari Peralatan Praktik Pusjur (Jurusan)</span>
                  <select value="" onChange={(e) => { addFromList(jurusanEquip, e.target.value, 'jurusan'); }} className={inputCls} disabled={jurusanEquip.length === 0}>
                    <option value="">{jurusanEquip.length ? '— Pilih peralatan (read-only) —' : 'Belum ada peralatan jurusan'}</option>
                    {jurusanEquip.map((i) => <option key={i.id} value={i.id}>{i.nama} — {i.jurusan || 'Jurusan'}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px_auto]">
                <label className="space-y-1"><span className={lblCls}>Input Manual Nama Alat</span><input value={manualName} onChange={(e) => setManualName(e.target.value)} className={inputCls} placeholder="misal: AC, Kursi" /></label>
                <label className="space-y-1"><span className={lblCls}>Jumlah</span><input type="number" min="1" value={manualQty} onChange={(e) => setManualQty(e.target.value)} className={inputCls} /></label>
                <button type="button" onClick={addManual} className="self-end inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100"><Plus size={15} /> Tambah</button>
              </div>

              <div className="flex flex-wrap gap-2">
                {roomContents.length === 0 ? (
                  <p className="text-[11px] font-bold text-slate-400">Belum ada isi ruangan. Tambahkan dari salah satu sumber di atas.</p>
                ) : roomContents.map((c, idx) => (
                  <span key={idx} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${c.source === 'manual' ? 'bg-slate-100 text-slate-700' : c.source === 'jurusan' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {c.name} × {c.quantity}
                    <span className="text-[9px] uppercase opacity-60">{c.source}</span>
                    <button type="button" onClick={() => removeContent(idx)} className="text-slate-400 hover:text-rose-600"><XIcon size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {jenis === 'laporan' && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Jenis Aset"><select value={laporForm.asset_type} onChange={(e) => { setLaporForm({ ...laporForm, asset_type: e.target.value, asset_id: '' }); }} className={inputCls}><option value="inventaris">Peralatan / Barang</option><option value="ruangan">Ruangan</option></select></Field>
              <Field label="Pilih Aset"><select value={laporForm.asset_id} onChange={(e) => setLaporForm({ ...laporForm, asset_id: e.target.value })} className={inputCls}><option value="">— Pilih aset —</option>{(laporForm.asset_type === 'ruangan' ? data.rooms : data.inventories).filter((a) => a.kepemilikan === 'umum').map((a) => <option key={a.id} value={a.id}>{a.nama} ({STATUS_LABEL[a.status] || 'Baik'})</option>)}</select></Field>
              <Field label="Ubah Status Menjadi"><select value={laporForm.status} onChange={(e) => setLaporForm({ ...laporForm, status: e.target.value })} className={inputCls}>{Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
              {laporForm.status === 'dipinjam' && <Field label="Nama Peminjam"><input value={laporForm.peminjam_nama} onChange={(e) => setLaporForm({ ...laporForm, peminjam_nama: e.target.value })} className={inputCls} placeholder="Nama peminjam" /></Field>}
              {laporForm.status === 'dipinjam' && <Field label="Tanggal Pinjam"><input type="date" value={laporForm.tanggal_pinjam} onChange={(e) => setLaporForm({ ...laporForm, tanggal_pinjam: e.target.value })} className={inputCls} /></Field>}
              {['rusak', 'perbaikan'].includes(laporForm.status) && <Field label="Keterangan Kerusakan" full><textarea rows={2} value={laporForm.notes} onChange={(e) => setLaporForm({ ...laporForm, notes: e.target.value })} className={inputCls} placeholder="Jelaskan kondisi kerusakan" /></Field>}
            </div>
          </div>
        )}
        </div>

        {/* FOOTER terpisah — sama seperti modal kartu akademik lain */}
        <div className="border-t border-slate-100 px-6 sm:px-8 py-5" style={{ backgroundColor: '#F1F5F9' }}>
          {jenis
            ? <SubmitBar saving={saving} onSubmit={submitManage} />
            : <p className="text-center text-[11px] font-bold text-slate-400">Pilih jenis pengelolaan untuk menampilkan tombol Simpan</p>}
        </div>
      </>
    );
  }

  function renderDetail() {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button onClick={() => setTab('umum')} className={`rounded-xl px-4 py-2 text-sm font-black transition ${tab === 'umum' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Fasilitas Umum</button>
            <button onClick={() => setTab('jurusan')} className={`rounded-xl px-4 py-2 text-sm font-black transition ${tab === 'jurusan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Fasilitas Jurusan</button>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${tab === 'umum' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{tab === 'umum' ? 'Kelola Penuh' : 'Read-Only'}</span>
        </div>
        <div className="space-y-2">
          {detailRows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm font-bold text-slate-400">Belum ada data fasilitas untuk ditampilkan.</div>
          ) : detailRows.map((row) => (
            <div key={`${row._type}-${row.id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800">{row.nama} <span className="ml-1 text-[10px] font-black uppercase text-slate-400">{row._type === 'ruangan' ? 'Ruangan' : 'Barang'}</span></p>
                  <p className="text-[11px] font-bold text-slate-400">
                    {row._kategori} · {row._type === 'inventaris' ? `Total ${row.jumlah} ${row.unit || 'unit'}` : `Kapasitas ${row.kapasitas} orang`} · {tab === 'jurusan' ? (row.jurusan || 'Jurusan') : 'Fasilitas Umum'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row._type === 'inventaris' && (
                    <button onClick={() => setDetail(row.id)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase text-indigo-600 transition hover:bg-indigo-50">Detail</button>
                  )}
                  {tab === 'umum' && row._type === 'inventaris' && (
                    <button onClick={() => openRincian(row)} className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-amber-600 transition hover:bg-amber-500 hover:text-white">Edit</button>
                  )}
                  {tab === 'umum' && <button onClick={() => askDelete(row)} className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-rose-600 transition hover:bg-rose-500 hover:text-white">Hapus</button>}
                </div>
              </div>
              {row._type === 'inventaris' && row.status_note && (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="text-[11px] font-semibold italic text-slate-400">Catatan: {row.status_note}</p>
                </div>
              )}
              {row._type === 'ruangan' && row._contents.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {row._contents.map((c, idx) => (
                    <span key={idx} className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">{c.name} × {c.quantity}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderRincianModal() {
    const f = rincian.form;
    const total = Number(f.quantity || 0);
    const sum = [f.qty_baik, f.qty_rusak, f.qty_dipinjam, f.qty_perbaikan, f.qty_hilang].reduce((a, b) => a + Number(b || 0), 0);
    const selisih = total - sum;
    const num = (key, label) => (
      <label key={key} className="space-y-1">
        <span className={lblCls}>{label}</span>
        <input type="number" min="0" value={f[key]} onChange={(e) => setRincianField(key, e.target.value)} className={inputCls} />
      </label>
    );
    const close = () => !rincian.saving && setRincian(null);
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl" />
        <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4" style={{ backgroundColor: '#F1F5F9' }}>
            <h3 className="text-base font-black text-slate-900">Edit Rincian Barang</h3>
            <div className="flex items-center gap-2">
              <ModalCloseControl onClose={close} />
            </div>
          </div>

          <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nama Barang" full><input value={f.name} onChange={(e) => setRincianField('name', e.target.value)} className={inputCls} /></Field>
              <Field label="Jenis Pengadaan"><select value={f.funding_source} onChange={(e) => setRincianField('funding_source', e.target.value)} className={inputCls}>{(refs.funding_sources || []).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
              <Field label="Total Barang"><input type="number" min="0" value={f.quantity} onChange={(e) => setRincianField('quantity', e.target.value)} className={inputCls} /></Field>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Rincian Jumlah per Kondisi</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {num('qty_baik', 'Baik')}
                {num('qty_rusak', 'Rusak')}
                {num('qty_dipinjam', 'Dipinjam')}
                {num('qty_perbaikan', 'Perbaikan')}
                {num('qty_hilang', 'Hilang')}
              </div>
              <div className={`mt-3 flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-black ${selisih === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                <span>Total rincian: {sum} / {total}</span>
                <span>{selisih === 0 ? 'Seimbang' : `Selisih: ${selisih > 0 ? '+' : ''}${selisih}`}</span>
              </div>
            </div>

            <Field label="Catatan Kondisi (info peminjam / kronologi)" full><textarea rows={2} value={f.status_note} onChange={(e) => setRincianField('status_note', e.target.value)} className={inputCls} placeholder="misal: 2 unit dipinjam Pak Budi tgl 19/11" /></Field>
          </div>

          <div className="border-t border-slate-100 px-6 py-5" style={{ backgroundColor: '#F1F5F9' }}>
            <button onClick={saveRincian} disabled={rincian.saving || selisih !== 0 || total < 1} style={{ backgroundColor: '#15803d' }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-black text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              {rincian.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {rincian.saving ? 'Menyimpan...' : 'Simpan Rincian'}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }
}

function Field({ label, full, children }) {
  return <div className={full ? 'md:col-span-2' : ''}><label className={lblCls}>{label}</label>{children}</div>;
}

function SubmitBar({ saving, onSubmit }) {
  return (
    <button
      onClick={onSubmit}
      disabled={saving}
      style={{ backgroundColor: '#15803d' }}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-black text-white shadow-md transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {saving ? 'Menyimpan...' : 'Simpan'}
    </button>
  );
}
