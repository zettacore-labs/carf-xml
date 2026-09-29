// Finds the official schema set in a folder and checks every file against the SHA-256 recorded
// when this package was generated, so validation never runs against an altered XSD.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { KNOWN_SCHEMA_SETS, type KnownSchemaSet } from "../generated/schema-sets.js";

export type SchemaKind = "carf" | "status";

const ROOT_ELEMENT: Readonly<Record<SchemaKind, string>> = {
  carf: "CARF_OECD",
  status: "CARFStatusMessage_OECD",
};

export interface ResolvedSchemaSet {
  readonly id: string;
  /** Path of the root XSD to validate against. */
  readonly rootPath: string;
}

export class SchemaSetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaSetError";
  }
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * The known official schema set of `kind` whose files are in `dir`. Throws SchemaSetError if
 * no known root schema is there, or if any file differs from the official one.
 */
export function resolveSchemaSet(dir: string, kind: SchemaKind): ResolvedSchemaSet {
  const candidates = KNOWN_SCHEMA_SETS.filter((set) => set.rootElement === ROOT_ELEMENT[kind]);
  const present = candidates.filter((set: KnownSchemaSet) => existsSync(join(dir, set.rootSchema)));
  const set = present[0];
  if (set === undefined) {
    throw new SchemaSetError(
      `Official OECD XSD missing: none of ${candidates.map((c) => c.rootSchema).join(", ")} is in ${dir}.`,
    );
  }
  const problems = set.files
    .map((file) => {
      const path = join(dir, file.name);
      if (!existsSync(path)) {
        return `${file.name} is missing`;
      }
      return sha256(path) === file.sha256
        ? undefined
        : `${file.name} differs from the official file`;
    })
    .filter((problem): problem is string => problem !== undefined);
  if (problems.length > 0) {
    throw new SchemaSetError(
      `Schema set ${set.id} in ${dir} cannot be used: ${problems.join("; ")}.`,
    );
  }
  return { id: set.id, rootPath: join(dir, set.rootSchema) };
}
