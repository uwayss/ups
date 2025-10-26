# ups (Uwayss's Project Utilities)

`ups` is a command-line interface (CLI) tool designed to centralize and simplify the execution of common project utility scripts.

## Installation

You can run `ups` commands directly using `npx` without needing a global installation:

```bash
npx @uwayss/ups <command_name> [options]
```

Alternatively, you can install it globally if you prefer:

```bash
npm install -g @uwayss/ups
ups <command_name> [options]
```

## Usage

To use a script, invoke `ups` followed by the script's name (which is derived from its filename):

```bash
npx @uwayss/ups <script_name> [script_specific_options]
```

For example:

```bash
npx @uwayss/ups diff
npx @uwayss/ups dump
npx @uwayss/ups dump src/components
```

To see available commands:

```bash
npx @uwayss/ups --help
```

To see help for a specific command:

```bash
npx @uwayss/ups <script_name> --help
```

## Available Scripts

`ups` dynamically discovers scripts placed in its `src/commands/` directory.

- `diff`: Generates conventional commit messages from git diffs and provides an option to commit and push the changes.
- `dump`: Dumps the codebase of a project into a single text file, intelligently ignoring irrelevant files.

## Configuration

### diff

The `diff` script requires `GEMINI_API_KEY` to be set in your environment to communicate with the Google Gemini API.

### dump

The `dump` script works out-of-the-box by automatically respecting your project's `.gitignore` file.

For additional custom exclusions or to override the default output directory, you can create a `ups.config.json` file in the root of your project.

Here is an example of what `ups.config.json` can look like:

```json
{
  "dump": {
    "dumpPath": "~/Code/Dumps",
    "excludeDirs": ["docs", "examples"],
    "excludeFiles": ["my-temp-script.js"],
    "excludeExtensions": [".local"],
    "ignoreMarker": "custom-ignore-marker"
  }
}
```

- `dumpPath`: Overrides the default output directory (your Desktop) for all dumps. You can use `~` for your home directory.
- `excludeDirs/Files/Extensions`: Add extra patterns to the exclusion lists.
- `ignoreMarker`: Specifies a string that, when found in a file, causes the `dump` command to ignore the rest of that file's content. The line containing the marker will still be included. If not set, it defaults to `"ups-ignore-rest"`.

This provides a simple way to tailor the dump for any project without modifying the `ups` tool's source code.
