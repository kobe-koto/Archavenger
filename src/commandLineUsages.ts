import commandLineUsage from "command-line-usage";
import { ArchavengerOptionDefs } from "./optionDefinitions.ts";

import { readFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

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
    content: `Home {underline https://github.com/kobe-koto/Archavenger} \nVersion: ${version}`
  }
]);
