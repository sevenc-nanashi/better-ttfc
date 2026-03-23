import { insertXhrHook } from "@sevenc-nanashi/xhr-hook";
import { baseLogger } from "../logger.ts";
import {
  getElementBySelector,
  insertStyle,
  isChildrenOf,
  matchUrl,
  maybeGetElementBySelector,
  TeardownManager,
} from "../utils.ts";
import { insertBetterContentListStyle } from "./pickup.ts";
import van from "vanjs-core";

const { button, span } = van.tags;

const modLogger = baseLogger.withTag("watch");

const watchedKey = "bttfcWatched";

const teardowns = new TeardownManager(modLogger);

function toggleFullscreen() {
  const mainElement = getElementBySelector("main");
  mainElement.classList.toggle("bttfc-using-browser-fullscreen-mode");
}

const originalSessionStorageSetItem = sessionStorage.setItem.bind(sessionStorage);
function setupTeeWatchData() {
  const logger = modLogger.withTag("setupTeeWatchData");
  if (sessionStorage.bttfcHooked) {
    logger.warn("SessionStorage is already hooked, skipping.");
    return;
  }

  logger.log("Setting up watch data interception");
  Object.getPrototypeOf(sessionStorage).setItem = new Proxy(
    Object.getPrototypeOf(sessionStorage).setItem,
    {
      apply: (target, thisArg, args) => {
        if (thisArg !== sessionStorage) {
          return Reflect.apply(target, thisArg, args);
        }
        const [key, value] = args;
        if (key === "watched") {
          logger.log("Intercepted sessionStorage setItem for watched data");
          localStorage.setItem(watchedKey, value);
        }

        return Reflect.apply(target, thisArg, args);
      },
    },
  );
  Object.getPrototypeOf(sessionStorage).bttfcHooked = true;
}
function loadWatchData() {
  const logger = modLogger.withTag("loadWatchData");
  const watched = localStorage.getItem(watchedKey);
  if (!watched) {
    logger.warn("No watched data found in localStorage");
    return;
  }

  logger.log("Loading watched data from localStorage");
  originalSessionStorageSetItem("watched", watched);
}

function addKeyboardShortcuts() {
  const logger = modLogger.withTag("addKeyboardShortcuts");
  logger.log("Adding keyboard shortcuts to video.js players");
  document.addEventListener("keydown", onKeyDown, true);

  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
  };

  function onKeyDown(event: KeyboardEvent) {
    const moviePlayer = maybeGetElementBySelector("#movie-player");
    if (!moviePlayer) {
      return;
    }
    if (!isChildrenOf(event.target as Node, moviePlayer)) {
      return;
    }
    const video = getElementBySelector<HTMLVideoElement>("#movie-player_html5_api", moviePlayer);
    if (event.code === "ArrowRight") {
      logger.log("Seeking forward 10 seconds");
      event.preventDefault();
      video.currentTime += 10;
    } else if (event.code === "ArrowLeft") {
      logger.log("Seeking backward 10 seconds");
      event.preventDefault();
      video.currentTime -= 10;
    } else if (event.code === "ArrowUp") {
      logger.log("Increasing volume by 10%");
      event.preventDefault();
      video.volume = Math.min(video.volume + 0.1, 1);
    } else if (event.code === "ArrowDown") {
      logger.log("Decreasing volume by 10%");
      event.preventDefault();
      video.volume = Math.max(video.volume - 0.1, 0);
    } else if (event.code === "Space") {
      logger.log("Toggling play/pause");
      event.preventDefault();
      if (video.paused) {
        void video.play();
      } else {
        video.pause();
      }
    } else if (event.code === "KeyF") {
      logger.log("Toggling fullscreen");
      event.preventDefault();
      const fullscreenElement = getElementBySelector<HTMLButtonElement>(".vjs-fullscreen-control");
      fullscreenElement.click();
    } else if (event.code === "KeyT") {
      logger.log("Toggling browser fullscreen mode");
      event.preventDefault();
      toggleFullscreen();
    } else if (event.code === "KeyM") {
      logger.log("Toggling mute");
      event.preventDefault();
      const muteElement = getElementBySelector<HTMLButtonElement>(".vjs-mute-control");
      muteElement.click();
    }
  }
}

