'use client';
import { Amplify } from 'aws-amplify';
import config from './aws-amplify-config';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentUser, fetchAuthSession, signInWithRedirect, signOut } from 'aws-amplify/auth';

Amplify.configure(config);

export default function Page() {
  const [username, setUsername] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try { await fetchAuthSession(); const u = await getCurrentUser(); setUsername(u.username); }
      catch { setUsername(null); } finally { setReady(true); }
    })();
  }, []);

  if (!ready) return <div className='p-6'>Loading…</div>;

  return (
    <div className='p-6 space-y-4'>
      {username ? (
        <>
          <h3 className='text-2xl font-semibold'>Cenizo Ops — Signed in</h3>
          <p>Welcome, {username}</p>
          <div className='flex flex-wrap gap-3 pt-2'>
            <Link href='/checklists' className='px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700'>Open / Close Checklists</Link>
            <Link href='/inventory' className='px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700'>Inventory</Link>
            <button className='px-4 py-2 rounded-xl border hover:bg-gray-50' onClick={() => signOut()}>Sign out</button>
          </div>
        </>
      ) : (
        <>
          <h3 className='text-2xl font-semibold'>Cenizo Ops</h3>
          <p>You&apos;re not signed in.</p>
          <button className='px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700' onClick={() => signInWithRedirect({ provider: 'COGNITO' })}>Sign in</button>
        </>
      )}
    </div>
  );
}
