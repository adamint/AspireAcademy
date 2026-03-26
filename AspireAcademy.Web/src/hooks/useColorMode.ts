import { useSyncExternalStore, useCallback } from 'react';
import { type ColorMode, getStoredColorMode, setColorMode as applyColorMode } from '../theme/aspireTheme';

let currentMode: ColorMode = getStoredColorMode();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ColorMode {
  return currentMode;
}

export function useColorMode() {
  const colorMode = useSyncExternalStore(subscribe, getSnapshot);

  const toggleColorMode = useCallback(() => {
    currentMode = currentMode === 'dark' ? 'light' : 'dark';
    applyColorMode(currentMode);
    listeners.forEach((cb) => cb());
  }, []);

  const setColorMode = useCallback((mode: ColorMode) => {
    currentMode = mode;
    applyColorMode(mode);
    listeners.forEach((cb) => cb());
  }, []);

  return { colorMode, toggleColorMode, setColorMode };
}
