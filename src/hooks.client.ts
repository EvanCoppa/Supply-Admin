import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, event, status, message }) => {
  const code = `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  if (status >= 500) {
    console.error('[client-error]', {
      code,
      status,
      message,
      path: event.url.pathname,
      error
    });
  }
  return { message: message ?? 'Unexpected client error.', code };
};
