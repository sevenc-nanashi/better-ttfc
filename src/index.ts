import { main as rootMain } from "./pages/root.ts";
import { baseLogger as logger } from "./logger.ts";

function callPageMains() {
  logger.log("Navigation detected, calling scripts...");
  rootMain();
}

async function main() {
  logger.log("Better TTFC: Started");

  // popstateが動かないので、無理やりフックを追加
  const originalPushState = history.pushState;
  const pushStateHook = (...args: Parameters<typeof originalPushState>) => {
    logger.log("History pushState called", args);
    callPageMains();
    return originalPushState.apply(history, args);
  };
  history.pushState = pushStateHook;

  callPageMains();
}

main();
