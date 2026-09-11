import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Send, MapPin, Building2 } from 'lucide-react';
import api from '../Services/api';
import { AdminError, AdminSkeleton, adminErrorMessage } from '../Components/AdminUI';
import Dialog from '../Components/Dialog';
import ProjectVisual from '../Components/ProjectVisual';
import { ProgressBar, RiskBadge } from '../Components/ui';
import { useToast } from '../context/ToastContext';

const empty = { title: '', short_description: '', description: '', objective: '', impact: '', category: 'Clean Energy', image: '', funding_goal: '', current_funding: '0', expected_return: '', duration: '12', risk_level: 'Medium', featured: false, organization: '', location: '', status: 'draft', impact_area: '', impact_score: '0', tags: [], gallery: [], sustainability: [] };
const arrays = ['tags', 'gallery', 'sustainability'];
const displayForm = data => Object.fromEntries(Object.entries({ ...empty, ...data }).map(([key, value]) => [key, arrays.includes(key) ? (Array.isArray(value) ? value.join(key === 'tags' ? ', ' : '\n') : value || '') : value ?? '']));
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function AdminProjectForm() {
  const { id } = useParams();
  return <AdminProjectFormEditor key={id || "new"} id={id} />;
}

function AdminProjectFormEditor({ id }) {
  const edit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState(() => displayForm(empty));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState('');
  const [preview, setPreview] = useState(false);
  const [revision, setRevision] = useState(0);
  const formRef = useRef(null);
  useEffect(() => {
    document.title = `${edit ? 'Edit' : 'New'} project | Vextra`;
    if (!edit) return;
    const controller = new AbortController();
    api.get(`/projects/admin/${id}/`, { signal: controller.signal }).then(({ data }) => { if (!controller.signal.aborted) setForm(displayForm(data)); }).catch(reason => { if (!controller.signal.aborted) setError(adminErrorMessage(reason)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [edit, id, revision]);
  const change = event => { const { name, value, checked, type } = event.target; setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value })); };
  async function save(status) {
    if (saving || !formRef.current?.reportValidity()) return;
    setError(''); setSaving(status);
    const payload = Object.fromEntries(Object.keys(empty).map(key => [key, arrays.includes(key) ? String(form[key]).split(key === 'tags' ? ',' : '\n').map(value => value.trim()).filter(Boolean) : form[key]]));
    payload.status = status;
    try {
      const response = edit ? await api.patch(`/projects/admin/${id}/`, payload) : await api.post('/projects/', payload);
      toast({ title: status === 'draft' ? 'Draft saved' : 'Project published', message: status === 'draft' ? 'Your draft is private until you publish it.' : 'The project is now available to explore.', ...(status !== 'draft' ? { action: { to: `/projects/${response.data.slug || response.data.id}`, label: 'View project' } } : {}) });
      navigate('/admin/projects' + (status === 'draft' ? '?status=draft' : ''));
    } catch (reason) { setError(adminErrorMessage(reason)); }
    finally { setSaving(''); }
  }
  const progress = Number(form.funding_goal) > 0 ? Math.min(100, Number(form.current_funding) / Number(form.funding_goal) * 100) : 0;
  return <div><Link className="admin-back" to="/admin/projects"><ArrowLeft size={15} /> Back to projects</Link><div className="admin-form-heading"><div><span className="eyebrow">{edit ? 'REFINE THE IDEA' : 'ADD TO THE CATALOGUE'}</span><h1>{edit ? 'Edit project' : 'New project'}</h1><p className="admin-editor-intro">Every possibility deserves a clear story. Review the preview before sharing it.</p></div></div>
    {loading ? <AdminSkeleton label="Loading project editor" /> : error && edit && !form.title ? <AdminError message={error} onRetry={() => { setLoading(true); setError(''); setRevision(value => value + 1); }} /> : <form ref={formRef} className="admin-editor-form" onSubmit={event => { event.preventDefault(); save(form.status === 'draft' ? 'active' : form.status); }}>
      <fieldset disabled={Boolean(saving)} className="admin-editor-fields"><section><h2>The project</h2><div className="admin-field-grid"><label>Project name<input name="title" value={form.title} onChange={change} maxLength={180} required /></label><label>Category<select name="category" value={form.category} onChange={change}><option>Clean Energy</option><option>Technology</option><option>Healthcare</option><option>Sustainable Agriculture</option><option>Education</option><option>Water</option><option>Infrastructure</option></select></label></div>
      <label>Short summary<input name="short_description" value={form.short_description} onChange={change} maxLength={260} required /><small className="admin-help">{form.short_description.length}/260 characters</small></label>
      <label>Full description<textarea name="description" value={form.description} onChange={change} rows={6} required /></label>
      <div className="admin-field-grid"><label>Organization or company<input name="organization" value={form.organization} onChange={change} maxLength={180} /></label><label>Location<input name="location" value={form.location} onChange={change} maxLength={180} /></label></div>
      <div className="admin-field-grid"><label>Objective<textarea name="objective" value={form.objective} onChange={change} rows={4} /></label><label>Impact information<textarea name="impact" value={form.impact} onChange={change} rows={4} /></label></div>
      <div className="admin-field-grid"><label>Impact area<input name="impact_area" value={form.impact_area} onChange={change} maxLength={120} /></label><label>Educational impact score<input name="impact_score" type="number" min="0" max="100" step="1" value={form.impact_score} onChange={change} required /><small className="admin-help">0–100. An educational comparison indicator, not a certified rating.</small></label></div>
      <label>Tags<input name="tags" value={form.tags} onChange={change} /><small className="admin-help">Separate tags with commas, for example: solar, communities, renewable energy.</small></label>
      <label>Sustainability factors<textarea name="sustainability" value={form.sustainability} onChange={change} rows={3} /><small className="admin-help">One meaningful factor per line.</small></label></section>
      <section><h2>Project imagery</h2><p className="admin-section-intro">Use publicly accessible HTTPS image links. Without a cover, Vextra uses the existing category illustration.</p><label>Cover image URL<input name="image" type="url" value={form.image} onChange={change} /></label><label>Gallery image URLs<textarea name="gallery" value={form.gallery} onChange={change} rows={3} /><small className="admin-help">One image URL per line. Use images you have permission to share.</small></label></section>
      <section><h2>Simulation details</h2><p className="admin-section-intro">These figures describe an educational scenario. No real money is invested.</p><div className="admin-field-grid admin-field-grid-4"><label>Investment target ($)<input name="funding_goal" type="number" min="0.01" step="0.01" value={form.funding_goal} onChange={change} required /></label><label>Scenario funding ($)<input name="current_funding" type="number" min="0" step="0.01" value={form.current_funding} onChange={change} required /></label><label>Simulated return (%)<input name="expected_return" type="number" min="0" max="100" step="0.01" value={form.expected_return} onChange={change} required /></label><label>Duration (months)<input name="duration" type="number" min="1" max="120" value={form.duration} onChange={change} required /></label></div>
      <div className="admin-field-grid"><label>Risk level<select name="risk_level" value={form.risk_level} onChange={change}><option>Low</option><option>Medium</option><option>High</option></select></label><label>Project status<select name="status" value={form.status} onChange={change}><option value="draft">Draft — private</option><option value="active">Active — public</option><option value="completed">Completed — public</option></select></label></div><label className="admin-checkbox"><input name="featured" type="checkbox" checked={Boolean(form.featured)} onChange={change} /> Feature this project when published</label></section></fieldset>
      <AdminError message={error} />
      <div className="admin-editor-actions"><Link className="btn btn-secondary" to="/admin/projects">Cancel</Link><button className="btn btn-secondary" type="button" disabled={Boolean(saving)} onClick={() => setPreview(true)}><Eye size={16} />Preview</button><button className="btn btn-secondary" type="button" disabled={Boolean(saving)} onClick={() => save('draft')}><Save size={16} />{saving === 'draft' ? 'Saving draft…' : 'Save Draft'}</button><button className="btn btn-primary" type="submit" disabled={Boolean(saving)}><Send size={16} />{saving && saving !== 'draft' ? 'Publishing…' : edit && form.status !== 'draft' ? 'Publish changes' : 'Publish'}</button></div>
    </form>}
    <Dialog open={preview} onClose={() => setPreview(false)} title="Project preview" description="This preview uses your current edits. Nothing is published until you choose Publish." wide>
      <article className="admin-project-preview"><div className="admin-preview-cover"><ProjectVisual category={form.category} title={form.title} />{form.image && <img src={form.image} alt={`${form.title || 'Project'} cover`} onError={event => { event.currentTarget.hidden = true; }} />}</div><div className="admin-preview-story"><span className="eyebrow">{form.category} / {form.status}</span><h2>{form.title || 'Untitled project'}</h2><p className="admin-preview-summary">{form.short_description || 'Add a short summary to introduce this possibility.'}</p><div className="admin-preview-meta">{form.organization && <span><Building2 size={15} />{form.organization}</span>}{form.location && <span><MapPin size={15} />{form.location}</span>}<RiskBadge risk={form.risk_level} /></div><div className="admin-preview-numbers"><div><small>Simulated return</small><strong>{form.expected_return || '0'}%</strong></div><div><small>Impact score</small><strong>{form.impact_score || '0'}<small>/100</small></strong></div><div><small>Investment target</small><strong>{money(form.funding_goal)}</strong></div></div><ProgressBar value={progress} /><p className="admin-help">{progress.toFixed(1)}% of the fictional funding goal · {form.duration} months</p><div className="admin-preview-body">{form.description && <p>{form.description}</p>}{form.objective && <section><h3>The objective</h3><p>{form.objective}</p></section>}{form.impact && <section><h3>The intended impact</h3><p>{form.impact}</p></section>}{String(form.sustainability).trim() && <section><h3>Sustainability factors</h3><ul>{String(form.sustainability).split('\n').map(value => value.trim()).filter(Boolean).map((value, index) => <li key={index}>{value}</li>)}</ul></section>}</div>{String(form.gallery).trim() && <div className="admin-preview-gallery">{String(form.gallery).split('\n').map(value => value.trim()).filter(Boolean).map((value, index) => <img key={`${value}-${index}`} src={value} alt={`${form.title || 'Project'}, gallery image ${index + 1}`} onError={event => { event.currentTarget.hidden = true; }} />)}</div>}<div className="admin-tags">{String(form.tags).split(',').map(tag => tag.trim()).filter(Boolean).map((tag, index) => <span key={index}>{tag}</span>)}</div><p className="admin-preview-disclaimer">Simulation only — no real money is being invested.</p></div></article>
    </Dialog>
  </div>;
}
