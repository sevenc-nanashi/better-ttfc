import { matchUrl } from "../utils.ts";
import { baseLogger } from "../logger.ts";
import { insertXhrHook } from "../xhrHook.ts";
import { z } from "zod";

const modLogger = baseLogger.withTag("pickup");

const contentSchema = z.object({
  content_id: z.number(),
  content_title: z.string(),
  thumbnail_url: z.string(),
});
const pickupContentSchema = z.object({
  pickup_name: z.string(),
  content_type: z.number(),
  total_count: z.number(),
  content_list: z.array(contentSchema),
});

const originalNumContentPerPage = 10;
const numContentPerPage = 50;

export async function main(path: string): Promise<boolean> {
  if (!matchUrl(path, "/pickup/[0-9]+")) {
    return false;
  }
  modLogger.log("Started");
  // await waitForLoad();
  modLogger.log("Page loaded, executing script...");

  insertXhrHook("pickup", (request) => {
    const url = new URL(request.url);
    if (
      request.method === "GET" &&
      url.pathname.startsWith("/api/pc/pickup_content")
    ) {
      return async () => {
        const params = new URLSearchParams(url.search);
        params.set("number", numContentPerPage.toString());
        const myRequest = new Request(
          `${url.pathname}?${params.toString()}`,
          request,
        );
        const response = await fetch(myRequest);
        if (!response.ok) {
          modLogger.warn(
            `Failed to fetch pickup content: ${response.status} ${response.statusText}`,
          );
          return response;
        }
        const data = pickupContentSchema.parse(await response.clone().json());

        const numPages = Math.ceil(data.total_count / numContentPerPage);
        return Response.json(
          {
            pickup_name: data.pickup_name,
            content_type: data.content_type,
            total_count: numPages * originalNumContentPerPage,
            content_list: data.content_list.map((content) => ({
              content_id: content.content_id,
              content_title: content.content_title,
              thumbnail_url: content.thumbnail_url,
            })),
          },
          {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
            },
          },
        );
      };
    }
  });

  return true;
}
