import { loadEnv } from "./paths.js";
loadEnv();

process.env.DEBUG_RAW = "true";
import "./eval-photos.js";
