import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { scrollElementIntoView } from '../utils/reducedMotion';

interface ModalErrorMessageProps {
  message?: string | null;
  position?: 'top' | 'bottom';
  style?: CSSProperties;
  className?: string;
  scrollKey?: string | number;
}

export function useModalErrorState(initialMessage: string | null = null) {
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [scrollKey, setScrollKey] = useState(0);

  const report = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
    setScrollKey((prev) => prev + 1);
  }, []);

  const clear = useCallback(() => {
    setMessage(null);
  }, []);

  const set = useCallback((nextMessage: string | null) => {
    setMessage(nextMessage);
    if (nextMessage) {
      setScrollKey((prev) => prev + 1);
    }
  }, []);

  return {
    message,
    scrollKey,
    report,
    clear,
    set,
  };
}

const BASE_STYLE: CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(239, 68, 68, 0.12)',
  border: '1px solid rgba(239, 68, 68, 0.24)',
  borderRadius: 8,
  color: '#ef4444',
  fontSize: 13,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

export function ModalErrorMessage({
  message,
  position = 'top',
  style,
  className,
  scrollKey,
}: ModalErrorMessageProps) {
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!message) return;
    const node = errorRef.current;
    if (!node) return;

    const frame = window.requestAnimationFrame(() => {
      scrollElementIntoView(node, {
        block: position === 'bottom' ? 'end' : 'start',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [message, position, scrollKey]);

  if (!message) {
    return null;
  }

  const spacingStyle: CSSProperties =
    position === 'bottom'
      ? { marginTop: 12, marginBottom: 12 }
      : { marginBottom: 12 };

  return (
    <div
      ref={errorRef}
      role="alert"
      aria-live="assertive"
      className={className}
      style={{ ...BASE_STYLE, ...spacingStyle, ...style }}
    >
      {message}
    </div>
  );
}
