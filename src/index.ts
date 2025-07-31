import { baseLogger as modLogger } from "./logger.ts";
import { main as rootMain } from "./pages/root.ts";
import { main as pickupMain } from "./pages/pickup.ts";
import { main as watchMain } from "./pages/watch.ts";

const mains = {
  root: rootMain,
  pickup: pickupMain,
  watch: watchMain,
} satisfies Record<string, (path: string) => Promise<(() => void) | undefined>>;

let tearDownPreviousMains: (() => void) | undefined;
async function callPageMains(path: string) {
  tearDownPreviousMains?.();
  modLogger.log("Navigation detected, calling scripts for path:", path);

  const tearDowns = Object.fromEntries(
    await Promise.all(
      Object.entries(mains).map(async ([name, main]) => [
        name,
        await main(path),
      ]),
    ),
  ) as Record<string, (() => void) | undefined>;
  modLogger.log(
    "Page scripts called",
    Object.entries(tearDowns)
      .filter(([, result]) => result)
      .map(([name]) => name),
  );
  tearDownPreviousMains = () => {
    modLogger.log("Tearing down page scripts");
    for (const [name, tearDown] of Object.entries(tearDowns)) {
      if (tearDown) {
        modLogger.log(`Tearing down ${name}`);
        tearDown();
      } else {
        modLogger.warn(`No tear down function for ${name}`);
      }
    }
  };
}

function insertNavigationHook() {
  const logger = modLogger.withTag("insertNavigationHook");
  // popstateだと動かないので、無理やりフックを追加
  const originalPushState = history.pushState;
  const pushStateHook = (...args: Parameters<typeof originalPushState>) => {
    logger.log("History pushState called", args);
    callPageMains(args[2] as string);
    return originalPushState.apply(history, args);
  };
  history.pushState = pushStateHook;
  logger.log("Navigation hook inserted");
}

async function main() {
  modLogger.log("Started");

  insertNavigationHook();

  callPageMains(location.pathname);
}

main();
