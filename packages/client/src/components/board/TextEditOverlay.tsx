import { useEffect, useRef, useState } from 'react';
import type { BoardObject } from '@collabboard/shared';
import { worldToScreen } from '../../utils/coords';
import './TextEditOverlay.css';

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface TextEditOverlayProps {
  object: Extract<BoardObject, { type: 'text' | 'sticky' }>;
  viewport: Viewport;
  onChange: (text: string) => void;
  onClose: () => void;
}

export function TextEditOverlay({ object, viewport, onChange, onClose }: TextEditOverlayProps) {
  const [value, setValue] = useState(object.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  useEffect(() => {
    // Flush any pending debounced edit if this unmounts without going through
    // commitAndClose (e.g. navigating away mid-edit) so keystrokes aren't lost.
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        onChangeRef.current(valueRef.current);
      }
    };
  }, []);

  const screenPos = worldToScreen({ x: object.x, y: object.y }, viewport);
  const isSticky = object.type === 'sticky';

  function handleChange(text: string) {
    setValue(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(text), 200);
  }

  function commitAndClose() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange(value);
    onClose();
  }

  return (
    <textarea
      ref={textareaRef}
      className="text-edit-overlay"
      style={{
        left: screenPos.x,
        top: screenPos.y,
        width: object.width * viewport.scale,
        height: object.height * viewport.scale,
        fontSize: (isSticky ? 16 : object.fontSize) * viewport.scale,
        padding: isSticky ? 10 * viewport.scale : 0,
        background: isSticky ? object.color : 'transparent',
      }}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={commitAndClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') commitAndClose();
        if (e.key === 'Enter' && !e.shiftKey && !isSticky) {
          e.preventDefault();
          commitAndClose();
        }
      }}
    />
  );
}
