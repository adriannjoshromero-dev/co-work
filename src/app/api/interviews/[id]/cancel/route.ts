import { requireUser, verifyMutationOrigin } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { cancelInterview } from "@/lib/interviews";
import { versionSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    await verifyMutationOrigin();
    const user = await requireUser("COORDINATOR");
    const { id } = await context.params;
    const { expectedVersion } = versionSchema.parse(await request.json());
    await cancelInterview(user, id, expectedVersion);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
