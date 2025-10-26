import { baseLogger } from "../logger.ts";
import {
  getElementBySelector,
  getElementsBySelector,
  insertStyle,
  matchUrl,
  maybeGetElementBySelector,
  TeardownManager,
  waitForElementBySelector,
} from "../utils.ts";

const modLogger = baseLogger.withTag("root");

const teardowns = new TeardownManager(modLogger);

async function waitForLoad() {
  // div.noteの存在でページの読み込み完了を待つ
  await waitForElementBySelector<HTMLDivElement>("#top-view div.note");
}

function addLinks() {
  const logger = modLogger.withTag("addLinks");
  teardowns.add(
    insertStyle(`
      .bttfc-header:hover {
        text-decoration: underline;
        cursor: pointer;
      }
    `),
  );

  for (const header of getElementsBySelector<HTMLDivElement>(
    "div.mb-3:has(> .title-bar):not(:has(> .bttfc-header))",
  )) {
    const moreFlyer = maybeGetElementBySelector<HTMLDivElement>(
      'div.card-flyer[title="もっと見る"]',
      header,
    );
    if (!moreFlyer) {
      logger.warn("No 'もっと見る' flyer found in header", header);
      continue;
    }

    const titleBar = getElementBySelector<HTMLSpanElement>(
      "div.title-bar > span.h4",
      header,
    );
    titleBar.addEventListener("click", () => {
      logger.log("Title bar clicked, opening flyer...");
      moreFlyer.click();
    });
    titleBar.classList.add("bttfc-header");
  }
}

export async function main(path: string): Promise<(() => void) | undefined> {
  if (!(matchUrl(path, "/") || matchUrl(path, "/top"))) {
    return undefined;
  }
  modLogger.log("Started");
  await waitForLoad().then(() => {
    modLogger.log("Page loaded, executing script...");

    addLinks();
  });

  return () => teardowns.clear();
}
