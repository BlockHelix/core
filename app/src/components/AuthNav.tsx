'use client';

import Link from 'next/link';
import { useAuth, UserButton } from '@clerk/nextjs';

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function AuthNav() {
  if (!CLERK_ENABLED) {
    return null;
  }
  return <AuthNavInner />;
}

function AuthNavInner() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="w-7 h-7" />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/sign-in"
          className="text-sm font-medium px-5 py-2 rounded-full border border-gray-300 text-gray-900 hover:border-gray-900 transition-colors duration-300"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="text-sm font-medium px-5 py-2 rounded-full bg-[#adffd9] text-gray-900 hover:bg-[#8ceec8] transition-colors duration-300"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/dashboard"
        className="text-sm font-medium px-5 py-2 rounded-full border border-gray-300 text-gray-900 hover:border-gray-900 transition-colors duration-300"
      >
        Dashboard
      </Link>
      <UserButton
        appearance={{
          elements: {
            userButtonAvatarBox: 'w-7 h-7 border border-gray-200',
          },
        }}
      />
    </div>
  );
}
