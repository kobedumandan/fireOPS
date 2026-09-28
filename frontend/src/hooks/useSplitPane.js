import { useCallback, useRef, useState } from "react";

/**
 * Drag-to-resize for a "main + side panel" layout. The side panel's width is
 * the controlled value; the main area takes whatever is left (flex: 1). `side`
 * says which edge the panel sits on, so the drag direction comes out right.
 *
 * Returns the current width and props to spread on the handle (pointer drag,
 * arrow keys, double-click to reset). The handle must be a direct child of the
 * flex container, since that is what it measures to clamp the width.
 * The width is remembered per `storageKey` in this browser only.
 */
export default function useSplitPane({ storageKey, side = "right", initial = 380, min = 320, minMain = 420, gutter = 50 }) {
  // Moving the pointer toward the main area grows the side panel.
  const dir = side === "left" ? 1 : -1;
  const drag = useRef(null);
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      return saved > 0 ? saved : initial;
    } catch {
      return initial;
    }
  });

  // `total` is the flex container's width, read from the handle's parent.
  const clamp = useCallback(
    (w, total = Infinity) => {
      const max = Math.max(min, total - gutter - minMain);
      return Math.round(Math.min(Math.max(w, min), max));
    },
    [min, minMain, gutter]
  );

  const save = useCallback(
    (w) => {
      try {
        localStorage.setItem(storageKey, String(w));
      } catch {
        /* storage unavailable: the width just won't persist */
      }
    },
    [storageKey]
  );

  const handleProps = {
    role: "separator",
    "aria-orientation": "vertical",
    "aria-label": "Resize panels",
    "aria-valuenow": width,
    "aria-valuemin": min,
    tabIndex: 0,
    title: "Drag to resize · double-click to reset",
    onPointerDown(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, w: width, total: e.currentTarget.parentElement.clientWidth };
      document.body.classList.add("is-resizing-x");
    },
    onPointerMove(e) {
      if (!drag.current) return;
      setWidth(clamp(drag.current.w + dir * (e.clientX - drag.current.x), drag.current.total));
    },
    onPointerUp(e) {
      if (!drag.current) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      drag.current = null;
      document.body.classList.remove("is-resizing-x");
      setWidth((w) => {
        save(w);
        return w;
      });
    },
    onLostPointerCapture() {
      drag.current = null;
      document.body.classList.remove("is-resizing-x");
    },
    onDoubleClick() {
      setWidth(initial);
      save(initial);
    },
    onKeyDown(e) {
      const step = e.shiftKey ? 64 : 16;
      let next = null;
      if (e.key === "ArrowLeft") next = width - dir * step;
      else if (e.key === "ArrowRight") next = width + dir * step;
      else if (e.key === "Home") next = initial;
      if (next == null) return;
      e.preventDefault();
      const w = clamp(next, e.currentTarget.parentElement.clientWidth);
      setWidth(w);
      save(w);
    },
  };

  return { width, handleProps };
}
