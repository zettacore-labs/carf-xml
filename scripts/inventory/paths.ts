// Flattens a schema set into every element path reachable from its root element, with the
// element's own cardinality and whether it is required whenever its parent is present.
import type {
  AttributeDef,
  ComplexTypeDef,
  ElementParticle,
  GroupParticle,
  Occurs,
  QName,
  SchemaDoc,
  SimpleTypeDef,
} from "./xsd.ts";
import { XSD_NAMESPACE } from "./xsd.ts";

export interface AttributePath {
  readonly name: string;
  readonly use: "required" | "optional";
  readonly type: string;
  readonly enumerations?: readonly string[];
}

export interface ElementPath {
  /** Local names from the root, e.g. "CARF_OECD/MessageSpec/MessageRefId". */
  readonly path: string;
  readonly namespace: string;
  /** Prefixed type name (e.g. "iso:CountryCode_Type"), or "(anonymous)" for an inline type. */
  readonly type: string;
  readonly minOccurs: number;
  readonly maxOccurs: Occurs;
  /** The element is a branch of an xsd:choice (directly or through a nested group). */
  readonly inChoice: boolean;
  /** Present whenever its parent is present: minOccurs ≥ 1, not in a choice or optional group. */
  readonly required: boolean;
  /** "complex" (has child elements), "simple" (text) or "simpleContent" (text + attributes). */
  readonly content: "complex" | "simple" | "simpleContent" | "empty";
  readonly attributes: readonly AttributePath[];
}

export class SchemaSetIndex {
  private readonly prefixes = new Map<string, string>();
  private readonly schemas: readonly SchemaDoc[];

  constructor(schemas: readonly SchemaDoc[]) {
    this.schemas = schemas;
    for (const schema of schemas) {
      for (const [prefix, namespace] of Object.entries(schema.namespaces)) {
        if (!this.prefixes.has(namespace) && prefix !== "") {
          this.prefixes.set(namespace, prefix);
        }
      }
    }
  }

  qnameText(name: QName): string {
    const prefix = this.prefixes.get(name.namespace);
    return prefix === undefined ? `{${name.namespace}}${name.name}` : `${prefix}:${name.name}`;
  }

  complexType(name: QName): ComplexTypeDef | undefined {
    return this.schemas
      .find((schema) => schema.targetNamespace === name.namespace)
      ?.complexTypes.find((type) => type.name === name.name);
  }

  simpleType(name: QName): SimpleTypeDef | undefined {
    return this.schemas
      .find((schema) => schema.targetNamespace === name.namespace)
      ?.simpleTypes.find((type) => type.name === name.name);
  }

  isKnownSimple(name: QName): boolean {
    return name.namespace === XSD_NAMESPACE || this.simpleType(name) !== undefined;
  }
}

function attributePaths(
  index: SchemaSetIndex,
  attributes: readonly AttributeDef[],
): AttributePath[] {
  return attributes.map((attribute) => {
    const simple =
      attribute.inlineType ??
      (attribute.type === undefined ? undefined : index.simpleType(attribute.type));
    const type = attribute.type === undefined ? "(anonymous)" : index.qnameText(attribute.type);
    const enumerations = simple?.enumerations.map((e) => e.value) ?? [];
    return enumerations.length > 0
      ? { name: attribute.name, use: attribute.use, type, enumerations }
      : { name: attribute.name, use: attribute.use, type };
  });
}

function walkGroup(
  index: SchemaSetIndex,
  group: GroupParticle,
  parentPath: string,
  namespace: string,
  inChoice: boolean,
  optionalGroup: boolean,
  out: ElementPath[],
): void {
  const choice = inChoice || group.kind === "choice";
  const optional = optionalGroup || group.minOccurs === 0;
  for (const particle of group.particles) {
    if (particle.kind === "element") {
      walkElement(index, particle, parentPath, namespace, choice, optional, out);
    } else {
      walkGroup(index, particle, parentPath, namespace, choice, optional, out);
    }
  }
}

function walkElement(
  index: SchemaSetIndex,
  element: ElementParticle,
  parentPath: string,
  namespace: string,
  inChoice: boolean,
  optionalGroup: boolean,
  out: ElementPath[],
): void {
  const path = parentPath === "" ? element.name : `${parentPath}/${element.name}`;
  const complex =
    element.inlineType ??
    (element.type === undefined ? undefined : index.complexType(element.type));
  if (complex === undefined && element.type !== undefined && !index.isKnownSimple(element.type)) {
    throw new Error(`Unresolved type ${index.qnameText(element.type)} for ${path}`);
  }
  const content: ElementPath["content"] =
    complex === undefined
      ? "simple"
      : complex.content !== undefined
        ? "complex"
        : complex.simpleContent !== undefined
          ? "simpleContent"
          : "empty";
  out.push({
    path,
    namespace,
    type: element.type === undefined ? "(anonymous)" : index.qnameText(element.type),
    minOccurs: element.minOccurs,
    maxOccurs: element.maxOccurs,
    inChoice,
    required: element.minOccurs >= 1 && !inChoice && !optionalGroup,
    content,
    attributes: complex === undefined ? [] : attributePaths(index, complex.attributes),
  });
  if (complex?.content !== undefined) {
    // Local elements take the namespace of the schema that declares their parent type
    // (elementFormDefault="qualified" in every OECD CARF schema).
    const childNamespace = element.type === undefined ? namespace : element.type.namespace;
    walkGroup(index, complex.content, path, childNamespace, false, false, out);
  }
}

/** Every element path reachable from `rootElement` of the set's root schema, in schema order. */
export function elementPaths(schemas: readonly SchemaDoc[], rootElement: string): ElementPath[] {
  const root = schemas[0];
  const element = root?.elements.find((candidate) => candidate.name === rootElement);
  if (root === undefined || element === undefined) {
    throw new Error(`Root element ${rootElement} not found`);
  }
  const out: ElementPath[] = [];
  walkElement(new SchemaSetIndex(schemas), element, "", root.targetNamespace, false, false, out);
  return out;
}
