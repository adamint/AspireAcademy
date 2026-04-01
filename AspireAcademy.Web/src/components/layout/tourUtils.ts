const TOUR_STORAGE_KEY = 'aspire-learn-tour-completed';

/** Re-trigger the tour (called from Settings) */
export function resetTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
}

/** Check if tour has been completed */
export function isTourCompleted(): boolean {
  return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
}

export { TOUR_STORAGE_KEY };
