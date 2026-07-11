import { Waitlist } from '@clerk/nextjs';

export const metadata = { title: 'Join the Waitlist | BlockHelix' };

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function WaitlistPage() {
  if (!CLERK_ENABLED) {
    return (
      <div className="flex justify-center py-24 text-sm text-white/60">
        Authentication is not configured. Set the Clerk environment variables.
      </div>
    );
  }
  return (
    <div className="flex justify-center py-16 px-6">
      <Waitlist />
    </div>
  );
}
