// A small, read-only element tree built with saxes. saxes does not process DTDs or external
// entities, so parsing an untrusted file cannot fetch anything or expand entity bombs.
// Every element keeps its start line and its path, which the business rules and the error
// translator use to point at the exact element.
import { SaxesParser, type SaxesTagNS } from "saxes";

export interface XmlElement {
  /** Local name, without the namespace prefix. */
  readonly name: string;
  readonly namespace: string;
  /** Attribute values by local name (CARF attributes are unqualified). */
  readonly attributes: Readonly<Record<string, string>>;
  /** Namespace declarations made on this element: prefix ("" for the default) → URI. */
  readonly declaredNamespaces: Readonly<Record<string, string>>;
  readonly children: readonly XmlElement[];
  /** Concatenated text directly inside this element. */
  readonly text: string;
  /** 1-based line of the start tag's "<". */
  readonly line: number;
  /** 1-based column of the start tag's "<". */
  readonly column: number;
  /** Path of local names without positions, e.g. "CARF_OECD/MessageSpec/ReportingPeriod". */
  readonly path: string;
  /** XPath with positions among same-name siblings, e.g. "/CARF_OECD/CARFBody[1]/CryptoUsers[2]". */
  readonly xpath: string;
  readonly parent: XmlElement | undefined;
}

export class XmlParseError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(message);
    this.name = "XmlParseError";
    this.line = line;
    this.column = column;
  }
}

interface MutableElement {
  name: string;
  namespace: string;
  attributes: Record<string, string>;
  declaredNamespaces: Record<string, string>;
  children: MutableElement[];
  text: string;
  line: number;
  column: number;
  path: string;
  xpath: string;
  parent: MutableElement | undefined;
}

function decode(input: string | Uint8Array): string {
  if (typeof input === "string") {
    return input;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(input);
  } catch {
    throw new XmlParseError("The file is not valid UTF-8.", 1, 1);
  }
}

/** Parses an XML document into an element tree. Throws XmlParseError on malformed XML. */
export function parseXml(input: string | Uint8Array): XmlElement {
  const parser = new SaxesParser({ xmlns: true, position: true });
  const stack: MutableElement[] = [];
  let root: MutableElement | undefined;
  let startLine = 1;
  let startColumn = 1;
  let failure: XmlParseError | undefined;

  parser.on("error", (error) => {
    failure ??= new XmlParseError(error.message, parser.line, parser.column);
  });
  parser.on("opentagstart", (tag) => {
    // saxes reports the 1-based column after the tag name; the "<" is on the same line.
    startLine = parser.line;
    startColumn = parser.column - tag.name.length - 1;
  });
  parser.on("opentag", (tag: SaxesTagNS) => {
    const parent = stack.at(-1);
    const attributes: Record<string, string> = {};
    const declaredNamespaces: Record<string, string> = {};
    for (const attribute of Object.values(tag.attributes)) {
      if (attribute.name === "xmlns") {
        declaredNamespaces[""] = attribute.value;
      } else if (attribute.prefix === "xmlns") {
        declaredNamespaces[attribute.local] = attribute.value;
      } else {
        attributes[attribute.local] = attribute.value;
      }
    }
    const siblingsWithName =
      parent?.children.filter((child) => child.name === tag.local).length ?? 0;
    const element: MutableElement = {
      name: tag.local,
      namespace: tag.uri,
      attributes,
      declaredNamespaces,
      children: [],
      text: "",
      line: startLine,
      column: startColumn,
      path: parent === undefined ? tag.local : `${parent.path}/${tag.local}`,
      xpath:
        parent === undefined
          ? `/${tag.local}`
          : `${parent.xpath}/${tag.local}[${String(siblingsWithName + 1)}]`,
      parent,
    };
    if (parent === undefined) {
      root = element;
    } else {
      parent.children.push(element);
    }
    stack.push(element);
  });
  parser.on("text", (text) => {
    const current = stack.at(-1);
    if (current !== undefined) {
      current.text += text;
    }
  });
  parser.on("cdata", (text) => {
    const current = stack.at(-1);
    if (current !== undefined) {
      current.text += text;
    }
  });
  parser.on("closetag", () => {
    stack.pop();
  });

  parser.write(decode(input)).close();
  if (failure !== undefined) {
    throw failure;
  }
  if (root === undefined) {
    throw new XmlParseError("The file contains no XML element.", 1, 1);
  }
  return root;
}

/** Direct children with the given local name. */
export function childrenNamed(element: XmlElement, name: string): XmlElement[] {
  return element.children.filter((child) => child.name === name);
}

/** The first direct child with the given local name. */
export function childNamed(element: XmlElement, name: string): XmlElement | undefined {
  return element.children.find((child) => child.name === name);
}

/** Every descendant (depth first, document order) with the given local name. */
export function descendantsNamed(element: XmlElement, name: string): XmlElement[] {
  const found: XmlElement[] = [];
  const visit = (node: XmlElement): void => {
    for (const child of node.children) {
      if (child.name === name) {
        found.push(child);
      }
      visit(child);
    }
  };
  visit(element);
  return found;
}

/** Every element of the tree in document order, root first. */
export function allElements(root: XmlElement): XmlElement[] {
  const all: XmlElement[] = [root];
  for (const child of root.children) {
    all.push(...allElements(child));
  }
  return all;
}

/** Trimmed text of the first child with the given name, or undefined. */
export function childText(element: XmlElement, name: string): string | undefined {
  return childNamed(element, name)?.text.trim();
}
