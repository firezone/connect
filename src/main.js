import { run } from "./action.js";
try {
  await run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
