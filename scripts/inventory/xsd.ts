// Reads an XML Schema (XSD) file into a plain description: simple types with their facets and
// enumerations, complex types with their content model (sequence/choice order and cardinality)
// and attributes, and global elements. Only the constructs used by the OECD CARF schemas are
// supported; anything else stops the script instead of being skipped silently.
import { readFileSync } from "node:fs";

import { childrenNamed, parseXml, type XmlElement } from "../../src/xml/tree.ts";

export const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema";

export interface QName {
  readonly namespace: string;
  readonly name: string;
}

export interface Enumeration {
  readonly value: string;
  readonly documentation?: string;
}

export interface SimpleTypeDef {
  readonly name?: string;
  readonly base: QName;
  readonly facets: Readonly<Record<string, string>>;
  readonly enumerations: readonly Enumeration[];
  readonly documentation?: string;
}

export interface AttributeDef {
  readonly name: string;
  readonly use: "required" | "optional";
  readonly type?: QName;
  readonly inlineType?: SimpleTypeDef;
  readonly documentation?: string;
}

export type Occurs = number | "unbounded";

export interface ElementParticle {
  readonly kind: "element";
  readonly name: string;
  readonly minOccurs: number;
  readonly maxOccurs: Occurs;
  readonly type?: QName;
  readonly inlineType?: ComplexTypeDef;
  readonly documentation?: string;
}

export interface GroupParticle {
  readonly kind: "sequence" | "choice";
  readonly minOccurs: number;
  readonly maxOccurs: Occurs;
  readonly particles: readonly Particle[];
}

export type Particle = ElementParticle | GroupParticle;

export interface ComplexTypeDef {
  readonly name?: string;
  readonly content?: GroupParticle;
  readonly simpleContent?: {
    readonly derivation: "extension" | "restriction";
    readonly base: QName;
    readonly facets: Readonly<Record<string, string>>;
  };
  readonly attributes: readonly AttributeDef[];
  readonly documentation?: string;
}

export interface SchemaDoc {
  readonly file: string;
  readonly targetNamespace: string;
  readonly version?: string;
  /** Prefix → namespace URI, as declared on xsd:schema. */
  readonly namespaces: Readonly<Record<string, string>>;
  readonly imports: readonly { readonly namespace: string; readonly schemaLocation: string }[];
  readonly simpleTypes: readonly SimpleTypeDef[];
  readonly complexTypes: readonly ComplexTypeDef[];
  readonly elements: readonly ElementParticle[];
}

const FACETS = new Set([
  "length",
  "minLength",
  "maxLength",
  "pattern",
  "fractionDigits",
  "totalDigits",
  "minInclusive",
  "maxInclusive",
  "minExclusive",
  "maxExclusive",
  "whiteSpace",
]);

class UnsupportedXsdError extends Error {}

function unsupported(element: XmlElement): never {
  throw new UnsupportedXsdError(
    `Unsupported XSD construct <${element.name}> at line ${String(element.line)}`,
  );
}

function xsdChildren(element: XmlElement): XmlElement[] {
  return element.children.filter((child) => child.namespace === XSD_NAMESPACE);
}

function documentationOf(element: XmlElement): string | undefined {
  const texts = childrenNamed(element, "annotation")
    .flatMap((annotation) => childrenNamed(annotation, "documentation"))
    .map((doc) => doc.text.replace(/\s+/g, " ").trim())
    .filter((text) => text !== "");
  return texts.length === 0 ? undefined : texts.join(" ");
}

function occurs(value: string | undefined, fallback: number): Occurs {
  if (value === undefined) {
    return fallback;
  }
  if (value === "unbounded") {
    return "unbounded";
  }
  if (!/^\d+$/.test(value)) {
    throw new UnsupportedXsdError(`Invalid occurrence value "${value}"`);
  }
  return Number.parseInt(value, 10);
}

function withDoc<T extends object>(value: T, documentation: string | undefined): T {
  return documentation === undefined ? value : { ...value, documentation };
}

class SchemaReader {
  private readonly namespaces: Readonly<Record<string, string>>;
  private readonly targetNamespace: string;

  constructor(namespaces: Readonly<Record<string, string>>, targetNamespace: string) {
    this.namespaces = namespaces;
    this.targetNamespace = targetNamespace;
  }

  qname(value: string): QName {
    const [prefix, local] = value.includes(":") ? value.split(":", 2) : ["", value];
    const namespace = this.namespaces[prefix ?? ""];
    if (namespace === undefined || local === undefined) {
      throw new UnsupportedXsdError(`Unknown namespace prefix in "${value}"`);
    }
    return { namespace, name: local };
  }

  simpleType(node: XmlElement): SimpleTypeDef {
    const restriction = xsdChildren(node).find((child) => child.name !== "annotation");
    if (restriction?.name !== "restriction") {
      return unsupported(restriction ?? node);
    }
    const base = restriction.attributes.base;
    if (base === undefined) {
      return unsupported(restriction);
    }
    const facets: Record<string, string> = {};
    const enumerations: Enumeration[] = [];
    for (const child of xsdChildren(restriction)) {
      const value = child.attributes.value ?? "";
      if (child.name === "enumeration") {
        enumerations.push(withDoc({ value }, documentationOf(child)));
      } else if (FACETS.has(child.name)) {
        facets[child.name] = value;
      } else if (child.name !== "annotation") {
        unsupported(child);
      }
    }
    const def: SimpleTypeDef = { base: this.qname(base), facets, enumerations };
    const named = node.attributes.name === undefined ? def : { name: node.attributes.name, ...def };
    return withDoc(named, documentationOf(node));
  }

