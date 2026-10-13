/** GET /admin/reports/export?range=30 : see the controller. */
import { exportReport } from '@/controllers/admin/reports';

export const dynamic = 'force-dynamic';

export const GET = exportReport;
