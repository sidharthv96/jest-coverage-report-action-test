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
    console.log(process.cwd());
    console.log(process.env);
    process.stdout.write("\n");
    this.epilogue(true);
  }
}
export default MyReporter;
