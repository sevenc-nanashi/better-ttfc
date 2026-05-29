import { baseLogger } from "../logger.ts";
import {
  getElementBySelector,
  insertStyle,
  matchUrl,
  maybeGetElementBySelector,
} from "../utils.ts";
import van from "vanjs-core";
import type { ApiEpisode } from "./episodes.ts";

const { button, p, div } = van.tags;

const modLogger = baseLogger.withTag("watch");

function toggleFullscreen() {
  const mainElement = getElementBySelector("main");
  mainElement.classList.toggle("bttfc-using-browser-fullscreen-mode");
}

function addKeyboardShortcuts() {
  const logger = modLogger.withTag("addKeyboardShortcuts");
  logger.log("Adding keyboard shortcuts to video.js players");
  const moviePlayer = getElementBySelector<HTMLDivElement>("#player-wrapper");
  moviePlayer.addEventListener("keydown", onKeyDown);
  moviePlayer.setAttribute("tabindex", "0");

  function onKeyDown(event: KeyboardEvent) {
    const video = getElementBySelector<HTMLVideoElement>("#player-video_html5_api", moviePlayer);
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
  if (document.querySelector(".bttfc-browser-fullscreen-mode-button")) {
    // すでに追加されている場合は何もしない
    return;
  }
  const fullscreenBtn = maybeGetElementBySelector("#player-fullscreen-btn");
  if (!fullscreenBtn) {
    // 画質選択ボタンは非同期的に追加されるので、存在しない場合はスキップして次の変化を待つ
    return;
  }
  const controlBar = fullscreenBtn.parentElement;
  if (!controlBar) {
    logger.warn("Fullscreen button does not have a parent element, cannot add theater mode button");
    return;
  }
  const browserFullscreenModeButton = button(
    {
      type: "button",
      class: "transition-[opacity] relative group",
      id: "player-browser-fullscreen-btn",

      onclick: () => {
        toggleFullscreen();
      },
    },
    p(
      {
        id: "player-fullscreen-label",
        class:
          "opacity-0 group-hover:opacity-100 [.is-skip-visible_&]:!opacity-0 text-xs px-2 py-1 absolute top-[calc(100%+8px)] right-0 bg-ttfc-black/90 rounded-sm whitespace-nowrap duration-300 pointer-events-none",
      },
      "ブラウザ拡大",
    ),
    div(
      {
        type: "button",
        "aria-disabled": "false",
        title: "Toggle Browser Fullscreen Mode",
        class: "w-6 h-6 group-hover:opacity-60 duration-300",
      },
      div({ class: "vjs-icon-picture-in-picture-exit", style: "top: 6px; position: relative;" }),
    ),
  );
  controlBar.insertBefore(browserFullscreenModeButton, fullscreenBtn);

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

async function replaceTitle() {
  const logger = modLogger.withTag("replaceTitle");
  const playerSectionElement = getElementBySelector("div:has(#player-wrapper)");
  const originalTitleElement = getElementBySelector("h1.text-ttfc-white", playerSectionElement);
  const episodeNumberMatch = originalTitleElement.textContent?.trim().match(/^第([0-9]+)話$/);
  if (!episodeNumberMatch) {
    logger.info("Original title has proper episode name, skipping title replacement");
    return;
  }
  const episodeNumber = parseInt(episodeNumberMatch[1], 10);
  const seriesTitleElement = getElementBySelector("#tracking-content-title");
  const seriesTitle = seriesTitleElement.getAttribute("value") ?? "";
  const response = await fetch(
    `https://t-two-f-c-api.sevenc7c.workers.dev/episodes?name=${encodeURIComponent(seriesTitle)}`,
  );
  if (!response.ok) {
    logger.warn(
      `Failed to fetch episode names from API: ${response.status} ${response.statusText}, skipping title replacement`,
    );
    return;
  }
  const episodesData = (await response.json()) as { episodes: ApiEpisode[] };
  const episodeData = episodesData.episodes.find(
    (e: ApiEpisode) => e.episodeNumber === episodeNumber,
  );
  if (!episodeData) {
    logger.warn(
      `Could not find episode data for episode number ${episodeNumber}, skipping title replacement`,
    );
    return;
  }
  originalTitleElement.textContent = `第${episodeData.episodeNumber}話 ${episodeData.title}`;
  logger.log(`Replaced title with episode name: "${episodeData.title}"`);
}

export async function main(path: string): Promise<void> {
  if (!matchUrl(path, "/movies/*/movie-stories/*")) {
    return;
  }
  addKeyboardShortcuts();
  addBrowserFullscreenModeLoop();
  void replaceTitle();

  insertStyle(`
    .bttfc-using-browser-fullscreen-mode #player-wrapper {
      background: #000;
      position:fixed !important;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index:999;
    }
  `);
}
