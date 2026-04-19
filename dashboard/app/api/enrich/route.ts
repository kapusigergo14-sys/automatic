import { NextResponse } from 'next/server';
import { enrichWebsite } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ ok: false, error: 'missing ?url' }, { status: 400 });
  const data = await enrichWebsite(url);
  return NextResponse.json(data);
}
