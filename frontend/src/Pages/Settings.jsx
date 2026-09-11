import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Bell, Check, Leaf, ShieldCheck, UserRound } from 'lucide-react';
import api, { errorMessage } from '../Services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ErrorState } from '../Components/ui';
import { AccountHeader, AccountSkeleton, UserAvatar, announceAccountChange, asList, useAccountData } from '../Components/AccountComponents';

const profileValues = (user) => ({ first_name: user.first_name || '', last_name: user.last_name || '', username: user.username || '', email: user.email || '', bio: user.bio || '', avatar: user.avatar || 'sage', interests: user.interests || [], notify_replies: user.notify_replies !== false, notify_reactions: user.notify_reactions !== false, notify_projects: user.notify_projects !== false });

function SettingsForm({ user, projects }) {
  const [values, setValues] = useState(() => profileValues(user));
  const [savedValues, setSavedValues] = useState(() => profileValues(user));
  const [errors, setErrors] = useState(/** @type {Record<string, string | string[]>} */ ({}));
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const { updateUser } = useAuth();
  const { toast } = useToast();
  const categories = [...new Set([...projects.map((project) => project.category), ...values.interests])].filter(Boolean).sort();
  const changed = JSON.stringify(values) !== JSON.stringify(savedValues);
  function update(name, value) { setValues((current) => ({ ...current, [name]: value })); setErrors((current) => ({ ...current, [name]: '' })); setFormError(''); }
  function toggleInterest(category) { update('interests', values.interests.includes(category) ? values.interests.filter((item) => item !== category) : [...values.interests, category]); }
  async function save(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const next = { ...values, first_name: values.first_name.trim(), last_name: values.last_name.trim(), username: values.username.trim(), email: values.email.trim(), bio: values.bio.trim() };
    const validation = {};
    if (!next.username || next.username.length > 150 || !/^[\p{L}\p{N}_.+-]+$/u.test(next.username)) validation.username = 'Use 1–150 letters, numbers, or . + - _ without spaces.';
    if (next.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) validation.email = 'Enter a valid email address.';
    if (next.first_name.length > 150) validation.first_name = 'Keep your first name to 150 characters or fewer.';
    if (next.last_name.length > 150) validation.last_name = 'Keep your last name to 150 characters or fewer.';
    if (next.bio.length > 500) validation.bio = 'Keep your bio to 500 characters or fewer.';
    if (next.interests.length > 12) validation.interests = 'Choose up to 12 interests.';
    setErrors(validation); setFormError('');
    if (Object.keys(validation).length) { document.getElementById(`settings-${Object.keys(validation)[0]}`)?.focus(); return; }
    inFlight.current = true; setBusy(true);
    try {
      const { data } = await api.patch('/users/me/', next);
      const normalized = profileValues(data); setValues(normalized); setSavedValues(normalized);
      updateUser(data); announceAccountChange();
      toast({ title: 'Changes saved', message: 'Your profile and preferences are up to date.' });
    } catch (reason) {
      const fields = Object.fromEntries(Object.entries(reason.response?.data || {}).filter(([name, value]) => Object.hasOwn(next, name) && Array.isArray(value)).map(([name, value]) => [name, value.join(' ')]));
      setErrors(fields); setFormError(errorMessage(reason, 'Some details could not be saved. Review the highlighted fields and try again.'));
      const firstField = Object.keys(fields)[0];
      if (firstField) document.getElementById(`settings-${firstField}`)?.focus();
    } finally { inFlight.current = false; setBusy(false); }
  }
  const field = (name, label, options = {}) => <div className="form-field"><label htmlFor={`settings-${name}`}>{label}</label><input id={`settings-${name}`} name={name} className={`input${errors[name] ? ' input-invalid' : ''}`} value={values[name]} onChange={(event) => update(name, event.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `settings-${name}-error` : undefined} {...options} />{errors[name] && <p id={`settings-${name}-error`} className="field-error" role="alert">{errors[name]}</p>}</div>;
  return <form className="settings-form" onSubmit={save} noValidate aria-busy={busy}><fieldset disabled={busy}><section id="profile-information" className="account-panel settings-section"><div className="settings-section-title"><span><UserRound size={20} /></span><div><h2>A little about you</h2><p>Make your workspace feel like your own.</p></div></div><div className="settings-avatar-row"><UserAvatar key={values.avatar} user={{ ...user, ...values }} large /><div><span className="settings-field-label" id="avatar-palette-label">Your avatar palette</span><div className="avatar-palette" role="radiogroup" aria-labelledby="avatar-palette-label">{['sage', 'forest', 'violet', 'clay', 'amber'].map((palette) => <label key={palette} className={`avatar-palette-choice avatar-${palette}`}><input type="radio" name="avatar" value={palette} checked={values.avatar === palette} aria-label={`${palette} avatar`} onChange={() => update('avatar', palette)} />{values.avatar === palette && <Check size={16} aria-hidden="true" />}</label>)}</div><p className="settings-field-hint">A small expression of your perspective.</p></div></div><div className="settings-field-grid">{field('first_name', 'First name', { autoComplete: 'given-name', maxLength: 150 })}{field('last_name', 'Last name', { autoComplete: 'family-name', maxLength: 150 })}{field('username', 'Username', { autoComplete: 'username', maxLength: 150, required: true, spellCheck: false })}{field('email', 'Email address', { type: 'email', autoComplete: 'email', maxLength: 254, required: true })}</div><div className="form-field"><label htmlFor="settings-bio">Your bio <span className="muted">(optional)</span></label><textarea id="settings-bio" className="input" rows={4} maxLength={500} value={values.bio} onChange={(event) => update('bio', event.target.value)} aria-invalid={Boolean(errors.bio)} aria-describedby="settings-bio-count" /><div className="settings-field-bottom"><span>Share what you're curious about.</span><span id="settings-bio-count">{values.bio.length} / 500</span></div>{errors.bio && <p className="field-error" role="alert">{errors.bio}</p>}</div></section>
      <section id="your-interests" className="account-panel settings-section"><div className="settings-section-title"><span><Leaf size={20} /></span><div><h2>Follow your curiosity</h2><p>Choose interests to shape your suggestions and project updates.</p></div></div><div className="settings-interests" role="group" aria-label="Project interests">{categories.map((category) => <button type="button" key={category} aria-pressed={values.interests.includes(category)} onClick={() => toggleInterest(category)} disabled={!values.interests.includes(category) && values.interests.length >= 12}>{values.interests.includes(category) && <Check size={14} />}{category}</button>)}</div>{categories.length === 0 && <p className="muted">Interests will be available when projects are published.</p>}<p className="settings-field-hint">{values.interests.length} selected · Choose up to 12. You can change these anytime.</p>{errors.interests && <p className="field-error" role="alert">{errors.interests}</p>}</section>
      <section id="notification-preferences" className="account-panel settings-section"><div className="settings-section-title"><span><Bell size={20} /></span><div><h2>Stay in the loop</h2><p>Choose which updates appear in your Vestra notifications.</p></div></div><div className="settings-preferences">{[{ name: 'notify_replies', label: 'Replies to your comments', description: 'When someone continues a conversation you started.' }, { name: 'notify_reactions', label: 'Reactions to your comments', description: 'When someone finds your perspective useful.' }, { name: 'notify_projects', label: 'Project updates and discoveries', description: 'Updates to followed projects and new ideas matching your interests.' }].map((preference) => <label key={preference.name} className="settings-toggle-row"><span><strong>{preference.label}</strong><small>{preference.description}</small></span><input type="checkbox" role="switch" checked={values[preference.name]} onChange={(event) => update(preference.name, event.target.checked)} /><span className="settings-switch" aria-hidden="true" /></label>)}</div></section>
      <section className="account-panel settings-security"><ShieldCheck size={23} /><div><h2>Your account, protected</h2><p>Need a fresh password? Request a secure reset link sent to your account email.</p><Link to="/forgot-password" className="text-link">Reset your password<ArrowUpRight size={15} /></Link></div></section>
    </fieldset>{formError && <div className="auth-form-message" role="alert"><p>{formError}</p></div>}<div className="settings-save-bar"><span>{changed ? 'You have unsaved changes.' : 'Your preferences are up to date.'}</span><div><button type="button" className="btn btn-secondary" disabled={!changed || busy} onClick={() => { setValues(savedValues); setErrors({}); setFormError(''); }}>Reset changes</button><button type="submit" className="btn btn-primary" disabled={!changed || busy}>{busy ? 'Saving…' : 'Save changes'}<Check size={16} /></button></div></div></form>;
}

export default function Settings() {
  const { data, error, loading, reload } = useAccountData({ user: '/users/me/', projects: '/projects/' });
  return <div className="container account-page settings-page"><AccountHeader eyebrow="MAKE YOURSELF AT HOME" title={<>A few <span className="serif-emphasis">personal touches.</span></>} description="Your profile, your interests and the updates you want to hear about." action={<Link to="/profile" className="btn btn-secondary">View profile<ArrowUpRight size={17} /></Link>} />{loading ? <AccountSkeleton rows={2} /> : error ? <ErrorState message={error} onRetry={reload} /> : data?.user && <div className="settings-layout"><nav className="settings-navigation" aria-label="Settings sections"><a href="#profile-information"><UserRound size={16} />Profile information</a><a href="#your-interests"><Leaf size={16} />Your interests</a><a href="#notification-preferences"><Bell size={16} />Notifications</a><p>These preferences belong to your account. They stay with you wherever you sign in.</p></nav><SettingsForm key={data.user.id} user={data.user} projects={asList(data.projects)} /></div>}</div>;
}
