import { useEffect, useId, useRef } from 'react';
import { X, LoaderCircle } from 'lucide-react';

/** Native modal semantics provide focus containment and inert background content. */
export default function Dialog({ open, onClose, title, description = null, children = null, wide = false, className = '' }) {
  const ref = useRef(null);
  const previousFocus = useRef(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) {
      previousFocus.current = document.activeElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    }
    return () => { if (dialog.open) dialog.close(); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true }); };
  }, [open]);
  return <dialog ref={ref} className={`vestra-dialog ${wide ? 'dialog-wide' : ''} ${className}`} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={event => { event.preventDefault(); close.current?.(); }} onClick={event => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close.current?.(); } }}><div className="dialog-header"><div><p className="eyebrow">A LITTLE MORE POSSIBILITY</p><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div><button type="button" className="icon-button" aria-label="Close dialog" onClick={() => close.current?.()}><X size={20}/></button></div>{open && <div className="dialog-content">{children}</div>}</dialog>;
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', description = null, busy = false, confirmLabel = 'Delete', children = null }) {
  return <Dialog open={open} onClose={() => !busy && onClose()} title={title} description={description}>{children}<div className="dialog-actions"><button className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={onConfirm}>{busy && <LoaderCircle className="spin" size={16}/>} {busy ? 'Working…' : confirmLabel}</button></div></Dialog>;
}
