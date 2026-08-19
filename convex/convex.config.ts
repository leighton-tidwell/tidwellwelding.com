import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";

const app = defineApp();
app.use(agent);
app.use(rateLimiter);
app.use(resend);

export default app;
