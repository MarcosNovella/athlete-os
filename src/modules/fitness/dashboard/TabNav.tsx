import Link from 'next/link';

type Tab = 'today' | 'trends' | 'coach';

export function TabNav({ active }: { active: Tab }) {
  const tab = (href: string, key: Tab, label: string) => (
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
      {tab('/coach', 'coach', 'Coach')}
    </nav>
  );
}
