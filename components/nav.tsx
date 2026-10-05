'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  leads: <path d="M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0M12 7a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />,
  car: <path d="M5 16h14M3 16v-4l2-5h14l2 5v4a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1zM5 12h14" />,
  calendar: <path d="M4 6h16v15H4zM4 10h16M8 3v4M16 3v4" />,
};

export const NAV_ITEMS = [
  { href: '/', label: 'Resumen', icon: 'home' },
  { href: '/leads', label: 'Leads', icon: 'leads' },
  { href: '/vehicles', label: 'Autos', icon: 'car' },
  { href: '/calendar', label: 'Agenda', icon: 'calendar' },
] as const;

function Icon({ name }: { name: string }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export function Nav({ variant }: { variant: 'side' | 'bottom' }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <nav className={variant === 'side' ? 'nav' : 'bottom-nav'} aria-label="Principal">
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : undefined}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
