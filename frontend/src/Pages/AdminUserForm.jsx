import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, EyeOff } from 'lucide-react';
import api from '../Services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { AdminError, AdminSkeleton, adminErrorMessage } from '../Components/AdminUI';

export default function AdminUserForm() {
  const { id } = useParams();
  return <AdminUserFormEditor key={id || "new"} id={id} />;
}

function AdminUserFormEditor({ id }) {
  const edit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'user', is_active: true });
  const [originalEmail, setOriginalEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const [revision, setRevision] = useState(0);
  const protectedUser = edit && (Number(id) === currentUser?.id || originalEmail.toLowerCase() === 'talyn2007@gmail.com');
  const back = edit ? `/admin/users/${id}` : '/admin/users';
  useEffect(() => {
    document.title = `${edit ? 'Edit' : 'New'} user | Vextra`;
    if (!edit) return;
    const controller = new AbortController();
    api.get(`/users/admin/users/${id}/`, { signal: controller.signal }).then(({ data }) => { if (controller.signal.aborted) return; setForm({ full_name: data.full_name || data.username, email: data.email, password: '', role: data.role, is_active: data.is_active }); setOriginalEmail(data.email); }).catch(reason => { if (!controller.signal.aborted) setError(adminErrorMessage(reason)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [edit, id, revision]);
  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  async function submit(event) {
    event.preventDefault(); setError(''); setSaving(true);
    try {
      let response;
      if (edit) response = await api.patch(`/users/admin/users/${id}/`, { email: form.email.trim(), first_name: form.full_name.trim().split(/\s+/)[0], last_name: form.full_name.trim().split(/\s+/).slice(1).join(' '), role: form.role, is_active: form.is_active });
      else response = await api.post('/users/admin/users/', { full_name: form.full_name.trim(), email: form.email.trim(), password: form.password, role: form.role });
      toast({ title: edit ? 'Account updated' : 'Account created', message: edit ? 'The permitted account details have been saved.' : 'The member can now sign in with the credentials you provided.' });
      navigate(`/admin/users/${response.data.id || id}`);
    } catch (reason) { setError(adminErrorMessage(reason)); }
    finally { setSaving(false); }
  }
  return <div><Link className="admin-back" to={back}><ArrowLeft size={15} />{edit ? 'Back to account' : 'Back to users'}</Link><div className="admin-form-heading"><div><span className="eyebrow">{edit ? 'UPDATE PROFILE' : 'WELCOME A MEMBER'}</span><h1>{edit ? 'Edit user' : 'Add user'}</h1></div></div>{loading ? <AdminSkeleton label="Loading account details" /> : error && edit && !originalEmail ? <AdminError message={error} onRetry={() => { setLoading(true); setError(''); setRevision(value => value + 1); }} /> : <form className="admin-editor-form admin-user-form" onSubmit={submit}><fieldset disabled={saving} className="admin-editor-fields"><section><h2>Account information</h2><label>Full name<input name="full_name" value={form.full_name} onChange={change} maxLength={150} required /></label><label>Email address<input name="email" type="email" autoComplete="email" value={form.email} onChange={change} required readOnly={originalEmail.toLowerCase() === 'talyn2007@gmail.com'} /></label>{!edit && <label>Initial password<span className="admin-password-field"><input name="password" type={visible ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={change} required minLength={8} maxLength={128} /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span><small className="admin-help">Use at least 8 characters and avoid common words or personal information. Existing passwords are never displayed.</small></label>}<label>Role<select name="role" value={form.role} onChange={change} disabled={protectedUser}><option value="user">User</option><option value="admin">Admin</option></select>{protectedUser && <small className="admin-help">This administrator role is protected.</small>}</label>{edit && <label className="admin-checkbox"><input type="checkbox" name="is_active" checked={form.is_active} onChange={change} disabled={protectedUser} />Account can sign in</label>}</section></fieldset><AdminError message={error} /><div className="admin-form-actions"><Link className="btn btn-secondary" to={back}>Cancel</Link><button className="btn btn-primary" disabled={saving} type="submit"><Save size={16} />{saving ? 'Saving…' : edit ? 'Save changes' : 'Create user'}</button></div></form>}</div>;
}
