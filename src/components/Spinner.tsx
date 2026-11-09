interface SpinnerProps {
  label?: string;
  small?: boolean;
}

export function Spinner({ label = 'Loading…', small = false }: SpinnerProps) {
  if (small) return <span className="spinner spinner-sm" aria-hidden="true" />;
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
