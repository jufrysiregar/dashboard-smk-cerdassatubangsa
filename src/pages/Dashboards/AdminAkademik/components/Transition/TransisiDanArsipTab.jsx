import React, { useState } from 'react';
import AcademicTransitionWizard from './AcademicTransitionWizard';
import AlumniDirectoryPanel from './AlumniDirectoryPanel';

const SUBTABS = [
  { id: 'wizard', label: 'Wizard Transisi Tahun Ajaran' },
  { id: 'directory', label: 'Direktori & Manajemen Prestasi Alumni' },
];

/**
 * Content of the "Transisi TA & Arsip Alumni" tab inside Manajemen KBM:
 * two sub-sections — the four-step transition wizard and the alumni directory.
 */
const TransisiDanArsipTab = () => {
  const [sub, setSub] = useState('wizard');

  return (
    <section className="space-y-5 p-5 sm:p-8">
      <div>
        <h2 className="text-xl font-black text-slate-900">Transisi TA & Arsip Alumni</h2>
        <p className="mt-1 text-sm text-slate-500">
          Kelola perpindahan tahun ajaran atomik dan arsip permanen alumni pada satu tempat.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
        {SUBTABS.map((t) => {
          const active = sub === t.id;
          return (
            <button key={t.id} onClick={() => setSub(t.id)}
              className={`min-w-max rounded-xl px-4 py-2.5 text-sm font-black transition ${
                active ? 'bg-gradient-to-r from-emerald-500 to-emerald-700 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}>
              {t.label}
            </button>
          );
        })}
      </div>

      {sub === 'wizard' ? <AcademicTransitionWizard /> : <AlumniDirectoryPanel />}
    </section>
  );
};

export default TransisiDanArsipTab;