  attribute(node: XmlElement): AttributeDef {
    const name = node.attributes.name;
    if (name === undefined) {
      return unsupported(node);
    }
    const use = node.attributes.use === "required" ? "required" : "optional";
    const inline = xsdChildren(node).find((child) => child.name === "simpleType");
    const typed: AttributeDef =
      inline !== undefined
        ? { name, use, inlineType: this.simpleType(inline) }
        : node.attributes.type !== undefined
          ? { name, use, type: this.qname(node.attributes.type) }
          : unsupported(node);
    return withDoc(typed, documentationOf(node));
  }

  group(node: XmlElement): GroupParticle {
    if (node.name !== "sequence" && node.name !== "choice") {
      return unsupported(node);
    }
    const particles: Particle[] = [];
    for (const child of xsdChildren(node)) {
      if (child.name === "element") {
        particles.push(this.element(child));
      } else if (child.name === "sequence" || child.name === "choice") {
        particles.push(this.group(child));
      } else if (child.name !== "annotation") {
        unsupported(child);
      }
    }
    return {
      kind: node.name,
      minOccurs: occurs(node.attributes.minOccurs, 1) as number,
      maxOccurs: occurs(node.attributes.maxOccurs, 1),
      particles,
    };
  }

  element(node: XmlElement): ElementParticle {
    const name = node.attributes.name;
    if (name === undefined) {
      return unsupported(node);
    }
    const base = {
      kind: "element" as const,
      name,
      minOccurs: occurs(node.attributes.minOccurs, 1) as number,
      maxOccurs: occurs(node.attributes.maxOccurs, 1),
    };
    const inline = xsdChildren(node).find((child) => child.name === "complexType");
    const def: ElementParticle =
      inline !== undefined
        ? { ...base, inlineType: this.complexType(inline) }
        : node.attributes.type !== undefined
          ? { ...base, type: this.qname(node.attributes.type) }
          : unsupported(node);
    return withDoc(def, documentationOf(node));
  }

  complexType(node: XmlElement): ComplexTypeDef {
    let content: GroupParticle | undefined;
    let simpleContent: ComplexTypeDef["simpleContent"];
    const attributes: AttributeDef[] = [];
    for (const child of xsdChildren(node)) {
      if (child.name === "sequence" || child.name === "choice") {
        content = this.group(child);
      } else if (child.name === "attribute") {
        attributes.push(this.attribute(child));
      } else if (child.name === "simpleContent") {
        const derivation = xsdChildren(child).find((d) => d.name !== "annotation");
        if (
          derivation === undefined ||
          (derivation.name !== "extension" && derivation.name !== "restriction") ||
          derivation.attributes.base === undefined
        ) {
          return unsupported(derivation ?? child);
        }
        const facets: Record<string, string> = {};
        for (const part of xsdChildren(derivation)) {
          if (part.name === "attribute") {
            attributes.push(this.attribute(part));
          } else if (FACETS.has(part.name)) {
            facets[part.name] = part.attributes.value ?? "";
          } else if (part.name !== "annotation") {
            unsupported(part);
          }
        }
        simpleContent = {
          derivation: derivation.name,
          base: this.qname(derivation.attributes.base),
          facets,
        };
      } else if (child.name !== "annotation") {
        unsupported(child);
      }
    }
    let def: ComplexTypeDef = { attributes };
    if (node.attributes.name !== undefined) {
      def = { name: node.attributes.name, ...def };
    }
    if (content !== undefined) {
      def = { ...def, content };
    }
    if (simpleContent !== undefined) {
      def = { ...def, simpleContent };
    }
    return withDoc(def, documentationOf(node));
  }

  get target(): string {
    return this.targetNamespace;
  }
}

/** Reads one XSD file. `file` is the name recorded in the inventory; `path` is where it is read. */
export function readSchema(path: string, file: string): SchemaDoc {
  const root = parseXml(readFileSync(path));
  if (root.namespace !== XSD_NAMESPACE || root.name !== "schema") {
    throw new UnsupportedXsdError(`${file} is not an XML Schema`);
  }
  const targetNamespace = root.attributes.targetNamespace ?? "";
  const reader = new SchemaReader(root.declaredNamespaces, targetNamespace);
  const imports: { namespace: string; schemaLocation: string }[] = [];
  const simpleTypes: SimpleTypeDef[] = [];
  const complexTypes: ComplexTypeDef[] = [];
  const elements: ElementParticle[] = [];
  for (const child of xsdChildren(root)) {
    switch (child.name) {
      case "import":
        imports.push({
          namespace: child.attributes.namespace ?? "",
          schemaLocation: child.attributes.schemaLocation ?? "",
        });
        break;
      case "simpleType":
        simpleTypes.push(reader.simpleType(child));
        break;
      case "complexType":
        complexTypes.push(reader.complexType(child));
        break;
      case "element":
        elements.push(reader.element(child));
        break;
      case "annotation":
        break;
      default:
        unsupported(child);
    }
  }
  const doc: SchemaDoc = {
    file,
    targetNamespace: reader.target,
    namespaces: root.declaredNamespaces,
    imports,
    simpleTypes,
    complexTypes,
    elements,
  };
  return root.attributes.version === undefined ? doc : { ...doc, version: root.attributes.version };
}