function addTheaterModeButton() {
  const logger = modLogger.withTag("addTheaterModeButton");
  const controlBar = maybeGetElementBySelector(
    ".vjs-control-bar:not(.bttfc-browser-fullscreen-mode-button)",
  );
  if (!controlBar) {
    return;
  }
  const qualitySelector = maybeGetElementBySelector(".vjs-quality-selector");
  if (!qualitySelector) {
    // 画質選択ボタンは非同期的に追加されるので、存在しない場合はスキップして次の変化を待つ
    return;
  }
  const browserFullscreenModeButton = button(
    {
      class: "vjs-icon-picture-in-picture-exit vjs-control vjs-button",
      type: "button",
      "aria-disabled": "false",
      title: "Toggle Browser Fullscreen Mode",
      onclick: () => {
        logger.log("Toggling browser fullscreen mode");
        toggleFullscreen();
      },
    },
    span({ class: "vjs-icon-placeholder", "aria-hidden": "true" }),
    span({ class: "vjs-control-text", "aria-live": "polite" }, "Theater Mode"),
  );
  controlBar.insertBefore(browserFullscreenModeButton, qualitySelector.nextSibling);

  controlBar.classList.add("bttfc-browser-fullscreen-mode-button");
  logger.log("Added browser fullscreen mode button to control bar");
}

function addBrowserFullscreenModeLoop() {
  const observer = new MutationObserver(() => {
    addTheaterModeButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
  };
}

export async function main(path: string): Promise<(() => void) | undefined> {
  if (!matchUrl(path, "/contents")) {
    return undefined;
  }
  loadWatchData();
  setupTeeWatchData();
  teardowns.add(await insertBetterContentListStyle());
  teardowns.add(addKeyboardShortcuts());
  teardowns.add(addBrowserFullscreenModeLoop());
  teardowns.add(
    insertStyle(`
      .bttfc-using-browser-fullscreen-mode #video-wrapper {
        background: #000;
        position:fixed !important;
        inset: 0;
        z-index:999;
      }
    `),
  );

  return () => teardowns.clear();
}

// ブレイドとかはエピソード名が「第1話」みたいになってるので、番組表からエピソード名を取ってきて上書きする
function setupEpisodeNameHook() {
  interface ContentEpisodeResponse {
    production_id: number;
    production_title: string;
    content_id: number;
    content_type: number;
    content_title: string;
    thumbnail_url: string;
    copyright: string;
    episode_count: number;
    episode_list: TtfcEpisode[];
  }

  interface TtfcEpisode {
    episode_id: number;
    thumbnail_url: string;
    episode_title: string;
    playback_status: number;
    purchased_flag: boolean;
    billing_required_flag: boolean;
    age_limit: string;
    original_age_limit: string;
  }

  interface ApiEpisode {
    date: string;
    durationMinutes: number;
    episodeNumber: number;
    title: string;
  }

  const logger = modLogger.withTag("setupEpisodeNameHook");
  insertXhrHook("watch-episode-name", (request) => {
    // https://pc.tokusatsu-fc.jp/api/pc/content_episode?content_id=1778&content_type=0
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/pc/content_episode") {
      return async () => {
        logger.log("Intercepted content_episode API request, checking for missing episode names");
        // NOTE: 空白が入っているのは仕様
        const missingEpisodeNamePattern = /^第[0-9]+話  $/;
        const response = await fetch(request);
        if (!response.ok) {
          logger.warn(`Failed to fetch episode data: ${response.status} ${response.statusText}`);
          return response;
        }
        const data = (await response.json()) as ContentEpisodeResponse;

        const isMissingEpisodeNames = data.episode_list.some((episode) =>
          episode.episode_title.match(missingEpisodeNamePattern),
        );
        if (!isMissingEpisodeNames) {
          logger.log("Episode names are already present, skipping");
          return Response.json(data);
        }
        logger.log("Missing episode names detected, fetching from API");

        const episodes = await fetch(
          `https://better-ttfc-api.sevenc7c.workers.dev/episodes?name=${encodeURIComponent(
            data.content_title,
          )}`,
        );

        if (!episodes.ok) {
          logger.warn(
            `Failed to fetch episode names from API: ${episodes.status} ${episodes.statusText}`,
          );
          return Response.json(data);
        }

        logger.log("Fetched episode names from API, replacing missing episode titles");
        const episodesData = (await episodes.json()) as { episodes: ApiEpisode[] };
        for (const [i, episode] of data.episode_list.entries()) {
          if (!episode.episode_title.match(missingEpisodeNamePattern)) {
            continue;
          }
          const title = episode.episode_title;
          const apiEpisode = episodesData.episodes.find(
            (e: ApiEpisode) => e.episodeNumber === i + 1,
          );

          if (apiEpisode) {
            episode.episode_title = `第${apiEpisode.episodeNumber}話 ${apiEpisode.title}`;
            logger.log(`Replaced episode title "${title}" with "${apiEpisode.title}"`);
          } else {
            logger.warn(`Could not find episode title for episode number ${i + 1} (${title})`);
          }
        }

        return Response.json(data);
      };
    }
  });
}

setupEpisodeNameHook();
