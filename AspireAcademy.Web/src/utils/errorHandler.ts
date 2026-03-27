/** Extracts a human-readable error message from an Axios error or unknown error. */
export function extractErrorMessage(err: unknown, defaultMsg = 'An error occurred'): string {
  const axiosErr = err as { response?: { data?: { error?: string; message?: string } } };
  return axiosErr?.response?.data?.error ?? axiosErr?.response?.data?.message ?? defaultMsg;
}
