import { GoogleGenAI } from "@google/genai";
import { execSync } from "child_process";
import { program } from "commander";
import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";

function getGeminiKey() {
  console.log("🔑 Checking for Gemini API key...");
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY environment variable not set.");
    process.exit(1);
  }
  console.log("✅ API key found");
  return apiKey;
}

async function callGemini(message, model = "gemini-2.0-flash") {
  console.log(`🤖 Calling Gemini API with model: ${model}...`);
  try {
    const ai = new GoogleGenAI({ apiKey: getGeminiKey() });
    const response = await ai.models.generateContent({
      model: model,
      contents: message,
    });
    console.log("✅ Successfully received response from Gemini");
    return response.text;
  } catch (error) {
    console.error("❌ Error calling Gemini API:", error.message);
    throw error;
  }
}

function getDesktopPath() {
  console.log("📁 Getting desktop path...");
  const desktopPath = path.join(os.homedir(), "Desktop");
  console.log(`📍 Desktop path: ${desktopPath}`);
  return desktopPath;
}

function generateFilename(prefix = "diff") {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:T.]/g, "")
    .slice(0, -4);
  return `${prefix}_${timestamp}.txt`;
}

function getGitDiff() {
  console.log("🔍 Getting git diff...");
  try {
    const result = execSync("git diff HEAD", { encoding: "utf-8" });
    if (!result.trim()) {
      console.log("ℹ️ No changes detected in git diff (compared to HEAD)");
    } else {
      console.log("✅ Git diff retrieved successfully");
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.stderr) {
      console.error("❌ Git command failed:", error.stderr);
      console.error("Output (stdout):", error.stdout);

      if (error.stderr.includes("not a git repository")) {
        throw new Error(
          "Not a git repository or no commits yet. Git diff cannot be performed."
        );
      } else if (
        error.status === 128 &&
        error.stderr.includes("fatal: ambiguous argument 'HEAD'")
      ) {
        console.warn(
          "⚠️ HEAD not found. This might be a new repository without commits. Trying 'git diff --cached' for staged changes..."
        );
        try {
          const stagedResult = execSync("git diff --cached", {
            encoding: "utf-8",
          });
          if (!stagedResult.trim()) {
            console.log("ℹ️ No staged changes detected either.");
            return "";
          }
          console.log("✅ Staged git diff retrieved successfully");
          return stagedResult;
        } catch (stagedError) {
          console.error("❌ Failed to get staged diff:", stagedError.stderr);
          throw new Error(`Git command failed: ${stagedError.stderr}`);
        }
      }
      throw new Error(`Git command failed: ${error.stderr}`);
    } else {
      console.error("❌ Unexpected error during git diff:", error.message);
      throw error;
    }
  }
}

function saveGitDiff(diffContent, filepath) {
  console.log("💾 Saving git diff...");
  try {
    fs.writeFileSync(filepath, diffContent);
    console.log(`✅ Git diff saved to: ${filepath}`);
  } catch (error) {
    console.error(`❌ Error saving git diff: ${error.message}`);
    throw error;
  }
}

async function generateCommitMessage(diffContent) {
  if (!diffContent || diffContent.trim() === "") {
    console.log(
      "📝 No diff content to generate commit message from. Skipping Gemini call."
    );
    return "No changes to commit.";
  }
  console.log("📝 Generating commit message...");
  const message = `Analyze the following git diff and generate a commit message following the Conventional Commits specification.

The commit message format should be: type(optional-scope): description
- Type must be one of: build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test
- Scope is optional and in parentheses
- Description should be in imperative mood and lowercase
- Keep the header line under 72 characters
- Optionally include a body with more detailed information after a blank line
- Optionally include a footer with issue references like "Fixes #123"

Examples:
- "feat: add user authentication"
- "fix(auth): resolve login issue" 
- "docs: update API documentation"

Do NOT include any markdown formatting like "\`\`\`" or code blocks.
Output only the raw commit message text.

Git Diff:
${diffContent}`;
  return await callGemini(message);
}

function saveCommitMessage(commitMessage, filepath) {
  console.log("💾 Saving commit message...");
  try {
    fs.writeFileSync(filepath, commitMessage);
    console.log(`✅ Commit message saved to: ${filepath}`);
  } catch (error) {
    console.error(`❌ Error saving commit message: ${error.message}`);
    throw error;
  }
}

function askConfirmation(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      const cleanAns = ans.toLowerCase().trim();
      resolve(cleanAns === "y" || cleanAns === "");
    })
  );
}

function commitAndSync(commitMessage) {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `ups_commit_${Date.now()}.txt`);

  try {
    console.log("➕ Staging all changes...");
    execSync("git add -A");
    console.log("✅ Changes staged.");

    console.log("✍️ Committing...");
    fs.writeFileSync(tempFilePath, commitMessage);
    execSync(`git commit -F "${tempFilePath}"`);
    console.log("✅ Commit successful.");
  } catch (error) {
    console.error("❌ Git commit failed:", error.message);
    throw error;
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }

  try {
    console.log("🔄 Syncing with remote...");
    const branchName = execSync("git branch --show-current", {
      encoding: "utf-8",
    }).trim();
    if (!branchName) {
      throw new Error("Could not determine current branch name.");
    }
    execSync(`git push origin ${branchName}`);
    console.log(`✅ Pushed to origin/${branchName}.`);
  } catch (error) {
    console.error("❌ Git push failed:", error.message);
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting diff.js script...");

  program
    .option("--diff", "Save the git diff to a file on the desktop.")
    .option("--msg", "Save the commit message to a file on the desktop.")
    .parse(process.argv);

  const options = program.opts();

  try {
    const desktopPath = getDesktopPath();
    const diffContent = getGitDiff();

    if (!diffContent && !options.diff) {
      console.log("✅ No changes detected and --diff not specified. Exiting.");
      return;
    }
    if (!diffContent && options.diff) {
      console.log(
        "ℹ️ No changes detected, but --diff specified. An empty diff file will be created."
      );
    }

    const commitMessage = await generateCommitMessage(diffContent);

    if (commitMessage && commitMessage.trim() !== "No changes to commit.") {
      console.log("\n📋 Generated Commit Message:\n---");
      console.log(commitMessage);
      console.log("---\n");

      if (options.diff) {
        const diffFilename = generateFilename("diff");
        const diffFilePath = path.join(desktopPath, diffFilename);
        saveGitDiff(diffContent, diffFilePath);
      }

      if (options.msg) {
        const commitMessageFilename = generateFilename("commit_message");
        const commitMessageFilePath = path.join(
          desktopPath,
          commitMessageFilename
        );
        saveCommitMessage(commitMessage, commitMessageFilePath);
      }

      const proceed = await askConfirmation(
        "❔ Commit and push with this message? (y/n) [Y]: "
      );
      if (proceed) {
        commitAndSync(commitMessage);
      } else {
        console.log("👍 Commit aborted by user.");
      }
    } else if (diffContent.trim() === "" && options.msg) {
      console.log(
        "ℹ️ No changes detected, so no commit message to save, but --msg specified. An empty commit message file will be created."
      );
      const commitMessageFilename = generateFilename("commit_message_empty");
      const commitMessageFilePath = path.join(
        desktopPath,
        commitMessageFilename
      );
      saveCommitMessage("No changes detected.", commitMessageFilePath);
    } else {
      console.log("✅ No changes to commit.");
    }

    console.log("✨ Script completed successfully");
  } catch (error) {
    console.error("❌ Script failed:", error.message);
    process.exit(1);
  }
}

main();
