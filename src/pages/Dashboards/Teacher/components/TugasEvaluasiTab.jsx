import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NilaiRaporTab from './NilaiRaporTab';
import TugasNilaiAdminTab from '../../AdminAkademik/components/TugasNilaiAdminTab';

const tabs = [
    { id: 'tasks', label: 'Tugas & Kuis' },
    { id: 'grades', label: 'Nilai & Rapor' },
];

const TugasEvaluasiTab = ({ clock, quickAction, onQuickActionConsumed, initialSection = 'tasks' }) => {
    const [activeSection, setActiveSection] = useState(initialSection);

    return (
        <div className="space-y-6 animate-fadeIn pb-16">
            {/* Centered Large Subtab Switcher - Green Gradient Identical to Materi & Soal */}
            <nav aria-label="Kategori Tugas dan Nilai" className="flex flex-wrap justify-center gap-3 rounded-2xl border border-green-100 bg-white p-3 shadow-sm">
                {tabs.map(({ id, label }) => {
                    const selected = activeSection === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setActiveSection(id)}
                            aria-current={selected ? 'page' : undefined}
                            className={`inline-flex items-center justify-center rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-wide transition duration-200 ${
                                selected
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-700 text-white shadow-lg shadow-emerald-600/20'
                                    : 'text-slate-500 hover:bg-green-50 hover:text-emerald-800'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </nav>

            {/* Active Content */}
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={activeSection}
                    aria-label={activeSection === 'tasks' ? 'Tugas & Kuis' : 'Nilai & Rapor'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.18 }}
                >
                    {activeSection === 'grades' ? (
                        <NilaiRaporTab clock={clock} />
                    ) : (
                        <TugasNilaiAdminTab
                            quickAction={quickAction}
                            onQuickActionConsumed={onQuickActionConsumed}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default TugasEvaluasiTab;
