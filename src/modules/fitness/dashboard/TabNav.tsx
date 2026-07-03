import Link from 'next/link';

type Tab = 'today' | 'trends' | 'coach' | 'sources';

export function TabNav({ active }: { active: Tab }) {
  const tab = (href: string, key: Tab, label: string) => (
    <Link
      href={href}
      className={`flex-1 rounded-lg py-2 text-center font-display text-sm font-semibold uppercase tracking-[0.14em] transition-colors ${
        active === key
          ? 'bg-turf-2 text-chalk shadow-[inset_0_-2px_0_0_var(--color-flood)]'
          : 'text-faint active:text-dim'
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav className="flex gap-1 rounded-xl border border-line bg-turf p-1">
      {tab('/', 'today', 'Hoy')}
      {tab('/trends', 'trends', 'Tendencias')}
      {tab('/coach', 'coach', 'Coach')}
      {tab('/fuentes', 'sources', 'Fuentes')}
    </nav>
  );
}
