import type { ReactNode } from 'react';
import type { StatusBannerModel } from './orderDetailModel';

interface Props {
  banner: StatusBannerModel;
  /** Extra lines under the main message, such as polling progress or a check result. */
  notes?: Array<string | null>;
  /** Controls shown beside the message, such as the manual check button. */
  children?: ReactNode;
}

export function OrderStatusBanner({ banner, notes = [], children }: Props) {
  const lines = notes.filter((note): note is string => note !== null && note !== '');

  return (
    <div className={`banner banner-${banner.tone} no-print`} role="status" data-kind={banner.kind}>
      <div>
        <p>{banner.message}</p>
        {lines.map((line) => (
          <p className="banner-meta" key={line}>
            {line}
          </p>
        ))}
      </div>
      {children}
    </div>
  );
}
