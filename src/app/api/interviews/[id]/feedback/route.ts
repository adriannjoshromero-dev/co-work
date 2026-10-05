import { requireUser, verifyMutationOrigin } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { saveFeedback } from "@/lib/interviews";
import { feedbackSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    await verifyMutationOrigin();
    const user = await requireUser("INTERVIEWER");
    const { id } = await context.params;
    const input = feedbackSchema.parse(await request.json());
    await saveFeedback(user, id, input.status, input.feedback, input.expectedVersion);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
