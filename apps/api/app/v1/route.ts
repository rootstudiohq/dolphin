import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    '🐬': 'Eekaroo, chik-chik, wee-woo',
  });
}
