import { destroySession, verifyMutationOrigin } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";

export async function POST() {
  try {
    await verifyMutationOrigin();
    await destroySession();
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
