import { baseLogger as modLogger } from "./logger.ts";
const mains = import.meta.glob("./pages/*.ts", { eager: true, import: "main" }) as Record<
  string,
  (path: string) => Promise<void>
>;

async function callPageMains(path: string) {
  const logger = modLogger.withTag("callPageMains");
  logger.log("Navigation detected, calling scripts for path:", path);

  for (const [filePath, mainFunc] of Object.entries(mains)) {
    try {
      await mainFunc(path);
      logger.log(`Successfully called main function from ${filePath}`);
    } catch (error) {
      logger.error(`Error calling main function from ${filePath}:`, error);
    }
  }
}

async function main() {
  modLogger.log("Started");

  await callPageMains(location.pathname);
}

void main();
