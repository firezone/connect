import { post } from "./action.js";
try {
  await post();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
