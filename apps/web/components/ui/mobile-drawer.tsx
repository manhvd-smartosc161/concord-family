'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  widthClass?: string;
  children: React.ReactNode;
}

export function MobileDrawer({
  open,
  onClose,
  side = 'left',
  widthClass = 'w-[280px]',
  children,
}: MobileDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setAnimateIn(true));
    return () => {
      cancelAnimationFrame(id);
      setAnimateIn(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const sideClass = side === 'left' ? 'left-0' : 'right-0';
  const closedTranslate =
    side === 'left' ? '-translate-x-full' : 'translate-x-full';

  return createPortal(
    <div className="lg:hidden">
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          animateIn ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 ${sideClass} ${widthClass} z-50 overflow-y-auto bg-white shadow-xl transition-transform duration-200 ${
          animateIn ? 'translate-x-0' : closedTranslate
        }`}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </aside>
    </div>,
    document.body,
  );
}
