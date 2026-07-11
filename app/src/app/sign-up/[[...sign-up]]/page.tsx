import { SignUp } from '@clerk/nextjs';

export const metadata = { title: 'Sign Up | BlockHelix' };

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function SignUpPage() {
  if (!CLERK_ENABLED) {
    return (
      <div className="flex justify-center py-24 text-sm text-white/60">
        Authentication is not configured. Set the Clerk environment variables.
      </div>
    );
  }
  return (
    <div className="flex justify-center py-16 px-6">
      <SignUp />
    </div>
  );
}
