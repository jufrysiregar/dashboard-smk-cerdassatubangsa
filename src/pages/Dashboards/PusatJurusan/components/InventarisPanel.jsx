import React from 'react';
import { pusatJurusanAPI } from '../../../../utils/api';
import FasilitasPanel from '../../AdminAkademik/components/FasilitasPanel';

/**
 * Inventaris & Sarpras Pusat Jurusan — memakai FasilitasPanel bersama dengan
 * mode="pusjur": Fasilitas Jurusan (milik sendiri) dapat dikelola penuh (CRUD),
 * Fasilitas Umum tampil read-only. 100% data DB nyata.
 */
const InventarisPanel = ({ selectedJurusan, onChanged }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-4 flex items-center gap-2">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Inventaris &amp; Sarana Prasarana</h3>
      {selectedJurusan?.name && <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-indigo-600">{selectedJurusan.name}</span>}
    </div>
    <FasilitasPanel api={pusatJurusanAPI} mode="pusjur" onSync={onChanged} />
  </div>
);

export default InventarisPanel;
