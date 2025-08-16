"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  // make sure we're on the client before touching localStorage
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    setReady(true);
    try {
      setUid(localStorage.getItem("cenizo_user"));
    } catch {}
  }, []);

  const signIn = () => {
    try {
      const id = crypto.randomUUID();
      localStorage.setItem("cenizo_user", id);
      window.location.href = "/inventory";
    } catch (e) {
      console.error(e);
      alert("Sign-in needs localStorage/cookies enabled.");
    }
  };

  const signOut = () => {
    try {
      localStorage.removeItem("cenizo_user");
      setUid(null);
    } catch {}
  };

  if (!ready) return null;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Cenizo Ops — {uid ? "Signed in" : "Sign in"}</h1>

      {!uid ? (
        <button
          onClick={signIn}
          className="mt-6 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Sign in
        </button>
      ) : (
        <>
          <p className="mt-2 text-sm text-gray-600">Welcome, {uid}</p>
          <div className="flex gap-3 mt-4">
            <Link href="/checklists">
              <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
                Open / Close Checklists
              </button>
            </Link>
            <Link href="/inventory">
              <button className="px-4 py-2 rounded bg-violet-600 text-white hover:bg-violet-700">
                Inventory
              </button>
            </Link>
            <button
              onClick={signOut}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </main>
  );
}
