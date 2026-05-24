import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn, auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const session = await auth();
  if (session) redirect('/inbox');

  const params = await searchParams;
  const next = params.next ?? '/inbox';
  const error = params.error;

  async function signInAction(formData: FormData) {
    'use server';
    const passphrase = formData.get('passphrase');
    try {
      await signIn('credentials', { passphrase, redirectTo: next });
    } catch (err) {
      // signIn throws NEXT_REDIRECT on success — let that bubble. Only catch
      // AuthError (e.g. CredentialsSignin) and bounce back to /login with a
      // flag so the form can show a "wrong passphrase" message.
      if (err instanceof AuthError) {
        const params = new URLSearchParams({ error: '1' });
        if (next !== '/inbox') params.set('next', next);
        redirect(`/login?${params.toString()}`);
      }
      throw err;
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Stuff</h1>
        <p className="mt-1 text-sm text-[var(--stuff-muted)]">Sign in to continue.</p>
      </header>

      <form action={signInAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[var(--stuff-muted)]">Passphrase</span>
          <input
            name="passphrase"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            className="rounded-xl border border-[var(--stuff-border)] bg-transparent px-3 py-2 text-base outline-none focus:border-current"
          />
        </label>

        {error ? (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            Wrong passphrase.
          </p>
        ) : null}

        <button
          type="submit"
          className="rounded-xl bg-[var(--stuff-fg)] px-4 py-2.5 text-sm font-medium text-[var(--stuff-bg)]"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
