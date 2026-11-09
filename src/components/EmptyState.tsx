import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children && <div className="empty-state-body">{children}</div>}
    </div>
  );
}
