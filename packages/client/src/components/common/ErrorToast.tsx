import { useEffect } from 'react';
import './ErrorToast.css';

interface ErrorToastProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="error-toast">
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
