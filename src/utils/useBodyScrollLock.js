import { useEffect } from 'react';

// Penghitung global: modal yang bertumpuk tidak saling melepas kunci scroll
let lockCount = 0;
let savedStyles = null;

const applyLock = () => {
  if (lockCount === 0) {
    savedStyles = {
      bodyOverflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
    };
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  lockCount += 1;
};

const releaseLock = () => {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    if (savedStyles) {
      document.body.style.overflow = savedStyles.bodyOverflow;
      document.documentElement.style.overflow = savedStyles.htmlOverflow;
      savedStyles = null;
    }
  }
};

/**
 * Mengunci scroll halaman di belakang modal / popup.
 * Dipakai bersama createPortal agar konten di belakang tidak bisa di-scroll dan ruler navigasi mati total.
 */
const useBodyScrollLock = (isLocked = true) => {
  useEffect(() => {
    if (!isLocked) return undefined;
    applyLock();
    return releaseLock;
  }, [isLocked]);
};

export default useBodyScrollLock;
