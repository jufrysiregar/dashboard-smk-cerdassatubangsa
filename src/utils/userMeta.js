export const ACCESS_ROLE_LABELS = {
  murid: 'Murid',
  kepala_sekolah: 'Kepala Sekolah',
  wakil_sekolah: 'Wakil Kepala Sekolah',
  guru: 'Guru',
  operator: 'Super Admin - Operator',
  admin_akademik: 'Admin Akademik - Operator',
  cashier: 'Kasir',
  pusat_jurusan: 'Pusat Jurusan',
  honorer: 'Honorer',
  magang: 'Magang',
};

export const POSITION_STATUS_LABELS = {
  tetap: 'Tetap',
  honorer: 'Honorer',
  magang: 'Magang',
};

const ACCESS_ROLE_ALIASES = {
  admin: 'operator',
  kasir: 'cashier',
  teknisi: 'pusat_jurusan',
  'super_admin_-_operator': 'operator',
  'admin_akademik_-_operator': 'admin_akademik',
  'super_admin': 'operator',
  'admin_akademik': 'admin_akademik',
  'honorer/magang': 'magang_honor',
  'staf_khusus': 'magang_honor',
};

export const normalizeAccessRole = (role) => {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase().replaceAll(' ', '_');
  return ACCESS_ROLE_ALIASES[normalized] || normalized;
};

export const resolveAccessRole = (user) =>
  normalizeAccessRole(user?.accessRole || user?.access_role || user?.role);

export const resolvePositionStatus = (user) => {
  const explicit = user?.positionStatus || user?.position_status;
  if (explicit) return explicit;

  const accessRole = resolveAccessRole(user);

  // If role is explicitly honorer or magang, treat it as the position status
  if (accessRole === 'honorer' || accessRole === 'magang') {
    return accessRole;
  }

  if (!accessRole || accessRole === 'murid') {
    return null;
  }

  return 'tetap';
};

export const isSpecialStaffUser = (user) =>
  ['honorer', 'magang'].includes(resolvePositionStatus(user));

export const getAccessRoleLabel = (userOrRole) => {
  const role = typeof userOrRole === 'string' ? normalizeAccessRole(userOrRole) : resolveAccessRole(userOrRole);
  return ACCESS_ROLE_LABELS[role] || role || '-';
};

export const getPositionStatusLabel = (userOrStatus) => {
  const status = typeof userOrStatus === 'string' ? userOrStatus : resolvePositionStatus(userOrStatus);
  return POSITION_STATUS_LABELS[status] || status || '-';
};

export const staffFormRoleOptions = [
  { value: 'kepala_sekolah', label: 'Kepala Sekolah' },
  { value: 'wakil_sekolah', label: 'Wakil Kepala Sekolah' },
  { value: 'admin_akademik', label: 'Admin Akademik - Operator' },
  { value: 'guru', label: 'Guru' },
  { value: 'murid', label: 'Murid' },
  { value: 'cashier', label: 'Kasir' },
  { value: 'pusat_jurusan', label: 'Pusat Jurusan' },
  { value: 'honorer', label: 'Honorer' },
  { value: 'magang', label: 'Magang' },
];

export const positionStatusOptions = [
  { value: 'tetap', label: 'Tetap', prefix: 'TTP' },
  { value: 'honorer', label: 'Honorer', prefix: 'HNR' },
  { value: 'magang', label: 'Magang', prefix: 'MGN' },
];
