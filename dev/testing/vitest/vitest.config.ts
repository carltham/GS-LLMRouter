import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const appRoot = join(repositoryRoot, "GS-LLMRouter");

export default {
  root: repositoryRoot,
  cacheDir: join(appRoot, "node_modules/.vite"),
  resolve: {
    alias: [{ find: /^vitest$/, replacement: join(appRoot, "node_modules/vitest") }],
  },
  test: {
    include: ["dev/testing/vitest/**/*.test.ts"],
    environment: "node",
    fsModuleCachePath: join(appRoot, "node_modules/.vitest-cache"),
    coverage: {
      provider: "v8",
      include: ["GS-LLMRouter/src/**/*.ts"],
      exclude: ["GS-LLMRouter/src/**/*.d.ts"],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: join(appRoot, "coverage"),
    },
  },
};
