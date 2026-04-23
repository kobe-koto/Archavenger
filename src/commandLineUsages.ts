import commandLineUsage from "command-line-usage";
import { ArchavengerOptionDefs } from "./optionDefinitions.ts";

declare const VERSION: string;
let displayVersion;
try {
  displayVersion = VERSION;
} catch (e) {
  const { readFileSync } = await import("node:fs");
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
  displayVersion = version;
}

export const commandLineUsages = commandLineUsage([
  {
    header: 'Archavenger',
    content: 'A tool to clean up old package versions in an Arch Linux package repository.'
  },
  {
    header: 'Options',
    optionList: ArchavengerOptionDefs
  },
  {
    header: "About",
    content: `Home {underline https://github.com/kobe-koto/Archavenger} \nVersion: ${displayVersion}`
  }
]);
