/**
 * Ikon "keluar/kick": kurung pintu tetap di kiri (bukaan menghadap kanan),
 * tetapi panahnya menunjuk ke KIRI (kebalikan dari ikon LogOut bawaan lucide).
 * Dipakai bersama oleh tombol Kick (Otoritas Pengguna) dan menu Keluar di sidebar.
 */
export default function LogoutLeftIcon({ size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* kurung pintu di kiri, buka ke kanan */}
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      {/* panah di kanan, menunjuk ke kiri */}
      <polyline points="15 17 10 12 15 7" />
      <line x1="21" x2="10" y1="12" y2="12" />
    </svg>
  );
}
