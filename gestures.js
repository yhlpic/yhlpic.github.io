(() => {
  'use strict';
  window.attachPhotoGestures = (element, handlers) => {
    const removers = [];
    const pointers = new Set();
    const interactive = 'button, a, input, select, textarea, [role="button"]';
    const axisLockDistance = 8;
    let gesture = null;
    let ignoreGestureClick = false;
    let touchSequenceBlocked = false;
    const listen = (type, handler, options) => {
      element.addEventListener(type, handler, options);
      removers.push(() => element.removeEventListener(type, handler, options));
    };
    const blockedTarget = target => Boolean(target.closest?.(interactive));
    const point = event => ({x: event.clientX, y: event.clientY});
    const suppressClick = () => { ignoreGestureClick = true; };
    const cancelGesture = () => {
      if (!gesture) return;
      const cancelled = gesture;
      gesture = null;
      suppressClick();
      if (cancelled.accepted) handlers.onCancel?.();
    };
    const begin = (id, position, target) => {
      // A fresh physical press permits a real tap immediately after a swipe.
      ignoreGestureClick = false;
      if (blockedTarget(target)) return;
      const accepted = handlers.onStart?.() !== false;
      gesture = {id, ...position, axis: null, offset: 0, target, accepted};
    };
    const move = position => {
      if (!gesture) return false;
      const dx = position.x - gesture.x;
      const dy = position.y - gesture.y;
      if (!gesture.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= axisLockDistance) {
        gesture.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      }
      if (!gesture.axis) return false;
      gesture.offset = gesture.axis === 'x' ? dx : dy;
      suppressClick();
      if (gesture.accepted) handlers.onMove?.({axis: gesture.axis, offset: gesture.offset});
      return true;
    };
    const finish = position => {
      if (!gesture) return;
      if (!position || !element.open) { cancelGesture(); return; }
      move(position);
      const completed = gesture;
      gesture = null;
      if (!completed.accepted) return;
      const axis = completed.axis || 'x';
      const offset = completed.offset;
      const threshold = Math.max(36, Math.min(64, Math.min(innerWidth, innerHeight) * 0.065));
      const delta = completed.axis && Math.abs(offset) >= threshold ? (offset < 0 ? 1 : -1) : 0;
      if (completed.axis) suppressClick();
      handlers.onEnd?.({axis, offset, delta});
    };
    const reset = () => {
      const current = gesture;
      cancelGesture();
      pointers.clear();
      touchSequenceBlocked = false;
      ignoreGestureClick = false;
      if (current?.target.hasPointerCapture?.(current.id)) {
        try { current.target.releasePointerCapture(current.id); } catch {}
      }
    };
    listen('click', event => {
      // Keyboard clicks remain usable; only the completed physical gesture is blocked.
      if (event.detail === 0 || !ignoreGestureClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    listen('close', reset);

    if ('PointerEvent' in window) {
      listen('pointerdown', event => {
        if (!element.open || (event.pointerType === 'mouse' && (event.button !== 0 || event.isPrimary === false))) return;
        if (!pointers.size) begin(event.pointerId, point(event), event.target);
        pointers.add(event.pointerId);
        if (pointers.size > 1) { cancelGesture(); suppressClick(); return; }
        if (gesture?.accepted) {
          // Capture on the pressed photo/stage to preserve stationary click targets.
          try { event.target.setPointerCapture?.(event.pointerId); } catch {}
          if (event.pointerType === 'mouse' && event.cancelable) event.preventDefault();
        }
      });
      listen('pointermove', event => {
        if (!pointers.has(event.pointerId) || event.pointerId !== gesture?.id) return;
        if (move(point(event)) && event.cancelable) event.preventDefault();
      }, {passive: false});
      listen('pointerup', event => {
        if (!pointers.has(event.pointerId)) return;
        pointers.delete(event.pointerId);
        if (!pointers.size) finish(event.pointerId === gesture?.id ? point(event) : null);
      });
      const cancelPointer = event => {
        if (!pointers.has(event.pointerId)) return;
        // Keep other pressed pointers blocked until their physical release.
        pointers.delete(event.pointerId);
        cancelGesture();
        suppressClick();
      };
      listen('pointercancel', cancelPointer);
      listen('lostpointercapture', cancelPointer);
    } else {
      // Older touch browsers retain the same single-gesture release rule.
      listen('touchstart', event => {
        if (!element.open) return;
        if (event.touches.length === 1 && !gesture && !touchSequenceBlocked) {
          const touch = event.touches[0];
          begin(touch.identifier, point(touch), event.target);
        } else if (event.touches.length > 1) {
          touchSequenceBlocked = true;
          cancelGesture();
          suppressClick();
        }
      }, {passive: true});
      listen('touchmove', event => {
        if (touchSequenceBlocked || !gesture) return;
        if (event.touches.length !== 1) {
          touchSequenceBlocked = true;
          cancelGesture();
          suppressClick();
          return;
        }
        const touch = Array.from(event.touches).find(item => item.identifier === gesture.id);
        if (touch && move(point(touch)) && event.cancelable) event.preventDefault();
      }, {passive: false});
      listen('touchend', event => {
        if (event.touches.length) return;
        if (touchSequenceBlocked) {
          touchSequenceBlocked = false;
          suppressClick();
          return;
        }
        const touch = Array.from(event.changedTouches).find(item => item.identifier === gesture?.id);
        finish(touch ? point(touch) : null);
      }, {passive: true});
      listen('touchcancel', event => {
        cancelGesture();
        suppressClick();
        touchSequenceBlocked = Boolean(event.touches.length);
      }, {passive: true});
    }
    return () => {
      reset();
      removers.forEach(remove => remove());
    };
  };
})();
