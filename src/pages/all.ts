import { baseLogger } from "../logger.ts";
import { maybeGetElementBySelector, TeardownManager } from "../utils.ts";

const modLogger = baseLogger.withTag("all");

const teardowns = new TeardownManager(modLogger);

function setTitle() {
  const logger = modLogger.withTag("setTitle");
  // diplayは本当にそういうIDなので注意
  const pageTitle =
    maybeGetElementBySelector<HTMLTitleElement>(
      "#diplay-head .h2",
    )?.textContent;
  if (pageTitle) {
    const newTitle = `${pageTitle} | 東映特撮ファンクラブ`;
    if (document.title !== newTitle) {
      document.title = newTitle;
      logger.log("Set document title to:", newTitle);
    }
  }
}

export async function main(_path: string): Promise<(() => void) | undefined> {
  modLogger.log("Started");
  modLogger.log("Page loaded, executing script...");

  const interval = setInterval(() => {
    setTitle();
  }, 100);
  teardowns.add(() => {
    clearInterval(interval);
  });

  return () => teardowns.clear();
}
