import { DOMParser, HTMLAnchorElement, HTMLTableCellElement, HTMLTableElement } from "linkedom";
import { UnreachableError } from "./error";

const userAgent =
  "better-ttfc API/0.0.0 (https://github.com/sevenc-nanashi/better-ttfc/tree/main/api)";

export async function findProgramId(name: string): Promise<string | null> {
  const url = `https://cal.syoboi.jp/find?kw=${encodeURIComponent(name)}&exec=%E6%A4%9C%E7%B4%A2`;
  const contents = await fetch(url, {
    cf: {
      cacheTtl: 3600,
    },
    headers: {
      "User-Agent": userAgent,
    },
  }).then((res) => res.text());
  const parser = new DOMParser();
  const doc = parser.parseFromString(contents, "text/html");
  const mainTable: HTMLTableElement = doc.querySelector(".tframe");
  if (!mainTable) {
    return null;
  }

  const allLinks: HTMLAnchorElement[] = mainTable.querySelectorAll("a");
  const programs = allLinks.filter((a) => a.getAttribute("href")?.startsWith("/tid/"));
  const program = programs[programs.length - 1];
  if (!program) {
    return null;
  }
  const href = program.getAttribute("href");
  if (!href) {
    throw new UnreachableError("Program link does not have href attribute");
  }
  const match = href.match(/\/tid\/(\d+)/);
  if (!match) {
    return null;
  }
  return match[1];
}

export type Episode = {
  date: string; // ISO 8601 format
  durationMinutes: number;
  episodeNumber: number;
  title: string;
};

export async function fetchEpisodes(programId: string): Promise<Episode[]> {
  // https://cal.syoboi.jp/tid/341/time
  const url = `https://cal.syoboi.jp/tid/${programId}/time`;
  const contents = await fetch(url, {
    cf: {
      cacheTtl: 3600,
    },
    headers: {
      "User-Agent": userAgent,
    },
  }).then((res) => res.text());
  const parser = new DOMParser();
  const doc = parser.parseFromString(contents, "text/html");
  const tbody: HTMLTableElement = doc.querySelector("#ProgList");
  if (!tbody) {
    return [];
  }
  const trs = tbody.querySelectorAll("tr");
  const episodes: Episode[] = [];
  for (const tr of trs) {
    const tds: HTMLTableCellElement[] = tr.querySelectorAll("td");
    if (tds.length < 8) {
      continue;
    }
    const channel = tds[0].textContent?.trim() || "";
    if (channel !== "テレビ朝日") {
      // テレ朝以外は除外
      continue;
    }

    const rawDate = tds[1].textContent?.trim() || "";
    // 2004-03-07(日)  8:00
    const dateMatch = rawDate.match(/(\d{4}-\d{2}-\d{2})\(.+\)\s+(\d{1,2}:\d{2})/);
    if (!dateMatch) {
      continue;
    }
    const date = `${dateMatch[1]}T${dateMatch[2]}:00+09:00`;

    const rawDuration = tds[2].textContent?.trim() || "";
    const durationMinutes = parseInt(rawDuration, 10);
    const rawEpisodeNumber = tds[3].textContent?.trim() || "";
    const episodeNumber = parseInt(rawEpisodeNumber, 10);
    const title = tds[4].childNodes[0]?.textContent?.trim() || "";

    episodes.push({
      date,
      durationMinutes,
      episodeNumber,
      title,
    });
  }

  return episodes;
}
