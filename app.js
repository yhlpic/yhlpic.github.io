(() => {
  'use strict';
  const shuffle = items => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const gallery = document.querySelector('#gallery');
  const viewer = document.querySelector('#viewer');
  const about = document.querySelector('#about');
  const enlarged = document.querySelector('#enlarged');
  const sequence = [];
  let current = -1;
  let returnFocus = null;
  let lastWheel = 0;
  let wheelTotal = 0;
  let lastWheelEvent = 0;
  let savedScroll = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const masthead = document.querySelector('.masthead');
  const projects = shuffle(window.PHOTO_PROJECTS || []);
  document.querySelector('meta[name="theme-color"]').content = document.documentElement.dataset.theme === 'dark' ? '#000000' : '#ffffff';
  projects.forEach(project => {
    const section = document.createElement('section');
    section.className = 'project';
    section.dataset.project = project.id;
    section.setAttribute('aria-label', project.name);
    shuffle(project.photos).forEach(photo => {
      const index = sequence.length;
      sequence.push({...photo, project: project.name, projectId: project.id});
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'photo';
      button.dataset.index = index;
      button.dataset.photo = photo.id;
      button.style.setProperty('--ratio', `${photo.width} / ${photo.height}`);
      button.setAttribute('aria-label', `Open ${photo.alt || project.name}`);
      for (const layer of ['photo-image']) {
        const image = document.createElement('img');
        image.className = layer;
        image.src = photo.thumb;
        image.width = photo.width;
        image.height = photo.height;
        image.alt = '';
        image.loading = index < 10 ? 'eager' : 'lazy';
        image.decoding = 'async';
        image.draggable = false;
        button.append(image);
      }
      button.addEventListener('click', () => openPhoto(index, button));
      section.append(button);
    });
    gallery.append(section);
  });
  function lockPage(trigger) {
    returnFocus = trigger;
    savedScroll = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScroll}px`;
    document.body.style.width = '100%';
    document.body.classList.add('modal-open');
  }
  function unlockPage() {
    document.body.classList.remove('modal-open','about-open','viewer-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo({top:savedScroll, behavior:'instant'});
    returnFocus?.focus({preventScroll:true});
  }
  function showPhoto(index) {
    if (!sequence.length) return;
    current = (index + sequence.length) % sequence.length;
    const photo = sequence[current];
    enlarged.src = photo.src;
    enlarged.alt = photo.alt || photo.project;
    enlarged.width = photo.width;
    enlarged.height = photo.height;
    viewer.dataset.index = current;
    viewer.dataset.project = photo.projectId;
    document.querySelector('#photo-status').textContent = `${photo.project}, photograph ${current + 1} of ${sequence.length}`;
    for (const offset of [-1, 1]) {
      const next = sequence[(current + offset + sequence.length) % sequence.length];
      const preload = new Image();
      preload.src = next.src;
    }
  }
  function openPhoto(index, trigger) {
    lockPage(trigger);
    document.body.classList.add('viewer-open');
    lastWheel = 0;
    wheelTotal = 0;
    showPhoto(index);
    viewer.showModal();
    viewer.focus({preventScroll:true});
  }
  function closeModal(dialog) { if (dialog.open) dialog.close(); }
  function toTop(event) {
    event?.preventDefault();
    closeModal(viewer);
    closeModal(about);
    // Close events are queued; restore before beginning the smooth trip.
    if (document.body.classList.contains('modal-open')) unlockPage();
    savedScroll = 0;
    requestAnimationFrame(() => window.scrollTo({top:0,behavior:reducedMotion.matches ? 'instant' : 'smooth'}));
  }
  document.querySelector('.wordmark').addEventListener('click', toTop);
  document.querySelector('.photography').addEventListener('click', toTop);
  document.querySelector('.about-trigger').addEventListener('click', event => {
    if (about.open) { closeModal(about); return; }
    lockPage(event.currentTarget);
    document.body.classList.add('about-open');
    event.currentTarget.setAttribute('aria-expanded','true');
    // Move the SAME masthead into the dialog's top layer. Every coordinate,
    // pixel, space and baseline stays fixed; only its clipped tails unfold.
    about.append(masthead);
    about.showModal();
    event.currentTarget.focus({preventScroll:true});
  });
  for (const dialog of [viewer,about]) {
    dialog.addEventListener('close', () => {
      if (dialog === about) {
        document.querySelector('#top').before(masthead);
        masthead.querySelector('.about-trigger').setAttribute('aria-expanded','false');
      }
      if (document.body.classList.contains('modal-open')) unlockPage();
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.classList.contains('viewer-stage')) closeModal(dialog);
    });
    dialog.querySelector('.close-control').addEventListener('click', () => closeModal(dialog));
  }
  viewer.querySelector('.previous').addEventListener('click', () => showPhoto(current - 1));
  viewer.querySelector('.next').addEventListener('click', () => showPhoto(current + 1));
  viewer.addEventListener('keydown', event => {
    if (['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)) {
      event.preventDefault();
      showPhoto(current + (['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1));
    }
  });
  viewer.addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    event.preventDefault();
    const now = performance.now();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    if (now - lastWheelEvent > 180 || Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
    lastWheelEvent = now;
    wheelTotal += delta;
    if (Math.abs(wheelTotal) < 28 || now - lastWheel < 350) return;
    showPhoto(current + Math.sign(wheelTotal));
    wheelTotal = 0;
    lastWheel = now;
  }, {passive:false});
  window.attachPhotoGestures(viewer, delta => showPhoto(current + delta));
  about.addEventListener('wheel', event => event.preventDefault(), {passive:false});
  const instagram = document.querySelector('.instagram');
  instagram.addEventListener('click', event => {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    if (!mobile) return;
    event.preventDefault();
    const fallback = setTimeout(() => {if (document.visibilityState === 'visible') location.href = instagram.href;}, 1200);
    document.addEventListener('visibilitychange', () => {if (document.hidden) clearTimeout(fallback);}, {once:true});
    location.href = 'instagram://user?username=yhlpic';
  });
})();
