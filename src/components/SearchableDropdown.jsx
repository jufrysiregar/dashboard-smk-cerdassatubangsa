import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * SearchableDropdown — dropdown dengan pencarian, dipakai bersama
 * (Admin Akademik MasterDataTab & komponen KBM). themeColor menentukan aksen.
 */
const SearchableDropdown = ({ value, onChange, options, placeholder, searchPlaceholder = "Ketik untuk mencari...", themeColor, disabled = false, hideEmptyMessage = false }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const wrapperRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => String(o.value) === String(value));
  const triggerPlaceholder = /guru/i.test(placeholder || '') ? '— Silahkan pilih guru —' : placeholder;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-left font-bold text-slate-800 text-sm focus:ring-4 focus:bg-white transition-all outline-none cursor-pointer flex justify-between items-center disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ '--tw-ring-color': `${themeColor}20`, borderColor: isOpen ? themeColor : '', boxShadow: isOpen ? `0 0 0 4px ${themeColor}20` : '' }}
      >
        <span className={`min-w-0 truncate whitespace-nowrap ${selectedOption ? '' : 'text-slate-400'}`}>{selectedOption ? selectedOption.label : triggerPlaceholder}</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <input
              type="text"
              autoFocus
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-cyan-500 transition-all"
              style={{ borderColor: themeColor }}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1" style={{ scrollbarWidth: 'thin' }}>
            {options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).map(o => (
              <div
                key={o.value}
                onClick={() => { if (o.disabled) return; onChange(o.value); setIsOpen(false); setSearch(''); }}
                className={`px-4 py-3 rounded-xl text-sm font-bold transition-all ${o.disabled ? 'cursor-not-allowed text-slate-300' : 'cursor-pointer ' + (String(o.value) === String(value) ? 'text-white' : 'text-slate-600 hover:bg-slate-50')}`}
                style={{ backgroundColor: !o.disabled && String(o.value) === String(value) ? themeColor : '' }}
                title={o.disabled ? (o.disabledReason || 'Tidak tersedia untuk peran ini') : ''}
              >
                {o.label}
              </div>
            ))}
            {!hideEmptyMessage && options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <div className="p-4 text-center text-sm font-bold text-slate-400 italic">Data tidak ditemukan</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
