import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { Resend } from 'resend';

const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || '07aff369-83ab-4f3b-9788-1df41d0da8f2';

// Clerk -> Resend: add every new signup's email to the audience.
// Configure the endpoint in the Clerk dashboard (Webhooks -> user.created) and set
// CLERK_WEBHOOK_SIGNING_SECRET. Verification fails closed if the secret is unset.
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  if (evt.type === 'user.created') {
    const email =
      evt.data.email_addresses?.find((e) => e.id === evt.data.primary_email_address_id)
        ?.email_address ?? evt.data.email_addresses?.[0]?.email_address;
    const apiKey = process.env.RESEND_API_KEY;
    if (email && apiKey) {
      try {
        await new Resend(apiKey).contacts.create({
          email,
          audienceId: AUDIENCE_ID,
          unsubscribed: false,
        });
      } catch (err) {
        // Don't fail the webhook on a Resend hiccup — Clerk retries, and a duplicate
        // contact is harmless. Log for visibility.
        console.error('[clerk-webhook] resend contact create failed', err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
