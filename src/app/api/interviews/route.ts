import { requireUser, verifyMutationOrigin } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { createInterview, listInterviews } from "@/lib/interviews";
import { cleanRichText, interviewInputSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ interviews: await listInterviews(user.workspaceId), user });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await verifyMutationOrigin();
    const user = await requireUser("COORDINATOR");
    const input = interviewInputSchema.parse(await request.json());
    await createInterview(user, { ...input, jobDescriptionHtml: cleanRichText(input.jobDescriptionHtml) });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
