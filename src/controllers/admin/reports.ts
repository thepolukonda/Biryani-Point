/** Controller for GET /admin/reports/export?range=30 : orders as CSV (owner only). */
import 'server-only';
import { NextResponse } from 'next/server';
import { reportCsv } from '@/model-helpers/reports/report-data';
import { currentStaff } from './guard';

export async function exportReport(request: Request) {
  const user = await currentStaff();
  if (!user || user.role !== 'owner')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const range = new URL(request.url).searchParams.get('range') ?? undefined;
  const { csv, fileName } = await reportCsv(range);
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'no-store',
    },
  });
}
