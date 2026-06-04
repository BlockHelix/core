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
  const { error } = await resend.emails.send({
    from: 'BlockHelix Waitlist <onboarding@resend.dev>',
    to: 'wmrs.work@gmail.com',
    subject: 'New waitlist signup',
    text: `New BlockHelix waitlist signup: ${email}`,
  });

  if (error) {
    console.error('[waitlist]', error);
    return NextResponse.json({ error: 'Failed to register' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
