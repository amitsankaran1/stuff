import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { passphrase: { label: 'Passphrase', type: 'password' } },
      authorize: (credentials) => {
        const expected = process.env.AUTH_PASSPHRASE ?? '';
        const pass = typeof credentials?.passphrase === 'string' ? credentials.passphrase : '';
        if (!expected || !pass) return null;
        if (!constantTimeEqual(pass, expected)) return null;
        return { id: 'me', name: 'Amit', email: 'sankaran.amit@gmail.com' };
      },
    }),
  ],
});
