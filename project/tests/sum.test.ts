import { sum, subtr } from "..";

describe("sum", () => {
  it("should sum", () => {
    expect(sum(1, 2)).toBe(3);
  });
  it("should diff", () => {
    expect(subtr(2, 1)).toBe(1);
  });
  // it("should sum false", () => {
  //   expect(sum(1, 2)).toBe(4);
  // });
  // it("should sum false3", () => {
  //   expect(sum(1, 2)).toBe(-1);
  // });
});
