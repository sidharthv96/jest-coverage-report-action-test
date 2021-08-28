import { sum } from "..";

describe("another sum", () => {
  it("should sum", () => {
    expect(sum(1, 2)).toBe(3);
  });
  it("should not sum false", () => {
    expect(sum(1, 2)).toBe(4);
  });
  it("should test sum false3", () => {
    expect(sum(1, 2)).toBe(-1);
  });
});
