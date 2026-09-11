import { useState } from 'react';
import { Bookmark, Check, GitCompareArrows, Share2, BellPlus, Copy, Mail, ArrowUpRight, LoaderCircle } from 'lucide-react';
import { useProduct } from '../context/ProductContext';
import { useToast } from '../context/ToastContext';
import Dialog from './Dialog';

export function SaveButton({ project, compact = false }) {
  const { saved, toggleProject, busy } = useProduct();
  const selected = saved.some(p => p.id === project.id);
  return <button type="button" className={`project-action ${compact ? 'action-compact' : ''} ${selected ? 'is-selected' : ''}`} title={selected ? 'Remove saved project' : 'Save project'} aria-label={`${selected ? 'Unsave' : 'Save'} ${project.title}`} aria-pressed={selected} disabled={busy[`save:${project.id}`]} onClick={() => toggleProject('save', project)}>{busy[`save:${project.id}`] ? <LoaderCircle size={17} className="spin"/> : <Bookmark size={17} fill={selected ? 'currentColor' : 'none'}/>} {!compact && (selected ? 'Saved' : 'Save project')}</button>;
}
export function CompareButton({ project, compact = false }) {
  const { comparison, toggleCompare, comparisonBusy } = useProduct();
  const selected = comparison.some(p => p.id === project.id);
  return <button type="button" className={`project-action ${compact ? 'action-compact' : ''} ${selected ? 'is-selected' : ''}`} aria-label={`${selected ? 'Remove' : 'Compare'} ${project.title}${selected ? ' from comparison' : ''}`} aria-pressed={selected} disabled={comparisonBusy} title={selected ? 'Remove from comparison' : 'Add to comparison'} onClick={() => toggleCompare(project)}>{selected ? <Check size={17}/> : <GitCompareArrows size={17}/>} {!compact && (selected ? 'Added to compare' : 'Compare')}</button>;
}
export function ShareDialog({ project, open, onClose }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const url = `${window.location.origin}/projects/${project.slug || project.id}`;
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setError(''); toast({ title: 'Link copied' }); } catch { setError('Select the link below and copy it with your keyboard.'); } };
  const nativeShare = async () => { try { await navigator.share({ title: project.title, text: 'Explore this educational project on Vestra.', url }); } catch (reason) { if (reason.name !== 'AbortError') setError('Sharing is unavailable. You can copy the link instead.'); } };
  return <Dialog open={open} onClose={onClose} title="Ideas travel further together." description={`Share ${project.title} with someone curious.`}><label className="field-label" htmlFor="share-link">Project link</label><div className="copy-field"><input id="share-link" value={url} readOnly onFocus={event => event.target.select()}/><button className="btn btn-primary btn-small" onClick={copy}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? 'Copied' : 'Copy'}</button></div>{error && <p className="field-error" role="alert">{error}</p>}<div className="share-options"><a href={`mailto:?subject=${encodeURIComponent(project.title)}&body=${encodeURIComponent(`Explore this fictional project on Vestra: ${url}`)}`}><Mail size={18}/> Email</a><a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">LinkedIn <ArrowUpRight size={16}/></a><a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`Explore ${project.title} on Vestra — an educational simulation.`)}`} target="_blank" rel="noopener noreferrer">X / Twitter <ArrowUpRight size={16}/></a>{navigator.share && <button onClick={nativeShare}><Share2 size={18}/> More options</button>}</div></Dialog>;
}
export default function ProjectActions({ project }) {
  const { following, toggleProject, busy } = useProduct();
  const [sharing, setSharing] = useState(false);
  const followed = following.some(p => p.id === project.id);
  return <><div className="project-actions"><SaveButton project={project}/><button className={`project-action ${followed ? 'is-selected' : ''}`} aria-pressed={followed} disabled={busy[`follow:${project.id}`]} onClick={() => toggleProject('follow', project)}><BellPlus size={17}/>{followed ? 'Following' : 'Follow project'}</button><CompareButton project={project}/><button className="project-action" onClick={() => setSharing(true)}><Share2 size={17}/>Share</button></div><ShareDialog project={project} open={sharing} onClose={() => setSharing(false)}/></>;
}
