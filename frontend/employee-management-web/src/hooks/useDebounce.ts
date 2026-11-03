import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce a fast-changing value (e.g. search input)
 * @param value The value to debounce
 * @param delayMs Delay in milliseconds (default 300ms)
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

