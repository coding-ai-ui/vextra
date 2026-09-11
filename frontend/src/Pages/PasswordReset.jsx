import { useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import api, { errorMessage } from '../Services/api';
import AuthPanel, { FieldError, PasswordField } from '../Components/AuthPanel';

export default function PasswordReset() {
  const [params] = useSearchParams();
  const location = useLocation();
  const uid = params.get('uid'); const token = params.get('token');
  const confirming = location.pathname === '/reset-password' || Boolean(uid || token);
  const invalidLink = confirming && (!uid || !token);
  const [values, setValues] = useState({ email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState(/** @type {Record<string, string | string[]>} */ ({}));
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);
  function update(event) { const { name, value } = event.target; setValues((current) => ({ ...current, [name]: value })); setErrors((current) => ({ ...current, [name]: '' })); setFormError(''); }
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const validation = {};
    if (!confirming && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254)) validation.email = 'Enter your account email address.';
    if (confirming) {
      if (values.password.length < 8 || values.password.length > 128) validation.password = 'Use between 8 and 128 characters.';
      else if (/^\d+$/.test(values.password) || !values.password.trim()) validation.password = 'Include letters or symbols in your password.';
      if (values.password !== values.confirmPassword) validation.confirmPassword = 'Your passwords do not match.';
    }
    setErrors(validation); setFormError('');
    if (Object.keys(validation).length) { event.currentTarget.elements.namedItem(Object.keys(validation)[0])?.focus(); return; }
    inFlight.current = true; setBusy(true);
    try {
      if (confirming) await api.post('/users/password-reset-confirm/', { uid, token, password: values.password }, { skipAuth: true });
      else await api.post('/users/password-reset/', { email: values.email.trim() }, { skipAuth: true });
      setSuccess(true); setValues({ email: '', password: '', confirmPassword: '' });
    } catch (reason) {
      const passwordErrors = reason.response?.data?.password;
      if (Array.isArray(passwordErrors)) setErrors({ password: passwordErrors.join(' ') });
      setFormError(errorMessage(reason, confirming ? 'This link may have expired or already been used. Request a new reset link and try again.' : 'We could not request your reset link. Please try again.'));
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="auth-page container"><section className="auth-form-side" aria-labelledby="password-reset-title"><div className="auth-form-inner"><Link className="auth-back-link" to="/login">Back to sign in<ArrowRight size={15} /></Link><span className="eyebrow">A FRESH START</span><h1 id="password-reset-title">{success ? confirming ? 'A new beginning.' : 'Check your inbox.' : invalidLink ? 'Let’s find your way back.' : confirming ? 'Your next password.' : 'A little help getting back.'}</h1><p className="auth-intro">{success ? confirming ? 'Your password has been updated. Sign in with your new password to continue exploring.' : 'If an account matches that email, a secure password reset link has been sent. Check your inbox and spam folder.' : invalidLink ? 'This reset link is incomplete. Request a new one to securely update your password.' : confirming ? 'Choose a strong password you haven’t used before.' : 'Enter the email linked to your account and we’ll send a secure reset link.'}</p>
      {success || invalidLink ? <div className="reset-success-panel">{success ? confirming ? <CheckCircle2 size={35} strokeWidth={1.3} /> : <Mail size={35} strokeWidth={1.3} /> : <ShieldCheck size={35} strokeWidth={1.3} />}<Link className="btn btn-primary auth-submit" to={invalidLink ? '/forgot-password' : '/login'}>{invalidLink ? 'Request a new link' : 'Back to sign in'}<ArrowRight size={17} /></Link>{success && !confirming && <button type="button" className="text-link" onClick={() => setSuccess(false)}>Try another email<ArrowRight size={15} /></button>}</div> : <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>{formError && <div className="auth-form-message" role="alert"><p>{formError}{confirming && <Link className="account-block" to="/forgot-password">Request a new reset link.</Link>}</p></div>}<fieldset disabled={busy}>{confirming ? <><PasswordField name="password" label="New password" value={values.password} onChange={update} error={errors.password} hint="At least 8 characters. Include letters or symbols." autoComplete="new-password" /><PasswordField name="confirmPassword" label="Confirm new password" value={values.confirmPassword} onChange={update} error={errors.confirmPassword} autoComplete="new-password" /></> : <div className="form-field"><label htmlFor="reset-email">Email address</label><input id="reset-email" name="email" className={`input${errors.email ? ' input-invalid' : ''}`} type="email" autoComplete="email" value={values.email} onChange={update} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} /><FieldError name="email" error={errors.email} /></div>}<button className="btn btn-primary auth-submit" type="submit" disabled={busy}>{busy ? <><span className="auth-spinner" />{confirming ? 'Updating…' : 'Sending…'}</> : <>{confirming ? 'Set new password' : 'Send reset link'}<ArrowRight size={17} /></>}</button></fieldset></form>}
      <div className="auth-reassurance"><ShieldCheck size={18} /><span>A secure path back to your possibilities.</span></div></div></section><AuthPanel /></div>;
}
