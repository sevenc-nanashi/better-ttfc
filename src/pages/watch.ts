import { baseLogger } from "../logger.ts";
import {
  getElementBySelector,
  isChildrenOf,
  matchUrl,
  maybeGetElementBySelector,
  TeardownManager,
} from "../utils.ts";
import { insertBetterContentListStyle } from "./pickup.ts";

const modLogger = baseLogger.withTag("watch");

const watchedKey = "bttfcWatched";

const teardowns = new TeardownManager(modLogger);

const originalSessionStorageSetItem =
  sessionStorage.setItem.bind(sessionStorage);
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
    const video = getElementBySelector<HTMLVideoElement>(
      "#movie-player_html5_api",
      moviePlayer,
    );
    if (event.code === "ArrowRight") {
      logger.log("Seeking forward 10 seconds");
      event.preventDefault();
      video.currentTime += 10;
    } else if (event.code === "ArrowLeft") {
      logger.log("Seeking backward 10 seconds");
      event.preventDefault();
      video.currentTime -= 10;
    } else if (event.code === "Space") {
      logger.log("Toggling play/pause");
      event.preventDefault();
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    } else if (event.code === "KeyF") {
      logger.log("Toggling fullscreen");
      event.preventDefault();
      const fullscreenElement = getElementBySelector<HTMLButtonElement>(
        ".vjs-fullscreen-control",
      );
      fullscreenElement.click();
    } else if (event.code === "KeyM") {
      logger.log("Toggling mute");
      event.preventDefault();
      const muteElement =
        getElementBySelector<HTMLButtonElement>(".vjs-mute-control");
      muteElement.click();
    }
  }
}

export async function main(path: string): Promise<(() => void) | undefined> {
  if (!matchUrl(path, "/contents")) {
    return undefined;
  }
  loadWatchData();
  setupTeeWatchData();
  teardowns.add(await insertBetterContentListStyle());
  teardowns.add(addKeyboardShortcuts());

  return () => teardowns.clear();
}
