import { useEffect, useState } from 'react';

// PUBLIC_INTERFACE
export function useDebouncedValue(value, delayMs) {
  /** Debounce any value by delayMs. */
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
