'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';

// A link that reveals extra content on click.
export function MoreOptions({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  function toggle(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setOpen((current) => !current);
  }

  return (
    <div className="more-options">
      <a href="#" onClick={toggle}>
        {label}
      </a>
      {open && children}
    </div>
  );
}
