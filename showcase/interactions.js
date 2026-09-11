(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 900px)');
  const header = $('#site-header');
  const pageProgress = $('#scroll-progress');
  const gallery = $('#spaces');
  const track = $('.gallery-track');
  const cards = $$('.project-card');
  const galleryCurrent = $('#gallery-current');
  const galleryProgress = $('.gallery-progress-fill');
  const previousButton = $('#gallery-prev');
  const nextButton = $('#gallery-next');
  const parallaxItems = $$('[data-parallax]');
  let galleryDistance = 0;
  let galleryStart = 0;
  let projectStops = [];
  let currentProject = 0;
  let animationFrame = 0;
  let resizeFrame = 0;

  const isPinned = () => desktop.matches && !reducedMotion.matches;
  const motionBehavior = () => reducedMotion.matches ? 'auto' : 'smooth';

  function setCurrentProject(index, progress) {
    currentProject = index;
    if (galleryCurrent) galleryCurrent.textContent = String(index + 1).padStart(2, '0');
    if (galleryProgress) galleryProgress.style.transform = `scaleX(${progress})`;
    if (previousButton) previousButton.disabled = index === 0;
    if (nextButton) nextButton.disabled = index >= cards.length - 1;
  }

  function updateGallery(position) {
    if (!track || !cards.length) return;
    const maximum = isPinned() ? galleryDistance : Math.max(0, track.scrollWidth - track.clientWidth);
    const offset = clamp(position, 0, maximum);
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    projectStops.forEach((stop, index) => {
      const distance = Math.abs(offset - stop);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    // Keep the last project reachable when the final scroll stop is short.
    if (maximum > 0 && offset >= maximum - 2) nearestIndex = cards.length - 1;
    const progress = cards.length > 1 ? (nearestIndex + 1) / cards.length : 1;
    setCurrentProject(nearestIndex, progress);
  }

  function renderScroll() {
    animationFrame = 0;
    const scrollY = window.scrollY;
    const documentDistance = document.documentElement.scrollHeight - window.innerHeight;
    if (pageProgress) pageProgress.style.transform = `scaleX(${documentDistance > 0 ? clamp(scrollY / documentDistance, 0, 1) : 0})`;
    if (header) header.classList.toggle('is-scrolled', scrollY > 60);

    if (gallery && track && isPinned()) {
      const offset = clamp(scrollY - galleryStart, 0, galleryDistance);
      gallery.style.setProperty('--gallery-x', `${-offset}px`);
      updateGallery(offset);
    }

    if (!reducedMotion.matches) {
      parallaxItems.forEach(element => {
        const rectangle = (element.parentElement || element).getBoundingClientRect();
        if (rectangle.bottom < 0 || rectangle.top > window.innerHeight) return;
        const speed = Number.parseFloat(element.dataset.parallax) || 0.12;
        const offset = clamp(-rectangle.top * speed, -80, 80);
        element.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`);
      });
    }
  }

  function queueScroll() {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(renderScroll);
  }

  function measureGallery() {
    resizeFrame = 0;
    if (gallery && track && cards.length) {
      const pinned = isPinned();
      gallery.classList.toggle('is-pinned', pinned);
      galleryDistance = pinned ? Math.max(0, track.scrollWidth - window.innerWidth) : 0;
      gallery.style.setProperty('--gallery-distance', `${Math.ceil(galleryDistance)}px`);
      gallery.style.setProperty('--gallery-x', '0px');
      if (pinned) track.scrollLeft = 0;
      galleryStart = gallery.getBoundingClientRect().top + window.scrollY;
      const maximum = pinned ? galleryDistance : Math.max(0, track.scrollWidth - track.clientWidth);
      const firstOffset = cards[0].offsetLeft;
      projectStops = cards.map(card => clamp(card.offsetLeft - firstOffset, 0, maximum));
      if (projectStops.length > 1) projectStops[projectStops.length - 1] = maximum;
      if (!pinned) updateGallery(track.scrollLeft);
    }
    queueScroll();
  }

  function queueMeasure() {
    if (!resizeFrame) resizeFrame = window.requestAnimationFrame(measureGallery);
  }

  function moveGallery(direction) {
    if (!gallery || !track || !cards.length) return;
    const targetIndex = clamp(currentProject + direction, 0, cards.length - 1);
    const destination = projectStops[targetIndex] || 0;
    if (isPinned()) {
      window.scrollTo({ top: galleryStart + destination, behavior: motionBehavior() });
    } else {
      track.scrollBy({ left: destination - track.scrollLeft, behavior: motionBehavior() });
    }
  }

  previousButton?.addEventListener('click', () => moveGallery(-1));
  nextButton?.addEventListener('click', () => moveGallery(1));
  track?.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    moveGallery(event.key === 'ArrowRight' ? 1 : -1);
  });
  track?.addEventListener('focusin', event => {
    if (!isPinned()) return;
    const card = event.target.closest('.project-card');
    if (!card) return;
    const index = cards.indexOf(card);
    const bounds = card.getBoundingClientRect();
    if (bounds.left < 0 || bounds.right > window.innerWidth) {
      window.scrollTo({ top: galleryStart + projectStops[index], behavior: 'instant' });
      const sticky = $('.gallery-sticky');
      if (sticky) sticky.scrollLeft = 0;
      queueScroll();
    }
  });
  track?.addEventListener('scroll', () => {
    if (!isPinned()) updateGallery(track.scrollLeft);
  }, { passive: true });
  window.addEventListener('scroll', queueScroll, { passive: true });
  window.addEventListener('resize', queueMeasure, { passive: true });
  window.addEventListener('load', queueMeasure);
  desktop.addEventListener('change', queueMeasure);
  if ('ResizeObserver' in window && track) {
    const galleryObserver = new ResizeObserver(queueMeasure);
    galleryObserver.observe(track);
    cards.forEach(card => galleryObserver.observe(card));
  }
  document.fonts?.ready.then(queueMeasure);

  const revealItems = $$('[data-reveal]');
  let revealObserver;
  function configureMotion() {
    revealObserver?.disconnect();
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      revealItems.forEach(element => element.classList.add('is-visible'));
    } else {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });
      revealItems.filter(element => !element.classList.contains('is-visible')).forEach(element => revealObserver.observe(element));
    }
    if (reducedMotion.matches) {
      parallaxItems.forEach(element => element.style.setProperty('--parallax-y', '0px'));
    }
    queueMeasure();
  }
  reducedMotion.addEventListener('change', configureMotion);

  const menuToggle = $('#menu-toggle');
  const mobileMenu = $('#mobile-menu');
  function closeMenu(returnFocus = false) {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open menu');
    mobileMenu.hidden = true;
    if (returnFocus) menuToggle.focus();
  }
  menuToggle?.addEventListener('click', () => {
    if (!mobileMenu) return;
    const willOpen = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(willOpen));
    menuToggle.setAttribute('aria-label', willOpen ? 'Close menu' : 'Open menu');
    mobileMenu.hidden = !willOpen;
  });
  mobileMenu?.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobileMenu && !mobileMenu.hidden) closeMenu(true);
  });
  desktop.addEventListener('change', event => {
    if (event.matches) closeMenu();
  });

  const projects = [
    {
      title: 'Casa Brisa',
      location: 'Comporta, Portugal',
      description: 'A home shaped by the Atlantic light. Quiet volumes, warm limestone, and open courtyards create a gentle conversation between the architecture and its coastal landscape.',
      details: 'Residential · 2025 · 340 m²'
    },
    {
      title: 'Quiet Form',
      location: 'Kyoto, Japan',
      description: 'An intimate retreat around a secluded garden. Natural timber and textured walls frame changing light, bringing a sense of stillness to the rhythms of everyday life.',
      details: 'Private retreat · 2024 · 210 m²'
    },
    {
      title: 'The Horizon',
      location: 'Joshua Tree, California',
      description: 'Low, sculptural forms settle into the desert. Deep shade, honest materials, and generous views connect a series of intimate spaces to the open landscape beyond.',
      details: 'Residential · 2025 · 420 m²'
    }
  ];

  const projectDialog = $('#project-dialog');
  const contactDialog = $('#contact-dialog');
  let dialogTrigger;

  function openDialog(dialog, trigger) {
    if (!dialog || dialog.open) return;
    dialogTrigger = trigger;
    closeMenu();
    dialog.showModal();
    document.documentElement.classList.add('dialog-open');
  }

  function openProject(index, trigger) {
    if (!projectDialog || !projects[index]) return;
    const card = cards[index];
    const project = { ...projects[index], ...(card?.dataset || {}), ...(trigger?.dataset || {}) };
    const title = $('#project-title');
    const location = $('#project-location');
    const description = $('#project-description');
    const details = $('#project-details');
    const image = $('#project-image');
    if (title) title.textContent = project.title;
    if (location) location.textContent = project.location;
    if (description) description.textContent = project.description;
    if (details) details.textContent = project.details;
    if (image) {
      const cardImage = card?.querySelector('img');
      const source = project.image || cardImage?.currentSrc || cardImage?.src;
      if (source) image.src = source;
      image.alt = cardImage?.alt || `${project.title}, ${project.location}`;
    }
    openDialog(projectDialog, trigger);
  }

  $$('[data-project]').forEach(trigger => {
    trigger.addEventListener('click', () => openProject(Number(trigger.dataset.project), trigger));
  });
  $('#contact-open')?.addEventListener('click', event => openDialog(contactDialog, event.currentTarget));
  $$('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });
  [projectDialog, contactDialog].filter(Boolean).forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (outside) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('dialog-open');
      if (dialogTrigger?.isConnected) dialogTrigger.focus({ preventScroll: true });
    });
  });

  const contactForm = $('#contact-form');
  const contactResult = $('#contact-result');
  const draftEmail = $('#draft-email');
  let briefUrl;
  contactForm?.addEventListener('submit', event => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    const values = new FormData(contactForm);
    const name = String(values.get('name') || '').trim();
    const email = String(values.get('email') || '').trim();
    const project = String(values.get('project') || '').trim();
    const type = String(values.get('type') || 'To be explored').trim();
    const body = `STILL — PROJECT BRIEF\n\nPrepared: ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}\n\nName: ${name}\nEmail: ${email}\nProject type: ${type}\n\nTHE VISION\n\n${project}\n\n---\nPrepared locally with the STILL concept website. No information has been sent.`;
    if (briefUrl) URL.revokeObjectURL(briefUrl);
    briefUrl = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
    if (draftEmail) {
      draftEmail.href = briefUrl;
      draftEmail.download = 'still-project-brief.txt';
    }
    if (contactResult) {
      contactResult.hidden = false;
      const message = $('[data-result-message]', contactResult);
      if (message) message.textContent = 'Your brief is ready. Save a copy to start the conversation.';
      contactResult.setAttribute('tabindex', '-1');
      contactResult.focus({ preventScroll: true });
      contactResult.scrollIntoView({ block: 'nearest', behavior: motionBehavior() });
    }
  });

  function resetContactResult() {
    if (contactResult) contactResult.hidden = true;
    if (draftEmail) draftEmail.removeAttribute('href');
    if (briefUrl) URL.revokeObjectURL(briefUrl);
    briefUrl = undefined;
  }
  $('#contact-reset')?.addEventListener('click', () => {
    resetContactResult();
    $('[name="name"]', contactForm || document)?.focus();
  });
  contactForm?.addEventListener('input', resetContactResult);
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  configureMotion();
  measureGallery();
})();
