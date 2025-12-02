import { execSync } from "child_process";

const args = process.argv.slice(2);
const messageIndex = args.indexOf("-m");
const commitMessage =
  messageIndex !== -1 && args[messageIndex + 1]
    ? args[messageIndex + 1]
    : "Build.";

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

try {
  run("npm run test:dist");
  run("git add -A");
  run(`git commit -m "${commitMessage}"`);
  run("npm version patch");
  run("npm publish");
  run("git push");
  run("git push --tags");

  console.log("\n🦍 Release complete!");
} catch (error) {
  console.error("\n❌ Release failed!");
  process.exit(1);
}
