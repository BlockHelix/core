import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const audienceId = process.env.RESEND_AUDIENCE_ID || '07aff369-83ab-4f3b-9788-1df41d0da8f2';

  const { error } = await resend.contacts.create({ email, audienceId });
  if (error) {
    console.error('[waitlist] contact', error);
    return NextResponse.json({ error: 'Failed to register' }, { status: 502 });
  }

  resend.emails
    .send({
      from: 'BlockHelix Waitlist <onboarding@resend.dev>',
      to: 'will@defidata.dev',
      subject: 'New waitlist signup',
      text: `New BlockHelix waitlist signup: ${email}`,
    })
    .catch((err) => console.error('[waitlist] notify', err));

  return NextResponse.json({ ok: true });
}
