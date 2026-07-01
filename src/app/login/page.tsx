import { login } from '@/core/auth/actions';

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
          <h1 className="text-2xl font-semibold tracking-tight">Athlete OS</h1>
          <p className="mt-1 text-sm text-zinc-500">Entrená. Registrá. Entendé.</p>
        </div>
        {error ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Credenciales inválidas. Probá de nuevo.
          </p>
        ) : null}
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          autoComplete="email"
          className="w-full rounded-xl border border-zinc-300 bg-white p-3.5 outline-none focus:border-zinc-900"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Contraseña"
          autoComplete="current-password"
          className="w-full rounded-xl border border-zinc-300 bg-white p-3.5 outline-none focus:border-zinc-900"
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-zinc-900 p-3.5 font-medium text-white active:scale-[0.99]"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
