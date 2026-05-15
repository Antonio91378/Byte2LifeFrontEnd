import { useCallback, useRef, useState } from 'react';

/**
 * Returns width state + props for a drag-resize handle.
 * Place the handle on the LEFT edge of a right-anchored panel.
 * Dragging left ↔ widens the panel; dragging right ↔ narrows it.
 */
export function useResizablePanel(
  defaultWidth: number,
  minWidth = 240,
  maxWidth = 900,
) {
  const [width, setWidth] = useState(defaultWidth);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(defaultWidth);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;

      const onMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        // Panel is right-anchored → dragging left increases width
        const delta = startXRef.current - ev.clientX;
        setWidth(Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta)));
      };

      const onUp = () => {
        draggingRef.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [width, minWidth, maxWidth],
  );

  return { width, onMouseDown };
}
