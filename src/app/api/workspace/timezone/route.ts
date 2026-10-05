import { requireUser, verifyMutationOrigin } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { updateWorkspaceTimezone } from "@/lib/interviews";
import { timezoneSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  try {
    await verifyMutationOrigin();
    const user = await requireUser("COORDINATOR");
    const { timezone } = timezoneSchema.parse(await request.json());
    await updateWorkspaceTimezone(user, timezone);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
