// POST /api/platform/workspace/[id]/pilot { aktif: boolean, alasan } — platform admin menyuspend atau
// mengaktifkan kembali pilot Kosta satu kos. Hanya status pilot yang berubah (bukan data kos), tercatat
// di platform_admin_logs, dan owner melihat statusnya di dashboard.

import { getDb } from "@/db";
import { bacaJson, responGalat } from "@/lib/aksi/galat";
import { pastikanPlatformAdminApi } from "@/lib/data/platform";
import { aturPilotKosta, bacaInputPilot } from "@/lib/platform/konsol";

export async function POST(request: Request, ctx: RouteContext<"/api/platform/workspace/[id]/pilot">) {
  try {
    const adminUserId = await pastikanPlatformAdminApi();
    const { id } = await ctx.params;
    const input = bacaInputPilot(await bacaJson(request));
    return Response.json(await aturPilotKosta(await getDb(), { organizationId: id, adminUserId, ...input }));
  } catch (err) {
    return responGalat(err);
  }
}
