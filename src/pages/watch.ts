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
