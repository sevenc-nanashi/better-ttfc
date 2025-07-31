import { matchUrl } from "../utils.ts";
import { baseLogger } from "../logger.ts";

const modLogger = baseLogger.withTag("watch");

const watchedKey = "bttfcWatched";

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

export async function main(path: string): Promise<(() => void) | undefined> {
  if (!matchUrl(path, "/contents")) {
    return undefined;
  }
  loadWatchData();
  setupTeeWatchData();

  return () => {};
}
