(() => {
  'use strict';
  window.attachPhotoGestures = (element, onNavigate) => {
    const removers = [];
    const pointers = new Set();
    const interactive = 'button, a, input, select, textarea, [role="button"]';
    let gesture = null;
    let ignoreClickUntil = 0;
    const listen = (type, handler, options) => {
      element.addEventListener(type, handler, options);
      removers.push(() => element.removeEventListener(type, handler, options));
    };
    const blockedTarget = target => Boolean(target.closest?.(interactive));
    const point = event => ({x: event.clientX, y: event.clientY});
    const begin = (id, position, blocked) => {
      // Every new physical press permits its own click, including a real tap
      // immediately after a swipe.
      ignoreClickUntil = 0;
      gesture = {id, ...position, blocked};
    };
    const finish = position => {
      const completed = gesture;
      gesture = null;
      if (!completed || completed.blocked || !position || !element.open) return;
      const dx = position.x - completed.x;
      const dy = position.y - completed.y;
      const distance = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      const threshold = Math.max(36, Math.min(64, Math.min(innerWidth, innerHeight) * 0.065));
      if (Math.abs(distance) < threshold) return;
      ignoreClickUntil = performance.now() + 800;
      onNavigate(distance < 0 ? 1 : -1);
    };
    const cancel = () => {
      gesture = null;
      pointers.clear();
    };
    listen('click', event => {
      // Block the browser's compatibility click from the completed swipe.
      // Keyboard activation and any new physical press remain usable.
      if (event.detail === 0 || !ignoreClickUntil || performance.now() > ignoreClickUntil) return;
      ignoreClickUntil = 0;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    listen('close', () => {
      cancel();
      ignoreClickUntil = 0;
    });

    if ('PointerEvent' in window) {
      listen('pointerdown', event => {
        if (!element.open || (event.pointerType === 'mouse' && (event.button !== 0 || event.isPrimary === false))) return;
        if (!pointers.size) begin(event.pointerId, point(event), blockedTarget(event.target));
        pointers.add(event.pointerId);
        if (pointers.size > 1 && gesture) gesture.blocked = true;
        if (gesture && !gesture.blocked) {
          // Keep capture on the pressed photo/stage so a stationary photo tap
          // is not retargeted to the dialog's blank-space close handler.
          try { event.target.setPointerCapture?.(event.pointerId); } catch {}
          if (event.pointerType === 'mouse' && event.cancelable) event.preventDefault();
        }
      });
      listen('pointermove', event => {
        if (!pointers.has(event.pointerId) || !gesture || gesture.blocked) return;
        if (event.cancelable) event.preventDefault();
      }, {passive: false});
      listen('pointerup', event => {
        if (!pointers.has(event.pointerId)) return;
        pointers.delete(event.pointerId);
        if (!pointers.size) finish(event.pointerId === gesture?.id ? point(event) : null);
      });
      const cancelPointer = event => {
        if (!pointers.has(event.pointerId)) return;
        pointers.delete(event.pointerId);
        if (gesture) gesture.blocked = true;
        if (!pointers.size) gesture = null;
      };
      listen('pointercancel', cancelPointer);
      listen('lostpointercapture', cancelPointer);
    } else {
      // Older touch browsers use the same release-once rule and dominant axis.
      listen('touchstart', event => {
        if (!element.open) return;
        if (!gesture && event.touches.length === 1) {
          const touch = event.touches[0];
          begin(touch.identifier, point(touch), blockedTarget(event.target));
        } else if (event.touches.length > 1) {
          if (gesture) gesture.blocked = true;
          else gesture = {blocked: true};
        }
      }, {passive: true});
      listen('touchmove', event => {
        if (!gesture || gesture.blocked) return;
        if (event.touches.length !== 1) { gesture.blocked = true; return; }
        if (event.cancelable) event.preventDefault();
      }, {passive: false});
      listen('touchend', event => {
        if (!gesture || event.touches.length) return;
        const touch = Array.from(event.changedTouches).find(item => item.identifier === gesture.id);
        finish(touch ? point(touch) : null);
      }, {passive: true});
      listen('touchcancel', cancel, {passive: true});
    }
    return () => {
      cancel();
      removers.forEach(remove => remove());
    };
  };
})();
