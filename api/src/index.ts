import { Hono } from "hono";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { fetchEpisodes, findProgramId } from "./extract";
import { cors } from "hono/cors";

const app = new Hono();
const allowMethods = ["GET", "OPTIONS"];
const origin = "https://pc.tokusatsu-fc.jp";

app.use(
  "*",
  cors({
    origin,
    allowMethods,
  }),
);

app.get("/", (c) => {
  return c.redirect("https://github.com/sevenc-nanashi/better-ttfc/tree/main/api");
});

app.get(
  "/episodes",
  zValidator(
    "query",
    z.object({
      name: z.string(),
    }),
  ),
  async (c) => {
    const name = c.req.valid("query").name;
    const programId = await findProgramId(name);
    if (!programId) {
      return c.json({ error: "Program not found" }, 404);
    }

    const episodes = await fetchEpisodes(programId);
    return c.json({ episodes });
  },
);

export default app;
