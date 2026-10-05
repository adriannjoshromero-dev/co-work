import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { getResumeKey } from "@/lib/interviews";
import { UTApi } from "uploadthing/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const key = await getResumeKey(user.workspaceId, id);
    const { ufsUrl } = await new UTApi().generateSignedURL(key, { expiresIn: "5 minutes" });
    return Response.redirect(ufsUrl, 302);
  } catch (error) {
    return errorResponse(error);
  }
}
