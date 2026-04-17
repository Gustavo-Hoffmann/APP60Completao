import cors from "cors";
import express from "express";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { createOptionalAudienceAuthMiddleware } from "./middleware/auth.js";
import { bootstrapRouter } from "./routes/bootstrap.js";
import { collectionsRouter } from "./routes/collections.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { institutionsRouter } from "./routes/institutions.js";
import { knowledgeBaseRouter } from "./routes/knowledgeBase.js";
import { meRouter } from "./routes/me.js";
import { participantsRouter } from "./routes/participants.js";
import { usersRouter } from "./routes/users.js";

const cfg = loadConfig();
const pool = createPool(cfg);
const auth = createOptionalAudienceAuthMiddleware(cfg, pool);

const app = express();
app.use(
  cors({
    origin: cfg.CORS_ORIGIN === "*" ? true : cfg.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "app60-api" });
});

app.use("/bootstrap", bootstrapRouter(pool));

const api = express.Router();
api.use(auth);
api.use("/me", meRouter(pool));
api.use("/institutions", institutionsRouter(pool));
api.use("/users", usersRouter(pool, cfg));
api.use("/participants", participantsRouter(pool));
api.use("/collections", collectionsRouter(pool, cfg));
api.use("/knowledge-base", knowledgeBaseRouter(pool));
api.use("/dashboard", dashboardRouter(pool));

app.use("/api", api);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno." });
});

app.listen(cfg.PORT, () => {
  console.log(`app60-api listening on :${cfg.PORT}`);
});
