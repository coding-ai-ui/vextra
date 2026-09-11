import { ArrowUpRight, Eye, EyeOff, Leaf, LockKeyhole, Sparkles } from 'lucide-react';
import { useState } from 'react';

export function FieldError({ name, error }) {
  return error ? <p className="auth-field-error" id={`${name}-error`} role="alert">{error}</p> : null;
}

export function PasswordField({ name = 'password', label = 'Password', value, onChange, error, hint = '', autoComplete = 'current-password' }) {
  const [visible, setVisible] = useState(false);
  const descriptions = [error && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <div className="auth-password-wrap">
        <input className={`input${error ? ' input-invalid' : ''}`} id={name} name={name} type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} placeholder={name === 'confirmPassword' ? 'Enter your password again' : 'Enter your password'} aria-invalid={Boolean(error)} aria-describedby={descriptions} required />
        <button type="button" className="auth-password-toggle" onClick={() => setVisible(!visible)} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </div>
      {hint && <p className="auth-hint" id={`${name}-hint`}>{hint}</p>}
      <FieldError name={name} error={error} />
    </div>
  );
}

export default function AuthPanel() {
  return (
    <aside className="auth-editorial">
      <div className="auth-editorial-grid" aria-hidden="true" />
      <div className="auth-editorial-top"><span className="auth-panel-brand"><Leaf size={21} strokeWidth={1.6} /> VESTRA</span><span className="auth-panel-tag">A little curiosity goes a long way.</span></div>
      <div className="auth-editorial-heading"><span className="auth-panel-eyebrow">YOUR NEXT CHAPTER</span><h2>Big ideas.<br />A clearer perspective.</h2><p>Understand investing by exploring it.<br />No real funds. No pressure. Just simulation.</p></div>
      <div className="auth-preview" aria-label="Example of a fictional simulated portfolio">
        <div className="auth-preview-top"><span>YOUR POSSIBILITIES</span><span className="auth-preview-dot">Demo portfolio</span></div>
        <div className="auth-preview-balance"><div><small>Simulated portfolio value</small><strong>$24,860<span>.00</span></strong></div><span className="auth-preview-gain"><ArrowUpRight size={15} /> 15.8%<small>estimated</small></span></div>
        <svg className="auth-preview-chart" viewBox="0 0 420 110" fill="none" role="img" aria-label="Illustrative growth curve, not real performance"><defs><linearGradient id="auth-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9CBF92" stopOpacity=".34" /><stop offset="100%" stopColor="#9CBF92" stopOpacity="0" /></linearGradient></defs><path d="M0 100H420M0 55H420M0 10H420" stroke="#E9EEE9" strokeDasharray="3 5" /><path d="M0 94C35 91 40 68 66 72S104 93 135 63S177 57 203 54S239 68 266 41S304 52 333 23S372 31 420 5V110H0Z" fill="url(#auth-chart-fill)" /><path d="M0 94C35 91 40 68 66 72S104 93 135 63S177 57 203 54S239 68 266 41S304 52 333 23S372 31 420 5" stroke="#347350" strokeWidth="2.5" /></svg>
        <div className="auth-preview-project"><span className="auth-project-mark"><Leaf size={19} /></span><div><strong>Nova Energy</strong><span>Clean energy · Fictional project</span></div><span className="auth-project-return">+15%<small>est. return</small></span></div>
        <p className="auth-preview-disclaimer">Simulation estimate — not a guaranteed return.</p>
      </div>
      <div className="auth-editorial-foot"><span className="auth-panel-spark"><Sparkles size={17} /></span><p>A space to test your ideas.<br /><strong>And see the bigger picture.</strong></p></div>
      <div className="auth-panel-disclaimer"><LockKeyhole size={13} /><span>For educational demonstration only.</span></div>
    </aside>
  );
}
