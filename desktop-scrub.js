(() => {
  'use strict';
  window.attachDesktopPhotoScrub = (element, handlers) => {
    const removers = [];
    const stepDistance = 40;
    const dragDistance = 8;
    let gesture = null;
    let pendingClick = null;
    let suppressMouseClick = false;
    let lastPointerType = null;
    const listen = (type, handler, options) => {
      element.addEventListener(type, handler, options);
      removers.push(() => element.removeEventListener(type, handler, options));
    };
    const release = completed => {
      try {
        if (completed.target.hasPointerCapture?.(completed.id)) completed.target.releasePointerCapture(completed.id);
      } catch {}
    };
    const cancel = () => {
      pendingClick = null;
      if (!gesture) return;
      const cancelled = gesture;
      gesture = null;
      suppressMouseClick = true;
      handlers.onCancel?.();
      release(cancelled);
    };
    const move = event => {
      if (!gesture) return;
      const dx = event.clientX - gesture.lastX;
      const direction = Math.sign(dx);
      if (Math.max(Math.abs(event.clientX - gesture.x), Math.abs(event.clientY - gesture.y)) >= dragDistance) {
        gesture.dragged = true;
        suppressMouseClick = true;
      }
      gesture.lastX = event.clientX;
      // Reversing direction starts a fresh distance, avoiding an old remainder dead zone.
      if (direction && direction !== gesture.direction) {
        gesture.direction = direction;
        gesture.remainder = 0;
      }
      gesture.remainder += dx;
      while (gesture && Math.abs(gesture.remainder) >= stepDistance) {
        const step = Math.sign(gesture.remainder);
        gesture.remainder -= step * stepDistance;
        handlers.onStep?.(-step);
      }
    };
    listen('pointerdown', event => {
      lastPointerType = event.pointerType;
      if (event.pointerType !== 'mouse') return;
      if (!element.open || event.button !== 0 || event.isPrimary === false) return;
      if (gesture) cancel();
      pendingClick = null;
      suppressMouseClick = false;
      const start = {target: event.target, x: event.clientX, y: event.clientY};
      if (handlers.onStart?.(start) === false) return;
      gesture = {id: event.pointerId, ...start, lastX: event.clientX, direction: 0, remainder: 0, dragged: false};
      try { event.target.setPointerCapture?.(event.pointerId); } catch {}
      if (event.cancelable) event.preventDefault();
    });
    listen('pointermove', event => {
      if (event.pointerType !== 'mouse' || event.pointerId !== gesture?.id) return;
      if (event.buttons === 0 || !element.open) { cancel(); return; }
      move(event);
      if (event.cancelable) event.preventDefault();
    }, {passive: false});
    listen('pointerup', event => {
      if (event.pointerType !== 'mouse' || event.pointerId !== gesture?.id) return;
      if (!element.open) { cancel(); return; }
      move(event);
      const completed = gesture;
      if (!completed) return;
      gesture = null;
      if (!completed.dragged) pendingClick = {target: completed.target, x: event.clientX, y: event.clientY};
      else suppressMouseClick = true;
      handlers.onEnd?.();
      // Pointerup implicitly releases capture and preserves the original click target.
    });
    const cancelPointer = event => {
      if (event.pointerType === 'mouse' && event.pointerId === gesture?.id) cancel();
    };
    listen('pointercancel', cancelPointer);
    listen('lostpointercapture', cancelPointer);
    listen('click', event => {
      const mouseClick = event.pointerType ? event.pointerType === 'mouse' : lastPointerType === 'mouse';
      if (!mouseClick || event.detail === 0) return;
      if (suppressMouseClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!pendingClick || !element.open) return;
      const clicked = pendingClick;
      pendingClick = null;
      handlers.onClick?.(clicked);
    }, true);
    listen('dragstart', event => {
      if (gesture && event.cancelable) event.preventDefault();
    });
    listen('close', cancel);
    return () => {
      cancel();
      removers.forEach(remove => remove());
    };
  };
})();
