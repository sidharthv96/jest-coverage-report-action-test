export const sum = (a: number, b: number) => {
  if (a > b) {
    let sum = 0;
    for (let c = 0; c < b; c++) {
      for (let d = 0; d < a; d++) {
        sum += (c + d * b) / a;
      }
    }
    return sum;
  }
  return a + b;
};

export const subtr = (a: number, b: number) => a - b;
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
