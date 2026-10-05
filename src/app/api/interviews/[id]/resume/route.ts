import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { getResumeUrl } from "@/lib/interviews";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const url = await getResumeUrl(user.workspaceId, id);
    return Response.redirect(url, 302);
  } catch (error) {
    return errorResponse(error);
  }
}
