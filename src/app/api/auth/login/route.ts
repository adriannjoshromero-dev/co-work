import { authenticate, createSession, verifyMutationOrigin } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await verifyMutationOrigin();
    const input = loginSchema.parse(await request.json());
    const userId = await authenticate(input.username, input.password);
    await createSession(userId);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
