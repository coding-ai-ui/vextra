import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpRight, X } from 'lucide-react';
import api, { errorMessage } from '../Services/api';
import Dialog from './Dialog';
import { EmptyState } from './ui';
import ProjectVisual from './ProjectVisual';

export default function GlobalSearch({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const navigate = useNavigate();
  useEffect(() => { if (open) { const timer = setTimeout(() => input.current?.focus(), 20); return () => clearTimeout(timer); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => { setLoading(true); setError(''); api.get('/projects/', { params: { search: query.trim() }, signal: controller.signal }).then(({ data }) => { setResults(data.slice(0, 8)); setActive(0); }).catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open]);
  const select = project => { onClose(); navigate(`/projects/${project.slug || project.id}`); };
  return <Dialog open={open} onClose={onClose} title="Follow your curiosity." description="Find projects by name, category, tag, or organization." className="search-dialog"><div className="command-input"><Search size={21}/><input ref={input} type="text" role="combobox" aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls="global-results" aria-activedescendant={!loading && results[active] ? `global-result-${results[active].id}` : undefined} aria-label="Search all projects" value={query} placeholder="A project, an idea, a better tomorrow…" onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(index + 1, results.length - 1)); } if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); } if (event.key === 'Enter' && !loading && results[active]) { event.preventDefault(); select(results[active]); } }}/>{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={17}/></button>}</div><div className="search-result-heading"><span>{query ? 'SEARCH RESULTS' : 'START EXPLORING'}</span><span>{loading ? 'Searching…' : `${results.length} shown`}</span></div>{error ? <p role="alert">{error}</p> : loading ? <div className="command-skeleton" role="status" aria-label="Searching">{[0, 1, 2].map(n => <div key={n} className="skeleton"/>)}</div> : results.length ? <div role="listbox" id="global-results" aria-label="Project results">{results.map((project, index) => <div key={project.id} id={`global-result-${project.id}`} role="option" aria-selected={active === index} className={`command-result ${active === index ? 'is-active' : ''}`} onMouseEnter={() => setActive(index)}><button onClick={() => select(project)}><ProjectVisual category={project.category} title={project.title}/><span><strong>{project.title}</strong><small>{project.category}{project.organization && ` · ${project.organization}`}</small></span><ArrowUpRight size={19}/></button></div>)}</div> : <EmptyState title="A new direction?">Try a different idea, category or organization.</EmptyState>}<div className="command-help"><span><kbd>↑</kbd> <kbd>↓</kbd> to explore</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></div></Dialog>;
}
