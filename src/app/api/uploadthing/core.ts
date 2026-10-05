import { requireUser } from "@/lib/auth";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

export const ourFileRouter = {
  resume: f({
    "application/pdf": { maxFileSize: "8MB", maxFileCount: 1, acl: "public-read" },
    "application/msword": { maxFileSize: "8MB", maxFileCount: 1, acl: "public-read" },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxFileSize: "8MB", maxFileCount: 1, acl: "public-read" },
  }, { awaitServerData: false })
    .middleware(async () => {
      try {
        const user = await requireUser("COORDINATOR");
        return { userId: user.id, workspaceId: user.workspaceId };
      } catch {
        throw new UploadThingError("Unauthorized");
      }
    })
    .onUploadComplete(async ({ file }) => ({
      key: file.key,
      url: file.ufsUrl,
      name: file.name,
      size: file.size,
      mimeType: file.type,
    })),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
