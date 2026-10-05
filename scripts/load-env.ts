import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import path from "node:path";

// Next.js loads .env.local automatically, but standalone tsx scripts do not.
// Existing shell variables keep precedence over values loaded from this file.
const localEnv = path.join(process.cwd(), ".env.local");
const baseEnv = path.join(process.cwd(), ".env");
const envFile = existsSync(localEnv) ? localEnv : baseEnv;

if (existsSync(envFile)) loadEnvFile(envFile);
