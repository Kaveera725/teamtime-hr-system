import { useEffect, useRef } from 'react';

interface UseDialogAccessibilityOptions {
  isOpen: boolean;
  onClose: () => void;
  closeOnEsc?: boolean;
}

/**
 * Custom hook to manage accessibility for dialogs, modals, and slide-over drawers:
 * - Traps keyboard focus within the dialog container
 * - Closes dialog when Escape key is pressed
 * - Prevents background body scrolling
 * - Returns focus to the previously focused trigger button upon close
 */
export function useDialogAccessibility<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  closeOnEsc = true,
}: UseDialogAccessibilityOptions) {
  const containerRef = useRef<T>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remember the element that had focus before the dialog opened
    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    // Lock body scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first focusable element inside the dialog
    const focusTimer = setTimeout(() => {
      if (containerRef.current) {
        const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const visibleFocusables = Array.from(focusableElements).filter((el) => el.offsetParent !== null);
        if (visibleFocusables.length > 0) {
          visibleFocusables[0].focus();
        }
      }
    }, 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEsc && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'Tab' && containerRef.current) {
        const focusables = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement || !containerRef.current.contains(document.activeElement)) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !containerRef.current.contains(document.activeElement)) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);

      // Restore focus
      if (previouslyFocusedElementRef.current && typeof previouslyFocusedElementRef.current.focus === 'function') {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, onClose, closeOnEsc]);

  return containerRef;
}

