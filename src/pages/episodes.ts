import { baseLogger } from "../logger.ts";
import { getElementBySelector, getElementsBySelector, matchUrl } from "../utils.ts";
const modLogger = baseLogger.withTag("episodes");
export interface ApiEpisode {
  date: string;
  durationMinutes: number;
  episodeNumber: number;
  title: string;
}

// ブレイドとかはエピソード名が「第1話」みたいになってるので、番組表からエピソード名を取ってきて上書きする
async function replaceEpisodeNames() {
  const logger = modLogger.withTag("replaceEpisodeNames");
  logger.log("Setting up episode name replacement hook");
  const episodesContainer = getElementBySelector(
    "div:has(#tracking-content-id) > .pb-12 > .px-6 div.grid-cols-5",
  );
  const episodeNames = getElementsBySelector(
    ":scope > div > .font-semibold > .text-ttfc-white",
    episodesContainer,
  );

  if (episodeNames.some((name) => !name.textContent?.trim().match(/^第[0-9]+話$/))) {
    logger.log("Episode names are already present, skipping hook setup");
    return;
  }

  logger.log("Episode names are missing, replacing with API data");

  const contentTitle = getElementBySelector("#tracking-content-title").getAttribute("value");
  const episodes = await fetch(
    `https://better-ttfc-api.sevenc7c.workers.dev/episodes?name=${encodeURIComponent(contentTitle ?? "")}`,
  );
  if (!episodes.ok) {
    logger.warn(
      `Failed to fetch episode names from API: ${episodes.status} ${episodes.statusText}, skipping replacement`,
    );
    return;
  }
  const episodesData = (await episodes.json()) as { episodes: ApiEpisode[] };
  for (const episodeNameElement of episodeNames) {
    const text = episodeNameElement.textContent?.trim();
    if (!text || !text.match(/^第[0-9]+話$/)) {
      continue;
    }
    const episodeNumberMatch = text.match(/^第([0-9]+)話$/);
    if (!episodeNumberMatch) {
      logger.warn(`Failed to parse episode number from text: "${text}", skipping element`);
      continue;
    }
    const episodeNumber = parseInt(episodeNumberMatch[1], 10);
    const apiEpisode = episodesData.episodes.find(
      (e: ApiEpisode) => e.episodeNumber === episodeNumber,
    );
    if (!apiEpisode) {
      logger.warn(
        `Could not find episode data for episode number ${episodeNumber}, skipping element`,
      );
      continue;
    }
    episodeNameElement.textContent = `第${apiEpisode.episodeNumber}話 ${apiEpisode.title}`;
    logger.log(
      `Replaced episode name for episode number ${episodeNumber} with title: "${apiEpisode.title}"`,
    );

    const hoverEpiosdeNameElement = episodeNameElement.parentElement?.parentElement?.querySelector(
      ".pointer-events-none > .text-ttfc-white",
    );
    if (hoverEpiosdeNameElement) {
      hoverEpiosdeNameElement.textContent = `第${apiEpisode.episodeNumber}話 ${apiEpisode.title}`;
      logger.log(
        `Also replaced hover episode name for episode number ${episodeNumber} with title: "${apiEpisode.title}"`,
      );
    }
  }
}

export async function main(path: string): Promise<void> {
  if (!matchUrl(path, "/movies/*/movie-stories") && !matchUrl(path, "/movies/*/movie-stories/*")) {
    return;
  }
  await replaceEpisodeNames();
}
