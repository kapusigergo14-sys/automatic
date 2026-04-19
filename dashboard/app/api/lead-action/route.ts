import { NextResponse } from 'next/server';
import { moveLead, blockLead, type Industry } from '@/lib/data';

export const dynamic = 'force-dynamic';

const INDUSTRIES: Industry[] = ['dentist', 'lawyer', 'plumber', 'hvac'];
const isIndustry = (v: unknown): v is Industry => typeof v === 'string' && (INDUSTRIES as string[]).includes(v);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });

  const { action, email } = body as { action?: string; email?: string };
  if (typeof email !== 'string' || !email) {
    return NextResponse.json({ ok: false, error: 'missing email' }, { status: 400 });
  }

  if (action === 'move') {
    const { from, to } = body as { from?: string; to?: string };
    if (!isIndustry(from) || !isIndustry(to)) {
      return NextResponse.json({ ok: false, error: 'invalid industry' }, { status: 400 });
    }
    const res = await moveLead(email, from, to);
    return NextResponse.json(res);
  }

  if (action === 'block') {
    const { industry } = body as { industry?: string };
    if (!isIndustry(industry)) {
      return NextResponse.json({ ok: false, error: 'invalid industry' }, { status: 400 });
    }
    const res = await blockLead(email, industry);
    return NextResponse.json(res);
  }

  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
}
