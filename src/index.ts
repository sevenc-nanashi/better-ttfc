import { baseLogger as modLogger } from "./logger.ts";
import { main as rootMain } from "./pages/root.ts";
import { main as pickupMain } from "./pages/pickup.ts";

const mains = {
  root: rootMain,
  pickup: pickupMain,
} satisfies Record<string, (path: string) => Promise<boolean>>;

async function callPageMains(path: string) {
  modLogger.log("Navigation detected, calling scripts for path:", path);

  const promises = Object.fromEntries(
    await Promise.all(
      Object.entries(mains).map(async ([name, main]) => [
        name,
        await main(path),
      ]),
    ),
  );
  modLogger.log(
    "Page scripts called",
    Object.entries(promises)
      .filter(([, result]) => result)
      .map(([name]) => name),
  );
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
