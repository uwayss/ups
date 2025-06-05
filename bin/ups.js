#!/usr/bin/env node

import { Command } from "commander";
import { fork } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name("ups")
  .description(
    "Uwayss's Project Utilities - A CLI tool for common development tasks. Run 'ups <command> --help' for command-specific options."
  );

const commandsDir = path.resolve(__dirname, "..", "src", "commands");

try {
  const files = fs.readdirSync(commandsDir);
  files.forEach((file) => {
    if (file.endsWith(".js")) {
      const commandName = path.basename(file, ".js");
      const scriptPath = path.join(commandsDir, file);

      program
        .command(commandName)
        .description(`Execute the ${commandName} script.`)
        .allowUnknownOption(true)
        .action((_options, cmdInstance) => {
          const scriptArgs = cmdInstance.args;
          const child = fork(scriptPath, scriptArgs, { stdio: "inherit" });

          child.on("error", (err) => {
            console.error(`Failed to start script ${commandName}:`, err);
            process.exit(1);
          });

          child.on("exit", (code) => {
            process.exitCode = code === null ? 1 : code;
          });
        });
    }
  });
} catch (error) {
  if (error.code !== "ENOENT") {
    console.error(
      `Error loading commands from ${commandsDir}: ${error.message}`
    );
    process.exit(1);
  }
}

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
