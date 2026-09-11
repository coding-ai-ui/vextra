import { useEffect, useState } from 'react';
import { ArrowRight, CircleAlert, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthPanel, { FieldError, PasswordField } from '../Components/AuthPanel';
import { useAuth } from '../context/AuthContext';
import { getApiError } from '../Services/api';
import { authDestination, validateLogin } from '../Services/authValidation';

export default function Login() {
  const { login, isAuthenticated, authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState(/** @type {Record<string, string | string[]>} */ ({}));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const destination = authDestination(location.state);
  const resumeState = location.state?.resumeState ?? location.state?.from?.state ?? null;

  useEffect(() => { document.title = 'Sign in · Vestra'; }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFormError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const validation = validateLogin(values);
    setErrors(validation);
    setFormError('');
    if (Object.keys(validation).length) {
      event.currentTarget.elements.namedItem(Object.keys(validation)[0])?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await login(values);
      navigate(destination, { replace: true, state: resumeState });
    } catch (error) {
      setFormError([400, 401].includes(error.response?.status) ? 'That email or username and password do not match. Please try again.' : getApiError(error, 'We could not sign you in. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthenticated && !authLoading && !submitting) return <Navigate to={destination} replace state={resumeState} />;

  return (
    <div className="auth-page container">
      <section className="auth-form-side" aria-labelledby="login-title">
        <div className="auth-form-inner"><Link className="auth-back-link" to="/projects">Explore a little first <ArrowRight size={15} /></Link><span className="eyebrow">YOUR VESTRA WORKSPACE</span><h1 id="login-title">Welcome back.</h1><p className="auth-intro">Sign in to continue exploring your simulated portfolio.</p>
          <form className="auth-form" onSubmit={submit} noValidate aria-busy={submitting}>
            {formError && <div className="auth-form-message" role="alert"><CircleAlert size={18} /><p>{formError}</p></div>}
            <fieldset disabled={submitting}>
              <div className="form-field"><label htmlFor="username">Email or username</label><input className={`input${errors.username ? ' input-invalid' : ''}`} id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" value={values.username} onChange={updateField} aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? 'username-error' : undefined} required /><FieldError name="username" error={errors.username} /></div>
              <PasswordField value={values.password} onChange={updateField} error={errors.password} />
              <Link to="/forgot-password" className="forgot-password-link">Forgot your password?</Link>
              <button className="btn btn-primary auth-submit" type="submit" disabled={submitting}>{submitting ? <><span className="auth-spinner" /> Signing in…</> : <>Sign in <ArrowRight size={18} /></>}</button>
            </fieldset>
          </form>
          <p className="auth-switch">New to Vestra? <Link to="/register" state={location.state}>Create an account <ArrowRight size={14} /></Link></p><div className="auth-reassurance"><ShieldCheck size={18} /><span>A real learning experience. Entirely simulated.</span></div>
        </div>
      </section>
      <AuthPanel />
    </div>
  );
}
