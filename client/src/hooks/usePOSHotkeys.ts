import { useEffect } from 'react';

interface POSHotkeyOptions {
  onFocusBarcode?: () => void;
  onHoldCart?: () => void;
  onOpenHeldCarts?: () => void;
  onFocusCustomer?: () => void;
  onOpenPaymentModal?: () => void;
  onLockTerminal?: () => void;
  onCloseModals?: () => void;
  onConfirmPayment?: () => void;
  isPaymentModalOpen?: boolean;
}

export const usePOSHotkeys = (options: POSHotkeyOptions) => {
  const {
    onFocusBarcode,
    onHoldCart,
    onOpenHeldCarts,
    onFocusCustomer,
    onOpenPaymentModal,
    onLockTerminal,
    onCloseModals,
    onConfirmPayment,
    isPaymentModalOpen,
  } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2: Focus Barcode input
      if (e.key === 'F2') {
        e.preventDefault();
        onFocusBarcode?.();
      }

      // F4: Hold / Park Cart (without shift)
      if (e.key === 'F4' && !e.shiftKey) {
        e.preventDefault();
        onHoldCart?.();
      }

      // Shift + F4: Open Parked Carts list
      if (e.key === 'F4' && e.shiftKey) {
        e.preventDefault();
        onOpenHeldCarts?.();
      }

      // F8: Focus Customer Selector
      if (e.key === 'F8') {
        e.preventDefault();
        onFocusCustomer?.();
      }

      // F9: Open Checkout / Payment Modal
      if (e.key === 'F9') {
        e.preventDefault();
        onOpenPaymentModal?.();
      }

      // Ctrl + L: Quick Lock POS Screen
      if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        onLockTerminal?.();
      }

      // Escape: Close active modals / clear search
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseModals?.();
      }

      // Enter: Confirm payment if modal is open
      if (e.key === 'Enter' && isPaymentModalOpen) {
        // Prevent default only if target is not a textarea
        const target = e.target as HTMLElement;
        if (target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          onConfirmPayment?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onFocusBarcode,
    onHoldCart,
    onOpenHeldCarts,
    onFocusCustomer,
    onOpenPaymentModal,
    onLockTerminal,
    onCloseModals,
    onConfirmPayment,
    isPaymentModalOpen,
  ]);
};
