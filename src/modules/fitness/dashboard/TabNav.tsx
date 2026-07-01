import Link from 'next/link';

export function TabNav({ active }: { active: 'today' | 'trends' }) {
  const tab = (href: string, key: 'today' | 'trends', label: string) => (
    <Link
      href={href}
      className={`flex-1 rounded-full py-2 text-center text-sm font-medium ${
        active === key ? 'bg-zinc-900 text-white' : 'text-zinc-500'
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav className="flex gap-1 rounded-full bg-zinc-100 p-1">
      {tab('/', 'today', 'Hoy')}
      {tab('/trends', 'trends', 'Tendencias')}
    </nav>
  );
}
