import { BaseReporter, formatError } from "./base";
import {
  FullResult,
  Reporter,
  TestCase,
  TestError,
  TestResult,
  TestStep,
} from "@playwright/test/reporter";
class MyReporter extends BaseReporter {
  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    process.stdout.write("\n");
    this.epilogue(true);
  }
}
export default MyReporter;
