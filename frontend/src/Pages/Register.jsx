import { useEffect, useState } from 'react';
import { ArrowRight, CircleAlert, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthPanel, { FieldError, PasswordField } from '../Components/AuthPanel';
import { useAuth } from '../context/AuthContext';
import { getApiError } from '../Services/api';
import { authDestination, validateRegistration } from '../Services/authValidation';

export default function Register() {
  const { register, isAuthenticated, authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [values, setValues] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState(/** @type {Record<string, string | string[]>} */ ({}));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const destination = authDestination(location.state);
  const resumeState = location.state?.resumeState ?? location.state?.from?.state ?? null;

  useEffect(() => { document.title = 'Create your account · Vestra'; }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFormError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting || accountCreated) return;
    const validation = validateRegistration(values);
    setErrors(validation);
    setFormError('');
    if (Object.keys(validation).length) {
      event.currentTarget.elements.namedItem(Object.keys(validation)[0])?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await register(values);
      navigate(destination, { replace: true, state: resumeState });
    } catch (error) {
      if (error.accountCreated) {
        setAccountCreated(true);
        setFormError('Your account was created, but we could not sign you in automatically. Sign in to continue.');
        return;
      }
      const backendErrors = {};
      for (const name of ['username', 'email', 'password']) {
        const errorValue = error.response?.data?.[name];
        if (Array.isArray(errorValue)) backendErrors[name] = errorValue.join(' ');
        else if (typeof errorValue === 'string') backendErrors[name] = errorValue;
      }
      if (Object.keys(backendErrors).length) setErrors(backendErrors);
      else setFormError(getApiError(error, 'We could not create your account. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthenticated && !authLoading && !submitting) return <Navigate to={destination} replace state={resumeState} />;

  return (
    <div className="auth-page auth-page-register container">
      <section className="auth-form-side" aria-labelledby="register-title">
        <div className="auth-form-inner"><span className="eyebrow">A NEW WAY TO UNDERSTAND</span><h1 id="register-title">Start exploring.</h1><p className="auth-intro">Create your Vestra account and build your first simulated portfolio.</p>
          <form className="auth-form" onSubmit={submit} noValidate aria-busy={submitting}>
            {formError && <div className="auth-form-message" role="alert"><CircleAlert size={18} /><p>{formError}</p></div>}
            <fieldset disabled={submitting || accountCreated}>
              <div className="form-field"><label htmlFor="username">Username</label><input className={`input${errors.username ? ' input-invalid' : ''}`} id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Choose your username" value={values.username} onChange={updateField} aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? 'username-error' : undefined} required maxLength={150} /><FieldError name="username" error={errors.username} /></div>
              <div className="form-field"><label htmlFor="email">Email address</label><input className={`input${errors.email ? ' input-invalid' : ''}`} id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" value={values.email} onChange={updateField} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} required /><FieldError name="email" error={errors.email} /></div>
              <PasswordField value={values.password} onChange={updateField} error={errors.password} autoComplete="new-password" hint="At least 8 characters. Include letters or symbols." />
              <PasswordField name="confirmPassword" label="Confirm password" value={values.confirmPassword} onChange={updateField} error={errors.confirmPassword} autoComplete="new-password" />
              {!accountCreated && <button className="btn btn-primary auth-submit" type="submit" disabled={submitting}>{submitting ? <><span className="auth-spinner" /> Creating your account…</> : <>Create account <ArrowRight size={18} /></>}</button>}
            </fieldset>
            {accountCreated && <Link className="btn btn-primary auth-submit" to="/login" state={location.state}>Continue to sign in <ArrowRight size={18} /></Link>}
          </form>
          <p className="auth-switch">Already have an account? <Link to="/login" state={location.state}>Sign in <ArrowRight size={14} /></Link></p><div className="auth-reassurance"><ShieldCheck size={18} /><span>No real money. Just room to learn.</span></div>
        </div>
      </section>
      <AuthPanel />
    </div>
  );
}
