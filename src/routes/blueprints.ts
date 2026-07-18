import { Hono } from "hono";
import { apiKeyAuth } from "../middleware/auth";
import { blueprints } from "../db/blueprints";

const app = new Hono();

app.use("*", apiKeyAuth);

app.get("/", (c) => {
  return c.json(blueprints);
});

export default app;
