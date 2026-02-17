import { useId } from 'react';

export default function Tooltip({ children, label }) {
  const id = useId();
  const tid = `tooltip-${id}`;
  return (
    <span className="tooltip" tabIndex={0} aria-describedby={tid}>
      {children}
      <span id={tid} role="tooltip" className="tooltip-content">{label}</span>
    </span>
  );
}
