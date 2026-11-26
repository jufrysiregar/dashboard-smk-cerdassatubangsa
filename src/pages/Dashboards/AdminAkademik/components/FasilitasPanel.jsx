import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2, X, Loader2, Search, Building2, Package, Filter, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';
import ConfirmDialog from '../../../../components/dashboard/shared/ConfirmDialog';
import { FasilitasDetailModal } from '../../../../components/dashboard/shared/FasilitasItemDetail';
import ModalCloseControl from '../../../../components/dashboard/shared/ModalCloseControl';
import useEscapeKey from '../../../../utils/useEscapeKey';

// Subset tipe ruangan utk konteks Pusat Jurusan (jurusan).
const JURUSAN_ROOM_TYPES = ['lab_komputer', 'lab_praktik', 'workshop', 'studio', 'gudang'];

/**
 * FasilitasPanel — blok Inventaris & Sarana Prasarana Pusat Jurusan.
 * Desain DISELARASKAN 100% dengan kartu Admin Akademik (FasilitasKelola detail):
 *  - Tanpa sub-nav 4 kategori — daftar item (Ruangan + Inventaris) langsung tampil.
 *  - Kartu compact: Nama + tag BARANG/RUANGAN + subtitle; 5 badge rincian di Modal DETAIL.
 * Fasilitas Jurusan (milik sendiri) = kelola penuh (Tambah/Edit Rincian/Hapus).
 * Fasilitas Umum (milik Operator) = read-only + Pinjam/Kembalikan (sinkron 2 arah).
 * Dipakai oleh Pusat Jurusan (mode="pusjur"). Hak edit tiap baris dibaca dari server (row.editable).
 */
const EMPTY = { rooms: [], inventories: [], borrowings: [], references: {} };

const toOptions = (arr) => (Array.isArray(arr) ? arr : []);

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const lblCls = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400';

