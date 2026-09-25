(() => {
  'use strict';
  const root = document.documentElement;
  root.dataset.focusInput = 'pointer';
  document.addEventListener('pointerdown', () => { root.dataset.focusInput = 'pointer'; }, true);
  document.addEventListener('keydown', () => { root.dataset.focusInput = 'keyboard'; }, true);
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
  const track = document.querySelector('#photo-track');
  const previousPhoto = document.querySelector('#previous-photo');
  const nextPhoto = document.querySelector('#next-photo');
  let sliding = false;
  let slideAnimation = null;
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
    for (const [image, offset] of [[previousPhoto, -1], [enlarged, 0], [nextPhoto, 1]]) {
      const item = sequence[(current + offset + sequence.length) % sequence.length];
      image.src = item.src;
      image.alt = offset === 0 ? item.alt || item.project : '';
      image.width = item.width;
      image.height = item.height;
    }
    viewer.dataset.index = current;
    viewer.dataset.project = photo.projectId;
    document.querySelector('#photo-status').textContent = `${photo.project}, photograph ${current + 1} of ${sequence.length}`;
  }
  const translation = (axis, offset) => axis === 'y' ? `translate3d(0,${offset}px,0)` : `translate3d(${offset}px,0,0)`;
  function resetSlide() {
    if (slideAnimation) slideAnimation.cancel();
    slideAnimation = null;
    track.style.transform = '';
    viewer.classList.remove('dragging');
    sliding = false;
  }
  function moveSlide(axis, offset) {
    viewer.dataset.slideAxis = axis;
    track.style.transform = translation(axis, offset);
  }
  function navigatePhoto(delta, axis = 'x', offset = 0) {
    if (!viewer.open || sliding) return;
    viewer.classList.remove('dragging');
    moveSlide(axis, offset);
    if ((!delta && !offset) || reducedMotion.matches) {
      if (delta) showPhoto(current + delta);
      resetSlide();
      return;
    }
    sliding = true;
    const distance = axis === 'y' ? viewer.clientHeight : viewer.clientWidth;
    const target = delta ? -Math.sign(delta) * distance : 0;
    const animation = track.animate([
      {transform: translation(axis, offset)},
      {transform: translation(axis, target)}
    ], {duration: delta ? 240 : 160, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards'});
    slideAnimation = animation;
    animation.onfinish = () => {
      if (slideAnimation !== animation) return;
      if (delta) showPhoto(current + delta);
      resetSlide();
    };
  }
  function openPhoto(index, trigger) {
    resetSlide();
    viewer.dataset.slideAxis = 'x';
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
      if (dialog === viewer) resetSlide();
      if (dialog === about) {
        document.querySelector('#top').before(masthead);
        masthead.querySelector('.about-trigger').setAttribute('aria-expanded','false');
      }
      if (document.body.classList.contains('modal-open')) unlockPage();
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.matches('.viewer-stage,.viewer-track,.viewer-slide')) closeModal(dialog);
    });
  }
  viewer.querySelector('.viewer-dismiss').addEventListener('click', () => closeModal(viewer));
  viewer.addEventListener('keydown', event => {
    if (['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (viewer.classList.contains('dragging')) return;
      navigatePhoto(['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1, ['ArrowUp','ArrowDown'].includes(event.key) ? 'y' : 'x');
    }
  });
  viewer.addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    event.preventDefault();
    if (sliding || viewer.classList.contains('dragging')) return;
    const now = performance.now();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    if (now - lastWheelEvent > 180 || Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
    lastWheelEvent = now;
    wheelTotal += delta;
    if (Math.abs(wheelTotal) < 28 || now - lastWheel < 350) return;
    navigatePhoto(Math.sign(wheelTotal), 'y');
    wheelTotal = 0;
    lastWheel = now;
  }, {passive:false});
  window.attachPhotoGestures(viewer, {
    onStart() {
      if (sliding) return false;
      viewer.classList.add('dragging');
      return true;
    },
    onMove({axis, offset}) { moveSlide(axis, offset); },
    onEnd({axis, offset, delta}) { navigatePhoto(delta, axis, offset); },
    onCancel() { resetSlide(); }
  });
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
