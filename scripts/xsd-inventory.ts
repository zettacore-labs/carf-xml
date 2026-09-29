// Generates src/generated/{inventory.json, enums.ts, schema-sets.ts} from the official OECD XSDs.
//
//   pnpm inventory --carf-dir <dir> --carf-set <id> --status-dir <dir> --status-set <id> [--check]
//
// <dir> is the folder holding the unchanged files of one OECD schema ZIP; <id> names the set,
// e.g. carf-v1.5-2025-07 and carf-status-v1.1-2025-06. With --check nothing is written and the
// script exits 1 if the committed files differ from what the XSDs produce.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  buildInventory,
  enumsModule,
  inventoryJson,
  schemaSetsModule,
} from "./inventory/generate.ts";
import { readSchema } from "./inventory/xsd.ts";

const CARF_ROOT_ELEMENT = "CARF_OECD";
const STATUS_ROOT_ELEMENT = "CARFStatusMessage_OECD";
const outDir = resolve(import.meta.dirname, "../src/generated");

const { values } = parseArgs({
  options: {
    "carf-dir": { type: "string" },
    "carf-set": { type: "string" },
    "status-dir": { type: "string" },
    "status-set": { type: "string" },
    check: { type: "boolean", default: false },
  },
  strict: true,
});

function required(name: keyof typeof values): string {
  const value = values[name];
  if (typeof value !== "string" || value === "") {
    throw new Error(`--${name} is required`);
  }
  return value;
}

/** The .xsd file in `dir` that declares `rootElement` as a global element. */
function findRootSchema(dir: string, rootElement: string): string {
  const matches = readdirSync(dir)
    .filter((file) => file.endsWith(".xsd"))
    .sort()
    .filter((file) =>
      readSchema(join(dir, file), file).elements.some((e) => e.name === rootElement),
    );
  if (matches.length !== 1 || matches[0] === undefined) {
    throw new Error(`Expected exactly one XSD declaring ${rootElement} in ${dir}`);
  }
  return matches[0];
}

const carfDir = resolve(required("carf-dir"));
const statusDir = resolve(required("status-dir"));
const inventory = buildInventory([
  {
    id: required("carf-set"),
    dir: carfDir,
    rootSchema: findRootSchema(carfDir, CARF_ROOT_ELEMENT),
    rootElement: CARF_ROOT_ELEMENT,
    enumPrefix: "",
  },
  {
    id: required("status-set"),
    dir: statusDir,
    rootSchema: findRootSchema(statusDir, STATUS_ROOT_ELEMENT),
    rootElement: STATUS_ROOT_ELEMENT,
    enumPrefix: "Csm",
  },
]);

const outputs = {
  "inventory.json": inventoryJson(inventory),
  "enums.ts": enumsModule(inventory),
  "schema-sets.ts": schemaSetsModule(inventory),
};

let stale = 0;
for (const [file, content] of Object.entries(outputs)) {
  const path = join(outDir, file);
  if (values.check) {
    let current: string;
    try {
      current = readFileSync(path, "utf8");
    } catch {
      current = "";
    }
    if (current !== content) {
      console.error(`xsd-inventory: ${file} is out of date`);
      stale += 1;
    }
  } else {
    writeFileSync(path, content);
    console.log(`xsd-inventory: wrote ${file}`);
  }
}
if (stale > 0) {
  process.exitCode = 1;
} else if (values.check) {
  console.log("xsd-inventory: generated files are up to date");
}
