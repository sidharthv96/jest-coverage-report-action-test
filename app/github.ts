import { BaseReporter, formatError } from "./base";
import {
  Reporter,
  TestCase,
  TestError,
  TestResult,
  TestStep,
} from "@playwright/test/reporter";
class MyReporter extends BaseReporter {
  onError(error: TestError) {
    console.log("KOOOPPPPP");
    console.log(formatError(error));
  }
}
export default MyReporter;
