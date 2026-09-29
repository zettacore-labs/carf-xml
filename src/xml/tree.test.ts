import { describe, expect, it } from "vitest";

import {
  allElements,
  childNamed,
  childrenNamed,
  childText,
  descendantsNamed,
  parseXml,
  XmlParseError,
} from "./tree.js";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<a:Root xmlns:a="urn:x" xmlns="urn:default" v="1">
  <a:Child>one</a:Child>
    <a:Child x="2"/><a:Other><![CDATA[c<d]]></a:Other>
  <Plain>p &amp; q</Plain>
</a:Root>
`;

describe("parseXml", () => {
  const root = parseXml(XML);

  it("keeps names, namespaces, attributes and declared namespaces", () => {
    expect(root.name).toBe("Root");
    expect(root.namespace).toBe("urn:x");
    expect(root.attributes).toEqual({ v: "1" });
    expect(root.declaredNamespaces).toEqual({ a: "urn:x", "": "urn:default" });
    expect(childNamed(root, "Plain")?.namespace).toBe("urn:default");
  });

  it("records the line and column of each start tag", () => {
    expect(allElements(root).map((e) => [e.name, e.line, e.column])).toEqual([
      ["Root", 2, 1],
      ["Child", 3, 3],
      ["Child", 4, 5],
      ["Other", 4, 21],
      ["Plain", 5, 3],
    ]);
  });

  it("builds paths and positional XPaths", () => {
    const [first, second] = childrenNamed(root, "Child");
    expect(first?.xpath).toBe("/Root/Child[1]");
    expect(second?.xpath).toBe("/Root/Child[2]");
    expect(second?.path).toBe("Root/Child");
    expect(second?.parent).toBe(root);
  });

  it("reads text, CDATA and entities", () => {
    expect(childText(root, "Child")).toBe("one");
    expect(childText(root, "Other")).toBe("c<d");
    expect(childText(root, "Plain")).toBe("p & q");
    expect(childText(root, "Missing")).toBeUndefined();
    expect(descendantsNamed(root, "Child")).toHaveLength(2);
  });

  it("parses bytes as UTF-8 and rejects invalid UTF-8", () => {
    expect(parseXml(Buffer.from("<r>é</r>", "utf8")).text).toBe("é");
    expect(() =>
      parseXml(Uint8Array.from([0x3c, 0x72, 0x3e, 0xff, 0x3c, 0x2f, 0x72, 0x3e])),
    ).toThrow(/not valid UTF-8/);
  });

  it("reports malformed XML with its position", () => {
    try {
      parseXml("<a>\n<b></a>");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(XmlParseError);
      expect((error as XmlParseError).line).toBe(2);
    }
    expect(() => parseXml("   ")).toThrow(XmlParseError);
  });

  it("does not expand external entities", () => {
    expect(() =>
      parseXml('<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>'),
    ).toThrow(/undefined entity/);
  });
});
