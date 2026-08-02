import { Waitlist } from '@clerk/nextjs';

export const metadata = { title: 'Join the Waitlist | BlockHelix' };

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function SignUpPage() {
  if (!CLERK_ENABLED) {
    return (
      <div className="flex justify-center py-24 text-sm text-gray-500">
        Authentication is not configured. Set the Clerk environment variables.
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center py-16 px-6">
      <p className="mb-8 text-sm text-gray-500 max-w-md text-center">
        We onboard in small batches. Join the waitlist and we will email you when the next batch opens.
      </p>
      <Waitlist />
    </div>
  );
}
