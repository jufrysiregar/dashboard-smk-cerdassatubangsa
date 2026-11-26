const LEGACY_ID_PATTERN = /^[a-z]+@\d+$/;

export const validateSchoolId = (id, role = 'murid') => {
  const errors = [];

  if (!LEGACY_ID_PATTERN.test(id)) {
    errors.push('Format ID harus: nama@id');
    return { valid: false, errors };
  }

  const [name, numbers] = id.split('@');

  if (name !== name.toLowerCase()) {
    errors.push('Nama harus huruf kecil semua');
  }

  if (role === 'murid') {
    if (numbers.length !== 4) {
      errors.push('ID Murid harus 4 angka setelah @');
    }
  } else if (numbers.length !== 6) {
    errors.push('ID Staff harus 6 angka setelah @');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validatePassword = (password) => {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password minimal 8 karakter');
  }
  
  if (password.length > 12) {
    errors.push('Password maksimal 12 karakter');
  }

  if (!/^[A-Z]/.test(password)) {
    errors.push('Huruf pertama harus huruf besar');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password harus memiliki minimal 1 huruf kecil');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password harus memiliki minimal 1 angka');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password harus memiliki minimal 1 simbol (!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateEmail = (email) => {
  const errors = [];
  const emailPattern = /^[^\s@]+@gmail\.com$/i;

  if (!emailPattern.test(email)) {
    errors.push('Email harus menggunakan @gmail.com');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const isEmailIdentifier = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value.trim());

export const validateResetIdentifier = (identifier) => {
  const value = identifier.trim();

  if (!value) {
    return {
      valid: false,
      errors: ['ID Sekolah atau email wajib diisi'],
    };
  }

  if (isEmailIdentifier(value)) {
    return validateEmail(value);
  }

  return validateSchoolId(value, getRoleFromId(value));
};

export const getPasswordStrength = (password) => {
  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;

  if (strength <= 2) return { level: 'weak', color: 'bg-red-500', text: 'Lemah' };
  if (strength <= 4) return { level: 'medium', color: 'bg-yellow-500', text: 'Sedang' };
  return { level: 'strong', color: 'bg-green-500', text: 'Kuat' };
};

export const getRoleFromId = (id) => {
  if (!id.includes('@')) return 'murid';
  const [, numbers] = id.split('@');
  return numbers.length === 4 ? 'murid' : 'staff';
};
