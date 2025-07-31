import {
  getElementBySelector,
  getElementsBySelector,
  insertStyle,
  matchUrl,
  maybeGetElementBySelector,
} from "../utils.ts";
import { baseLogger } from "../logger.ts";

const modLogger = baseLogger.withTag("root");

async function waitForLoad() {
  // div.noteの存在でページの読み込み完了を待つ
  const { promise, resolve } = Promise.withResolvers<void>();
  setInterval(() => {
    const maybeNote =
      document.querySelector<HTMLDivElement>("#top-view div.note");
    if (maybeNote) {
      resolve();
    } else {
      console.warn("Note element not found, retrying...");
    }
  }, 100);
  return promise;
}

function addLinks() {
  const logger = modLogger.withTag("addLinks");
  insertStyle(`
    .bttfc-header:hover {
      text-decoration: underline;
      cursor: pointer;
    }
  `);

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
    titleBar.innerHTML += " →";
    titleBar.addEventListener("click", () => {
      logger.log("Title bar clicked, opening flyer...");
      moreFlyer.click();
    });
    titleBar.classList.add("bttfc-header");
  }
}

export async function main() {
  if (!matchUrl("/")) {
    return;
  }
  modLogger.log("Started");
  await waitForLoad();
  modLogger.log("Page loaded, executing script...");

  addLinks();
}
