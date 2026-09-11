import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
export default function Accordion({ items }) {
  const prefix = useId();
  const [active, setActive] = useState(null);
  return <div className="vestra-accordion">{items.map(([title, content], index) => <section key={title} className={active === index ? 'is-open' : ''}><h2><button aria-expanded={active === index} aria-controls={`${prefix}-${index}`} onClick={() => setActive(active === index ? null : index)}><span>{title}</span><Plus size={21}/></button></h2><div className="accordion-reveal" id={`${prefix}-${index}`} inert={active !== index}><div><p>{content}</p></div></div></section>)}</div>;
}
