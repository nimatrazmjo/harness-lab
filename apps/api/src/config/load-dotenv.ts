import * as path from "path";
import * as dotenv from "dotenv";

/**
 * Local/dev/test only: loads the repo-root .env (git-ignored) into process.env.
 * In production nothing calls this — real secrets come from AWS Secrets Manager
 * (see ./secrets.ts), never from a .env file on disk.
 */
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
}
