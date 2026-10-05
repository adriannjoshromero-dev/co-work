import { requireUser, verifyMutationOrigin } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { deleteInterview, updateInterview } from "@/lib/interviews";
import { cleanRichText, interviewInputSchema, versionSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await verifyMutationOrigin();
    const user = await requireUser("COORDINATOR");
    const { id } = await context.params;
    const input = interviewInputSchema.extend({ expectedVersion: versionSchema.shape.expectedVersion }).parse(await request.json());
    await updateInterview(user, id, { ...input, jobDescriptionHtml: cleanRichText(input.jobDescriptionHtml) });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await verifyMutationOrigin();
    const user = await requireUser("COORDINATOR");
    const { id } = await context.params;
    const input = versionSchema.parse(await request.json());
    await deleteInterview(user, id, input.expectedVersion);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
