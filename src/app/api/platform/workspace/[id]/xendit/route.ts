// POST /api/platform/workspace/[id]/xendit { akunId: string | null, alasan } — platform admin
// menyambungkan kos ke sub-akun xenPlatform-nya (atau melepasnya). Menentukan ke mana uang penyewa
// masuk, jadi wajib alasan dan tercatat di platform_admin_logs (akun lama → baru).

import { getDb } from "@/db";
import { bacaJson, responGalat } from "@/lib/aksi/galat";
import { pastikanPlatformAdminApi } from "@/lib/data/platform";
import { aturAkunXendit, bacaInputXendit } from "@/lib/platform/konsol";

export async function POST(request: Request, ctx: RouteContext<"/api/platform/workspace/[id]/xendit">) {
  try {
    const adminUserId = await pastikanPlatformAdminApi();
    const { id } = await ctx.params;
    const input = bacaInputXendit(await bacaJson(request));
    return Response.json(await aturAkunXendit(await getDb(), { organizationId: id, adminUserId, ...input }));
  } catch (err) {
    return responGalat(err);
  }
}
