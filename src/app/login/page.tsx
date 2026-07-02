import { login } from '@/core/auth/actions';
import { PulseMark } from '@/core/ui/PulseMark';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form action={login} className="w-full max-w-sm space-y-4">
        <div>
          <PulseMark className="h-6 w-11 text-flood" />
          <h1 className="mt-3 font-display text-4xl font-semibold uppercase leading-none tracking-tight">
            Athlete OS
          </h1>
          <p className="mt-2 font-display text-sm font-semibold uppercase tracking-[0.22em] text-dim">
            Entrená · Registrá · Entendé
          </p>
        </div>
        {error ? (
          <p className="rounded-lg border border-high/40 bg-high/10 p-3 text-sm text-chalk">
            Credenciales inválidas. Probá de nuevo.
          </p>
        ) : null}
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          autoComplete="email"
          className="w-full rounded-lg border border-line bg-turf-2 p-3.5 text-chalk outline-none placeholder:text-faint focus:border-flood"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Contraseña"
          autoComplete="current-password"
          className="w-full rounded-lg border border-line bg-turf-2 p-3.5 text-chalk outline-none placeholder:text-faint focus:border-flood"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-flood p-3.5 font-semibold text-pitch active:brightness-90"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