export default function FasilitasPanel({ api, mode = 'pusjur', onSync }) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [ownershipTab, setOwnershipTab] = useState('umum'); // 'umum' | 'jurusan'
  const [jurusanFilter] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { flow, id?, form, saving }
  const [confirm, setConfirm] = useState(null);
  const [borrow, setBorrow] = useState(null); // { item, form, saving } — modal Pinjam barang umum
  const [detail, setDetail] = useState(null); // { type, id } untuk Modal Detail
  const [savingKembali, setSavingKembali] = useState(null);

  // Esc keyboard = tutup modal Edit/Tambah atau Pinjam (hanya bila tidak sedang menyimpan).
  const closeAnyModal = useCallback(() => {
    setModal((m) => (m && !m.saving ? null : m));
    setBorrow((b) => (b && !b.saving ? null : b));
  }, []);
  useEscapeKey(Boolean(modal || borrow), closeAnyModal);

  const isOperator = mode === 'operator';
  const isPusjur = !isOperator;
  const actorJurusanId = data.actor_jurusan_id;
  const refs = data.references || {};

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getFasilitas();
      setData({ ...EMPTY, ...(res.data?.data || {}) });
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Gagal memuat data fasilitas.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);
  useBodyScrollLock(!!modal || !!borrow || !!detail);

  // Silent auto-sync: polling 16 detik + fokus/visibility tab — tanpa spinner (tidak berkedip),
  // perubahan stok/peminjaman dari sisi Operator langsung ter-update di Pusjur (2 arah).
  const pollSilent = useCallback(async () => {
    if (document.hidden) return;
    try {
      const res = await api.getFasilitas();
      setData({ ...EMPTY, ...(res.data?.data || {}) });
    } catch { /* abaikan kegagalan sesaat */ }
  }, [api]);
  useEffect(() => {
    const t = setInterval(pollSilent, 16000);
    const onFocus = () => pollSilent();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [pollSilent]);

  const afterMutate = async () => { await load(); onSync?.(); };

  // Tab yang bisa menambah hanya yang bisa diedit aktor ini (Pusjur: Jurusan; Operator: Umum).
  const canCreateInTab = (ownershipTab === 'umum' && isOperator) || (ownershipTab === 'jurusan' && !isOperator);

  // Daftar item flat (Ruangan + Inventaris), disaring per tab kepemilikan + pencarian.
  const itemRows = useMemo(() => {
    const rooms = (data.rooms || []).map((r) => ({ ...r, _ftype: 'ruangan' }));
    const invs = (data.inventories || []).map((r) => ({ ...r, _ftype: 'inventaris' }));
    let rows = [...rooms, ...invs];
    rows = rows.filter((r) => (ownershipTab === 'umum' ? r.kepemilikan === 'umum' : r.kepemilikan === 'jurusan'));
    if (isOperator && ownershipTab === 'jurusan' && jurusanFilter) {
      rows = rows.filter((r) => String(r.jurusan_id) === String(jurusanFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
    }
    return rows;
  }, [data, ownershipTab, jurusanFilter, isOperator, search]);

  // ── FORM HELPERS ───────────────────────────────────────────────────
  const emptyForm = (flowId) => {
    if (flowId === 'ruangan') return { name: '', room_type: isPusjur ? 'lab_praktik' : 'ruang_kelas', capacity: '', floor: '', usage_status: 'tersedia', notes: '', contents: [], manualName: '', manualQty: '1' };
    return { name: '', category: 'inventaris_umum', funding_source: 'dana_bos', quantity: '', unit: 'unit', location: '', condition: 'baik', notes: '', qty_baik: '', qty_rusak: 0, qty_dipinjam: 0, qty_perbaikan: 0, qty_hilang: 0 };
  };

  const rowToForm = (flowId, row) => {
    if (flowId === 'ruangan') return { name: row.nama || '', room_type: row.type_code || (isPusjur ? 'lab_praktik' : 'ruang_kelas'), capacity: row.kapasitas ?? '', floor: row.lantai === '-' ? '' : (row.lantai || ''), usage_status: row.usage_status || 'tersedia', notes: row.notes || '', contents: (row.contents || []).map((c) => ({ name: c.name, quantity: c.quantity ?? 1, inventory_id: c.inventory_id ?? null, source: c.source || 'manual' })), manualName: '', manualQty: '1' };
    return { name: row.nama || '', category: row.category_code || 'inventaris_umum', funding_source: row.funding_source || 'dana_bos', quantity: row.jumlah ?? '', unit: row.unit || 'unit', location: row.lokasi || '', condition: row.condition_code || 'baik', notes: row.notes || '', qty_baik: row.qty_baik ?? 0, qty_rusak: row.qty_rusak ?? 0, qty_dipinjam: row.qty_dipinjam ?? 0, qty_perbaikan: row.qty_perbaikan ?? 0, qty_hilang: row.qty_hilang ?? 0 };
  };

  const openAdd = (flowId) => setModal({ flow: flowId, id: null, form: emptyForm(flowId), saving: false });
  const openEdit = (row, flowId) => setModal({ flow: flowId, id: row.id, form: rowToForm(flowId, row), saving: false });
  const setField = (key, val) => setModal((m) => ({ ...m, form: { ...m.form, [key]: val } }));

  const buildPayload = () => {
    const f = modal.form;
    if (modal.flow === 'ruangan') {
      const contents = (f.contents || []).filter((c) => c && String(c.name || '').trim() !== '').map((c) => ({ name: String(c.name).trim(), quantity: Number(c.quantity || 1), inventory_id: c.inventory_id || null, source: c.source || 'manual' }));
      return { name: f.name, room_type: f.room_type, capacity: Number(f.capacity || 0), floor: f.floor || null, usage_status: f.usage_status, notes: f.notes || null, contents };
    }
    const total = Number(f.quantity || 0);
    let qb = Number(f.qty_baik || 0); const qr = Number(f.qty_rusak || 0); const qd = Number(f.qty_dipinjam || 0); const qp = Number(f.qty_perbaikan || 0); const qh = Number(f.qty_hilang || 0);
    if (qb + qr + qd + qp + qh === 0 && total > 0) qb = total; // default rincian awal: seluruh unit Baik
    return { name: f.name, category: f.category || null, funding_source: f.funding_source || null, quantity: total, unit: f.unit || 'unit', location: f.location || null, condition: f.condition, notes: f.notes || null, qty_baik: qb, qty_rusak: qr, qty_dipinjam: qd, qty_perbaikan: qp, qty_hilang: qh };
  };

  const submit = async () => {
    const f = modal.form;
    if (modal.flow === 'ruangan' && (!f.name || f.capacity === '')) return notifyError('Nama & kapasitas ruangan wajib diisi.');
    if (modal.flow === 'inventaris') {
      if (!f.name || f.quantity === '' || Number(f.quantity) < 1) return notifyError('Nama & total unit barang wajib diisi.');
      const total = Number(f.quantity || 0);
      const qtyKeys = ['qty_baik', 'qty_rusak', 'qty_dipinjam', 'qty_perbaikan', 'qty_hilang'];
      const anyQty = qtyKeys.some((k) => String(f[k] ?? '') !== '' && Number(f[k]) !== 0);
      const sum = qtyKeys.reduce((a, k) => a + Number(f[k] || 0), 0);
      if (anyQty && sum !== total) return notifyError(`Total rincian (${sum}) harus sama dengan total unit (${total}).`);
    }

    setModal((m) => ({ ...m, saving: true }));
    const payload = buildPayload();
    try {
      if (modal.flow === 'ruangan') {
        modal.id ? await api.updateFasilitasRoom(modal.id, payload) : await api.createFasilitasRoom(payload);
      } else {
        modal.id ? await api.updateFasilitasInventory(modal.id, payload) : await api.createFasilitasInventory(payload);
      }
      notifySuccess(modal.id ? 'Perubahan tersimpan.' : 'Data berhasil ditambahkan.');
      setModal(null);
      await afterMutate();
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Gagal menyimpan data.');
      setModal((m) => ({ ...m, saving: false }));
    }
  };

  const askDelete = (row, flowId) => {
    const name = row.nama || 'data ini';
    setConfirm({
      title: 'Hapus Data Fasilitas',
      message: `Anda yakin ingin menghapus "${name}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Ya, Hapus',
      onConfirm: async () => {
        try {
          if (flowId === 'ruangan') await api.deleteFasilitasRoom(row.id);
          else await api.deleteFasilitasInventory(row.id);
          notifySuccess('Data berhasil dihapus.');
          setConfirm(null);
          await afterMutate();
        } catch (e) {
          notifyError(e?.response?.data?.message || 'Gagal menghapus.');
        }
      },
    });
  };

  // ── Pinjam / Kembalikan barang umum (Pusjur, sinkron 2 arah ke Operator) ──
  const openPinjam = (row) => setBorrow({ item: row, form: { jumlah: 1, peminjam_nama: '', keperluan: '', tanggal_kembali: '' }, saving: false });
  const setBorrowField = (key, val) => setBorrow((b) => ({ ...b, form: { ...b.form, [key]: val } }));
  const submitPinjam = async () => {
    const b = borrow; if (!b) return;
    const jumlah = Number(b.form.jumlah || 0);
    if (!jumlah || jumlah < 1) return notifyError('Jumlah unit dipinjam minimal 1.');
    if (jumlah > Number(b.item.qty_baik || 0)) return notifyError(`Unit siap pinjam (Baik) tinggal ${b.item.qty_baik}.`);
    if (!String(b.form.peminjam_nama || '').trim()) return notifyError('Nama Penanggung Jawab wajib diisi.');
    setBorrow((x) => ({ ...x, saving: true }));
    try {
      await api.pinjamFasilitasUmum({ inventory_id: b.item.id, jumlah, peminjam_nama: b.form.peminjam_nama, keperluan: b.form.keperluan || null, tanggal_kembali: b.form.tanggal_kembali || null });
      notifySuccess(`Berhasil meminjam ${jumlah} unit ${b.item.nama}.`);
      setBorrow(null);
      await afterMutate();
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Gagal meminjam.');
      setBorrow((x) => ({ ...x, saving: false }));
    }
  };
  const kembalikanPinjam = async (brw) => {
    setSavingKembali(brw.id);
    try {
      await api.kembalikanFasilitasPinjam(brw.id, {});
      notifySuccess(`Dikembalikan ${brw.jumlah} unit ${brw.objek_nama}.`);
      await afterMutate();
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Gagal mengembalikan.');
    } finally {
      setSavingKembali(null);
    }
  };

  // ── Isi ruangan (peletakan fasilitas di dalam ruangan) ────────────
  const addRoomContent = (inv) => {
    if (!inv) return;
    setModal((m) => {
      if ((m.form.contents || []).some((c) => c.inventory_id && String(c.inventory_id) === String(inv.id))) return m;
      return { ...m, form: { ...m.form, contents: [...(m.form.contents || []), { name: inv.nama, quantity: 1, inventory_id: inv.id, source: 'jurusan' }] } };
    });
  };
  const addManualContent = () => {
    setModal((m) => {
      const name = String(m.form.manualName || '').trim();
      if (!name) return m;
      return { ...m, form: { ...m.form, contents: [...(m.form.contents || []), { name, quantity: Math.max(1, Number(m.form.manualQty || 1)), inventory_id: null, source: 'manual' }], manualName: '', manualQty: '1' } };
    });
  };
  const removeRoomContent = (idx) => setModal((m) => ({ ...m, form: { ...m.form, contents: (m.form.contents || []).filter((_, i) => i !== idx) } }));

  // ── RENDER ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Tab kepemilikan */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <button onClick={() => setOwnershipTab('umum')} className={`rounded-xl px-4 py-2 text-sm font-black transition ${ownershipTab === 'umum' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Fasilitas Umum</button>
          <button onClick={() => setOwnershipTab('jurusan')} className={`rounded-xl px-4 py-2 text-sm font-black transition ${ownershipTab === 'jurusan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Fasilitas Jurusan</button>
        </div>
        <div className="flex items-center gap-2">
          {isOperator && ownershipTab === 'jurusan' && (
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <Filter size={15} />
              <select value={jurusanFilter} onChange={() => {}} className="bg-transparent outline-none">
                <option value="">Semua Jurusan</option>
                {toOptions(refs.jurusans).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </label>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${canCreateInTab ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {canCreateInTab ? 'Kelola Penuh' : 'Read-Only'}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama barang / ruangan..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" />
        </label>
        {canCreateInTab && (
          <div className="flex items-center gap-2">
            <button onClick={() => openAdd('inventaris')} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:brightness-110 active:scale-95">
              <Plus size={16} /> Tambah Inventaris Barang
            </button>
            <button onClick={() => openAdd('ruangan')} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:brightness-110 active:scale-95">
              <Plus size={16} /> Tambah Ruangan
            </button>
          </div>
        )}
      </div>

      {/* Daftar item (kartu) */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-sm font-bold text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Memuat data fasilitas...</div>
      ) : itemRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-300"><Building2 className="h-7 w-7" /></div>
          <p className="text-sm font-bold text-slate-400">Belum ada data fasilitas untuk ditampilkan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {itemRows.map((row) => (
            <div key={`${row._ftype}-${row.id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800">
                    {row.nama} <span className="ml-1 text-[10px] font-black uppercase text-slate-400">{row._ftype === 'ruangan' ? 'Ruangan' : 'Barang'}</span>
                  </p>
                  <p className="text-[11px] font-bold text-slate-400">
                    {row._ftype === 'inventaris'
                      ? `${row.funding_source_label || row.kategori || '—'} · Total ${Number(row.jumlah ?? 0)} ${row.unit || 'unit'} · ${ownershipTab === 'umum' ? 'Fasilitas Umum' : (row.jurusan || 'Jurusan')}`
                      : `${row.tipe || 'Ruangan'} · Kapasitas ${Number(row.kapasitas ?? 0)} orang · ${ownershipTab === 'umum' ? 'Fasilitas Umum' : (row.jurusan || 'Jurusan')}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button onClick={() => setDetail({ type: row._ftype, id: row.id })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase text-indigo-600 transition hover:bg-indigo-50"><Eye className="h-3.5 w-3.5" /> Detail</button>
                  {isPusjur && ownershipTab === 'umum' && row._ftype === 'inventaris' && Number(row.qty_baik || 0) > 0 && (
                    <button onClick={() => openPinjam(row)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-[11px] font-black uppercase text-white shadow-sm transition hover:brightness-110"><Package className="h-3.5 w-3.5" /> Pinjam</button>
                  )}
                  {row.editable && row._ftype === 'inventaris' && (
                    <button onClick={() => openEdit(row, 'inventaris')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase text-slate-600 transition hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /> Edit Rincian</button>
                  )}
                  {row.editable && row._ftype === 'ruangan' && (
                    <button onClick={() => openEdit(row, 'ruangan')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase text-slate-600 transition hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  )}
                  {row.editable && (
                    <button onClick={() => askDelete(row, row._ftype)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
              {row._ftype === 'inventaris' && row.status_note && (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="text-[11px] font-semibold italic text-slate-400">Catatan: {row.status_note}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && renderModal()}
      {borrow && renderBorrowModal()}
      {detail && (
        <FasilitasDetailModal
          type={detail.type}
          item={(detail.type === 'ruangan' ? (data.rooms || []) : (data.inventories || [])).find((i) => String(i.id) === String(detail.id)) || null}
          borrowings={data.borrowings || []}
          canKembalikan={(b) => Number(b.jurusan_id) === Number(actorJurusanId)}
          onKembalikan={kembalikanPinjam}
          savingId={savingKembali}
          onClose={() => setDetail(null)}
        />
      )}
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );

  function renderModal() {
    const titles = { ruangan: 'Ruangan & Lab', inventaris: 'Inventaris Barang' };
    const field = (key, label, node, full) => (
      <div key={key} className={full ? 'col-span-2' : ''}>
        <label className={lblCls}>{label}</label>
        {node}
      </div>
    );
    const sel = (key, label, options) => field(key, label, <select value={modal.form[key] ?? ''} onChange={(e) => setField(key, e.target.value)} className={inputCls}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>);
    const opt = (arr) => toOptions(arr);

    let body;
    if (modal.flow === 'ruangan') {
      const roomTypeOpts = isPusjur ? opt(refs.room_types).filter((o) => JURUSAN_ROOM_TYPES.includes(o.value)) : opt(refs.room_types);
      const stockInv = (data.inventories || []).filter((i) => i.editable);
      const contents = modal.form.contents || [];
      const isiRuangan = modal.id === null && (
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Peletakan Fasilitas / Isi di Dalam Ruangan</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className={lblCls}>Pilih dari Stok Inventaris {isPusjur ? 'Jurusan' : 'Umum'}</span>
              <select value="" onChange={(e) => { const pick = stockInv.find((a) => String(a.id) === e.target.value); if (pick) addRoomContent(pick); }} className={inputCls} disabled={stockInv.length === 0}>
                <option value="">{stockInv.length ? '— Pilih alat/barang —' : 'Belum ada inventaris'}</option>
                {stockInv.map((i) => <option key={i.id} value={i.id}>{i.nama} ({i.jumlah} {i.unit})</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className={lblCls}>Input Manual Nama Alat</span>
              <input value={modal.form.manualName} onChange={(e) => setField('manualName', e.target.value)} className={inputCls} placeholder="misal: AC, Kursi" />
            </label>
          </div>
          <div className="flex items-end gap-2">
            <label className="w-28 space-y-1"><span className={lblCls}>Jumlah</span><input type="number" min="1" value={modal.form.manualQty} onChange={(e) => setField('manualQty', e.target.value)} className={inputCls} /></label>
            <button type="button" onClick={addManualContent} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100"><Plus size={15} /> Tambah Manual</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {contents.length === 0 ? (
              <p className="text-[11px] font-bold text-slate-400">Belum ada isi ruangan. Tambahkan dari stok atau input manual.</p>
            ) : contents.map((c, idx) => (
              <span key={idx} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${c.source === 'manual' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {c.name} × {c.quantity}
                <button type="button" onClick={() => removeRoomContent(idx)} className="text-slate-400 hover:text-rose-600"><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      );
      body = <div className="grid grid-cols-2 gap-4">
        {field('name', 'Nama Ruangan', <input value={modal.form.name} onChange={(e) => setField('name', e.target.value)} className={inputCls} placeholder="contoh: Lab TKJ 1" />, true)}
        {sel('room_type', 'Jenis Ruangan', roomTypeOpts)}
        {field('capacity', 'Kapasitas', <input type="number" min="0" value={modal.form.capacity ?? ''} onChange={(e) => setField('capacity', e.target.value)} className={inputCls} placeholder="Jumlah orang" />)}
        {field('floor', 'Lantai', <input value={modal.form.floor} onChange={(e) => setField('floor', e.target.value)} className={inputCls} placeholder="Lantai 1" />)}
        {sel('usage_status', 'Status Ruangan', opt(refs.room_usage_statuses))}
        {field('notes', 'Catatan', <textarea rows={2} value={modal.form.notes} onChange={(e) => setField('notes', e.target.value)} className={inputCls} />)}
        {isiRuangan}
      </div>;
    } else {
      const total = Number(modal.form.quantity || 0);
      const qtyKeys = ['qty_baik', 'qty_rusak', 'qty_dipinjam', 'qty_perbaikan', 'qty_hilang'];
      const qtyLabel = { qty_baik: 'Baik', qty_rusak: 'Rusak', qty_dipinjam: 'Dipinjam', qty_perbaikan: 'Perbaikan', qty_hilang: 'Hilang' };
      const sum = qtyKeys.reduce((a, k) => a + Number(modal.form[k] || 0), 0);
      const selisih = total - sum;
      body = <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {field('name', 'Nama Barang / Alat', <input value={modal.form.name} onChange={(e) => setField('name', e.target.value)} className={inputCls} placeholder="misal: Router Mikrotik, Crimping Tool, Kabel RJ45" />, true)}
          {sel('funding_source', 'Jenis Pengadaan', opt(refs.funding_sources))}
          {sel('category', 'Kategori', opt(refs.inventory_categories))}
          {field('quantity', 'Total Unit', <input type="number" min="1" value={modal.form.quantity ?? ''} onChange={(e) => setField('quantity', e.target.value)} className={inputCls} placeholder="0" />)}
          {sel('unit', 'Satuan', opt(refs.inventory_units))}
          {field('location', 'Lokasi', <input value={modal.form.location} onChange={(e) => setField('location', e.target.value)} className={inputCls} placeholder="Isi lokasi barang" />, true)}
          {sel('condition', 'Kondisi', opt(refs.inventory_conditions))}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Rincian Jumlah per Kondisi {modal.id ? '' : '(default: seluruh unit Baik)'}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {qtyKeys.map((k) => (
              <label key={k} className="space-y-1">
                <span className={lblCls}>{qtyLabel[k]}</span>
                <input type="number" min="0" value={modal.form[k] ?? ''} onChange={(e) => setField(k, e.target.value)} className={inputCls} />
              </label>
            ))}
          </div>
          <div className={`mt-3 flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-black ${selisih === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            <span>Total rincian: {sum} / {total}</span>
            <span>{selisih === 0 ? 'Seimbang' : `Selisih: ${selisih > 0 ? '+' : ''}${selisih}`}</span>
          </div>
        </div>
      </div>;
    }

    const handleClose = () => !modal.saving && setModal(null);
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl" />
        <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-base font-black text-slate-900">{titles[modal.flow]}{modal.id ? ' — Edit' : ' — Tambah'}</h3>
            <div className="flex items-center gap-2">
              <ModalCloseControl onClose={handleClose} />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-6">{body}</div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button onClick={submit} disabled={modal.saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-3 text-sm font-black text-white shadow-md shadow-indigo-500/30 transition hover:brightness-110 disabled:opacity-60">
              {modal.saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  function renderBorrowModal() {
    const b = borrow;
    const maxQty = Number(b.item.qty_baik || 0);
    const close = () => !b.saving && setBorrow(null);
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl" />
        <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-base font-black text-slate-900">Pinjam Barang Umum</h3>
            <div className="flex items-center gap-2">
              <ModalCloseControl onClose={close} />
            </div>
          </div>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-sm font-black text-slate-800">{b.item.nama}</p>
              <p className="text-[11px] font-bold text-slate-500">Unit siap pinjam (Baik): <span className="text-emerald-700">{maxQty}</span> {b.item.unit || 'unit'}</p>
            </div>
            <label className="block"><span className={lblCls}>Jumlah Unit Dipinjam</span>
              <input type="number" min="1" max={maxQty} value={b.form.jumlah} onChange={(e) => setBorrowField('jumlah', e.target.value)} className={inputCls} />
            </label>
            <label className="block"><span className={lblCls}>Nama Penanggung Jawab</span>
              <input value={b.form.peminjam_nama} onChange={(e) => setBorrowField('peminjam_nama', e.target.value)} className={inputCls} placeholder="Nama PJ jurusan" />
            </label>
            <label className="block"><span className={lblCls}>Keperluan</span>
              <textarea rows={2} value={b.form.keperluan} onChange={(e) => setBorrowField('keperluan', e.target.value)} className={inputCls} placeholder="Kebutuhan peminjaman" />
            </label>
            <label className="block"><span className={lblCls}>Rencana Tanggal Kembali</span>
              <input type="date" value={b.form.tanggal_kembali} onChange={(e) => setBorrowField('tanggal_kembali', e.target.value)} className={inputCls} />
            </label>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button onClick={submitPinjam} disabled={b.saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-black text-white shadow-md transition hover:brightness-110 disabled:opacity-60">
              {b.saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {b.saving ? 'Memproses...' : 'Pinjam Sekarang'}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }
}

// Notifikasi: selalu 1 baris, animasi "masuk" terputar ulang tiap trigger (id baru + dismiss lama).
let lastAlertId = null;
function notifyError(text) { if (lastAlertId) toast.dismiss(lastAlertId); const id = `fas-${Date.now()}`; lastAlertId = id; toast.error(text, { id, duration: 3000, style: { maxWidth: '420px', fontSize: '12px', fontWeight: 800 } }); }
function notifySuccess(text) { if (lastAlertId) toast.dismiss(lastAlertId); const id = `fas-${Date.now()}`; lastAlertId = id; toast.success(text, { id, duration: 3200 }); }
