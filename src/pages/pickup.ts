import { insertXhrHook } from "@sevenc-nanashi/xhr-hook";
import { z } from "zod";
import { baseLogger } from "../logger.ts";
import {
  insertStyle,
  matchUrl,
  TeardownManager,
  waitForElementBySelector,
} from "../utils.ts";

const modLogger = baseLogger.withTag("pickup");

const teardowns = new TeardownManager(modLogger);

export async function insertBetterContentListStyle() {
  const clean = insertStyle(`
    .row:has(.card-flyer) {
      justify-content: center;
    }
    @media (min-width: 1400px) {
      .col-md-five-1:where(:has(.card-flyer), .bttfc-content-dummy) {
        flex-basis: 15% !important;
      }
    }
    @media (min-width: 1600px) {
      .col-md-five-1:where(:has(.card-flyer), .bttfc-content-dummy) {
        flex-basis: 12.5% !important;
      }
    }
    @media (min-width: 2000px) {
      .col-md-five-1:where(:has(.card-flyer), .bttfc-content-dummy) {
        flex-basis: 10% !important;
      }
    }
  `);
  const contentList = await waitForElementBySelector<HTMLDivElement>(
    ".row:has(.card-flyer)",
  );
  const elements: HTMLDivElement[] = [];
  for (let i = 0; i < 10; i++) {
    const dummy = document.createElement("div");
    dummy.className = "col-md-five-1 bttfc-content-dummy";
    elements.push(dummy);
    contentList.appendChild(dummy);
  }
  return () => {
    clean();
    for (const element of elements) {
      if (element.parentElement) {
        element.parentElement.removeChild(element);
      }
    }
    modLogger.log("Removed better content list style");
  };
}

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

function setupHook() {
  insertXhrHook("pickup", (request) => {
    const url = new URL(request.url);
    if (
      request.method === "GET" &&
      url.pathname.startsWith("/api/pc/pickup_content")
    ) {
      return async () => {
        return await handlePickupResponse(url, request);
      };
    }
  });
}

async function handlePickupResponse(
  url: URL,
  request: Request,
): Promise<Response> {
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
}

export async function main(path: string): Promise<(() => void) | undefined> {
  if (!matchUrl(path, "/pickup/[0-9]+")) {
    return undefined;
  }
  modLogger.log("Started");

  setupHook();
  teardowns.add(await insertBetterContentListStyle());

  return () => teardowns.clear();
}
