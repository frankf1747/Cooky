import { describe, expect, it } from "vitest";
import { toBase } from "./units";

describe("toBase", () => {
  it("converts pounds to grams, rounded to 0.01 g", () => {
    expect(toBase(1.32, "lb")).toEqual({ qty: 598.74, unit: "g" });
  });
  it("is case- and space-insensitive", () => {
    expect(toBase(2, " EA ")).toEqual({ qty: 2, unit: "count" });
    expect(toBase(1, "Fl Oz")).toEqual({ qty: 29.57, unit: "ml" });
  });
  it("converts kg, oz, l and passes g, ml, count through", () => {
    expect(toBase(1.5, "kg")).toEqual({ qty: 1500, unit: "g" });
    expect(toBase(16, "oz")).toEqual({ qty: 453.59, unit: "g" });
    expect(toBase(2, "l")).toEqual({ qty: 2000, unit: "ml" });
    expect(toBase(250, "g")).toEqual({ qty: 250, unit: "g" });
    expect(toBase(3, "count")).toEqual({ qty: 3, unit: "count" });
  });
  it("returns null for units it cannot convert instead of guessing", () => {
    expect(toBase(1, "bunch")).toBeNull();
    expect(toBase(1, "")).toBeNull();
    expect(toBase(1, "1.32 lb")).toBeNull();
  });
  it("returns null for a negative or non-finite quantity", () => {
    expect(toBase(-1, "g")).toBeNull();
    expect(toBase(Number.NaN, "g")).toBeNull();
  });
});
