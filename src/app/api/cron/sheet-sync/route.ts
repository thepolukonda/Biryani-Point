/** GET/POST /api/cron/sheet-sync: see the controller. */
import { runScheduledJob } from '@/controllers/api/cron';

export const dynamic = 'force-dynamic';

export const GET = runScheduledJob;
export const POST = runScheduledJob;
