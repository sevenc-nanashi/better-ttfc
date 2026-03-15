import { defineConfig } from "vite-plus";
import monkey from "vite-plugin-monkey";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [
    monkey({
      entry: "./src/index.ts",
      userscript: {
        name: packageJson.displayName,
        description: packageJson.description,
        version: packageJson.version,
        homepage: packageJson.homepage,
        author: packageJson.author,
        match: "https://pc.tokusatsu-fc.jp/*",
        updateURL: `https://raw.githubusercontent.com/sevenc-nanashi/${packageJson.name}/built/index.user.js`,
        downloadURL: `https://raw.githubusercontent.com/sevenc-nanashi/${packageJson.name}/built/index.user.js`,
        // @ts-expect-error 型定義が壊れてるはず
        sandbox: "MAIN_WORLD",
        "run-at": "document-body",
      },
    }),
  ],
});
