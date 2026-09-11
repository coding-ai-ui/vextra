import { useEffect, useState } from 'react';
import api, { errorMessage } from '../Services/api';

// oxlint-disable-next-line react/only-export-components -- Admin pages share one request lifecycle.
export function useAdminResource(url) {
  const [result, setResult] = useState({ key: '', data: null, error: '' });
  const [revision, setRevision] = useState(0);
  const key = `${url}:${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    api.get(url, { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setResult({ key, data: response.data, error: '' });
    }).catch(reason => {
      if (!controller.signal.aborted) setResult({ key, data: null, error: errorMessage(reason) });
    });
    return () => controller.abort();
  }, [url, key]);
  const current = result.key === key;
  const setData = next => setResult(previous => ({ key, data: typeof next === 'function' ? next(previous.data) : next, error: '' }));
  return { data: current ? result.data : null, setData, loading: !current, error: current ? result.error : '', reload: () => setRevision(value => value + 1) };
}

export function AdminSkeleton({ label = 'Loading workspace', rows = 4 }) {
  return <div className="admin-skeleton" role="status" aria-label={label}><span className="sr-only">{label}</span>{Array.from({ length: rows }, (_, index) => <div key={index}><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>)}</div>;
}

export function AdminError({ message, onRetry = undefined }) {
  if (!message) return null;
  return <div className="admin-alert" role="alert"><span>{message}</span>{onRetry && <button className="btn btn-secondary btn-small" onClick={onRetry}>Try again</button>}</div>;
}

// oxlint-disable-next-line react/only-export-components -- Shared admin response conversion.
export function adminItems(data) { return Array.isArray(data) ? data : data?.results || []; }
// oxlint-disable-next-line react/only-export-components -- Shared safe validation error formatting.
export function adminErrorMessage(error) {
  const data = error.response?.data;
  if (error.response?.status >= 400 && error.response.status < 500 && data && typeof data === 'object') {
    const messages = Object.entries(data).flatMap(([field, value]) => (Array.isArray(value) ? value : [value]).filter(item => typeof item === 'string').map(item => `${['detail', 'non_field_errors'].includes(field) ? '' : `${field.replaceAll('_', ' ')}: `}${item}`));
    if (messages.length) return messages.join(' ');
  }
  return errorMessage(error);
}
// oxlint-disable-next-line react/only-export-components -- Shared date presentation.
export function adminDate(value) { return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
