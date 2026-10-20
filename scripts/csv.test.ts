import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a header and rows into objects", () => {
    expect(parseCsv("a,b\n1,2\n3,4\n")).toEqual([{ a: "1", b: "2" }, { a: "3", b: "4" }]);
  });
  it("handles quoted fields with commas, quotes and newlines", () => {
    expect(parseCsv('id,text\n1,"Stir, then ""taste"".\nServe."\n')).toEqual([{ id: "1", text: 'Stir, then "taste".\nServe.' }]);
  });
  it("accepts CRLF line endings and skips blank lines", () => {
    expect(parseCsv("a,b\r\n1,2\r\n\r\n")).toEqual([{ a: "1", b: "2" }]);
  });
  it("throws on a row with the wrong number of fields, naming the line", () => {
    expect(() => parseCsv("a,b\n1,2,3\n")).toThrow(/line 2/);
  });
});
