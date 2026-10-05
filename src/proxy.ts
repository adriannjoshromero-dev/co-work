import { NextResponse, type NextRequest } from "next/server";

const SERVER_ACTION_ID_LENGTH = 42;

export function proxy(request: NextRequest) {
  const serverActionId = request.headers.get("next-action");

  if (request.method === "POST" && serverActionId && serverActionId.length !== SERVER_ACTION_ID_LENGTH) {
    return new NextResponse("Malformed Server Action request.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
