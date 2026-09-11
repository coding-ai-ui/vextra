import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null);
  const timer = useRef(null);
  const toast = (next) => { clearTimeout(timer.current); setMessage(next); timer.current = setTimeout(() => setMessage(null), 8000); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return <ToastContext.Provider value={{ toast }}>{children}<div className="toast-region" aria-live="polite" aria-atomic="true">{message && <div className="toast"><span className="toast-check"><Check size={18} /></span><div><strong>{message.title}</strong><p>{message.message}</p>{message.action && <Link to={message.action.to} onClick={() => setMessage(null)}>{message.action.label} →</Link>}</div><button className="icon-button" aria-label="Dismiss notification" onClick={() => setMessage(null)}><X size={17} /></button></div>}</div></ToastContext.Provider>;
}
// oxlint-disable-next-line react/only-export-components -- Keep the provider and its public context hook together.
export function useToast() { return useContext(ToastContext); }
