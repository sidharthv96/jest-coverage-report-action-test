/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { codeFrameColumns } from "@babel/code-frame";
import colors from "colors/safe";
import fs from "fs";
// @ts-ignore
import milliseconds from "ms";
import path from "path";
import StackUtils from "stack-utils";
import {
  FullConfig,
  TestCase,
  Suite,
  TestResult,
  TestError,
  Reporter,
  FullResult,
  TestStep,
} from "@playwright/test/reporter";

const stackUtils = new StackUtils();

type TestResultOutput = { chunk: string | Buffer; type: "stdout" | "stderr" };
const kOutputSymbol = Symbol("output");

export class BaseReporter implements Reporter {
  duration = 0;
  config!: FullConfig;
  suite!: Suite;
  result!: FullResult;
  fileDurations = new Map<string, number>();
  monotonicStartTime: number = 0;
  private printTestOutput = !process.env.PWTEST_SKIP_TEST_OUTPUT;

  onBegin(config: FullConfig, suite: Suite) {
    this.monotonicStartTime = monotonicTime();
    this.config = config;
    this.suite = suite;
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    this._appendOutput({ chunk, type: "stdout" }, result);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    this._appendOutput({ chunk, type: "stderr" }, result);
  }

  private _appendOutput(
    output: TestResultOutput,
    result: TestResult | undefined
  ) {
    if (!result) return;
    (result as any)[kOutputSymbol] = (result as any)[kOutputSymbol] || [];
    (result as any)[kOutputSymbol].push(output);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const projectName = test.titlePath()[1];
    const relativePath = relativeTestPath(this.config, test);
    const fileAndProject =
      (projectName ? `[${projectName}] › ` : "") + relativePath;
    const duration = this.fileDurations.get(fileAndProject) || 0;
    this.fileDurations.set(fileAndProject, duration + result.duration);
  }

  onError(error: TestError) {
    console.log(formatError(error));
  }

  async onEnd(result: FullResult) {
    this.duration = monotonicTime() - this.monotonicStartTime;
    this.result = result;
  }

  private _printSlowTests() {
    if (!this.config.reportSlowTests) return;
    const fileDurations = [...this.fileDurations.entries()];
    fileDurations.sort((a, b) => b[1] - a[1]);
    const count = Math.min(
      fileDurations.length,
      this.config.reportSlowTests.max || Number.POSITIVE_INFINITY
    );
    for (let i = 0; i < count; ++i) {
      const duration = fileDurations[i][1];
      if (duration <= this.config.reportSlowTests.threshold) break;
      console.log(
        `::warning title=Slow Test::${fileDurations[i][0]} (${milliseconds(
          duration
        )})`
      );
    }
  }

  epilogue(full: boolean) {
    let skipped = 0;
    let expected = 0;
    const skippedWithError: TestCase[] = [];
    const unexpected: TestCase[] = [];
    const flaky: TestCase[] = [];

    this.suite.allTests().forEach((test) => {
      switch (test.outcome()) {
        case "skipped": {
          ++skipped;
          if (test.results.some((result) => !!result.error))
            skippedWithError.push(test);
          break;
        }
        case "expected":
          ++expected;
          break;
        case "unexpected":
          unexpected.push(test);
          break;
        case "flaky":
          flaky.push(test);
          break;
      }
    });

    const failuresToPrint = [...unexpected, ...flaky, ...skippedWithError];
    if (full && failuresToPrint.length) {
      console.log("");
      this._printFailures(failuresToPrint);
    }

    this._printSlowTests();

    console.log("");
    if (unexpected.length) {
      console.log(colors.red(`  ${unexpected.length} failed`));
      for (const test of unexpected)
        console.log(colors.red(formatTestHeader(this.config, test, "    ")));
    }
    if (flaky.length) {
      console.log(colors.yellow(`  ${flaky.length} flaky`));
      for (const test of flaky)
        console.log(colors.yellow(formatTestHeader(this.config, test, "    ")));
    }
    if (skipped) console.log(colors.yellow(`  ${skipped} skipped`));
    if (expected)
      console.log(
        colors.green(`  ${expected} passed`) +
          colors.dim(` (${milliseconds(this.duration)})`)
      );
    if (this.result.status === "timedout")
      console.log(
        colors.red(
          `  Timed out waiting ${
            this.config.globalTimeout / 1000
          }s for the entire test run`
        )
      );
  }

  private _printFailures(failures: TestCase[]) {
    failures.forEach((test, index) => {
      const annotations = formatFailure(
        this.config,
        test,
        index + 1,
        this.printTestOutput
      );
      annotations.forEach(({ filePath, title, message, position }) => {
        console.log(
          `::error file=${filePath},title=${title},line=${position.line},col=${
            position.column
          }::${message.replace(/\n/g, "%0A")}`
        );
      });
    });
  }

  willRetry(test: TestCase): boolean {
    return (
      test.outcome() === "unexpected" && test.results.length <= test.retries
    );
  }
}

export interface Annotation {
  filePath: string;
  title: string;
  message: string;
  position?: Position;
}

export function formatFailure(
  config: FullConfig,
  test: TestCase,
  index?: number,
  stdio?: boolean
): Annotation[] {
  const title = formatTestTitle(config, test);
  const filePath = path.relative(
    process.env["GITHUB_WORKSPACE"],
    test.location.file
  );
  const lines: string[] = [];
  const annotations: Annotation[] = [];
  lines.push(colors.red(formatTestHeader(config, test, "  ", index)));
  for (const result of test.results) {
    const failureDetails = formatResultFailure(test, result, "    ");
    const resultTokens = failureDetails.tokens;
    const position = failureDetails.position;
    if (!resultTokens.length) continue;
    if (result.retry) {
      lines.push("");
      lines.push(colors.gray(pad(`    Retry #${result.retry}`, "-")));
    }
    lines.push(...resultTokens);

    const output = ((result as any)[kOutputSymbol] || []) as TestResultOutput[];
    if (stdio && output.length) {
      const outputText = output
        .map(({ chunk, type }) => {
          const text = chunk.toString("utf8");
          if (type === "stderr") return colors.red(stripAnsiEscapes(text));
          return text;
        })
        .join("");
      lines.push("");
      lines.push(
        colors.gray(pad("--- Test output", "-")) +
          "\n\n" +
          outputText +
          "\n" +
          pad("", "-")
      );
    }

    lines.push("");
    annotations.push({
      filePath,
      position,
      title,
      message: resultTokens.join("\n"),
    });
  }

  return annotations;
}

interface FailureDetails {
  position?: Position;
  tokens: string[];
}
export function formatResultFailure(
  test: TestCase,
  result: TestResult,
  initialIndent: string
): FailureDetails {
  const resultTokens: string[] = [];
  if (result.status === "timedOut") {
    resultTokens.push("");
    resultTokens.push(
      indent(
        colors.red(`Timeout of ${test.timeout}ms exceeded.`),
        initialIndent
      )
    );
  }
  if (result.status === "passed" && test.expectedStatus === "failed") {
    resultTokens.push("");
    resultTokens.push(
      indent(colors.red(`Expected to fail, but passed.`), initialIndent)
    );
  }
  let error: ErrorDetails;
  if (result.error !== undefined) {
    error = formatError(result.error, test.location.file);
    resultTokens.push(indent(error.message, initialIndent));
  }
  return {
    tokens: resultTokens,
    position: error?.position,
  };
}

function relativeTestPath(config: FullConfig, test: TestCase): string {
  return (
    path.relative(config.rootDir, test.location.file) ||
    path.basename(test.location.file)
  );
}

function stepSuffix(step: TestStep | undefined) {
  const stepTitles = step ? step.titlePath() : [];
  return stepTitles.map((t) => " › " + t).join("");
}

export function formatTestTitle(
  config: FullConfig,
  test: TestCase,
  step?: TestStep
): string {
  // root, project, file, ...describes, test
  const [, projectName, , ...titles] = test.titlePath();
  const location = `${relativeTestPath(config, test)}:${test.location.line}:${
    test.location.column
  }`;
  const projectTitle = projectName ? `[${projectName}] › ` : "";
  return `${projectTitle}${location} › ${titles.join(" ")}${stepSuffix(step)}`;
}

function formatTestHeader(
  config: FullConfig,
  test: TestCase,
  indent: string,
  index?: number
): string {
  const title = formatTestTitle(config, test);
  const header = `${indent}${index ? index + ") " : ""}${title}`;
  return pad(header, "=");
}

interface ErrorDetails {
  position: Position;
  message: string;
}

export function formatError(error: TestError, file?: string): ErrorDetails {
  const stack = error.stack;
  const tokens = [];
  let position: Position;
  if (stack) {
    tokens.push("");
    const lines = stack.split("\n");
    let firstStackLine = lines.findIndex((line) => line.startsWith("    at "));
    if (firstStackLine === -1) firstStackLine = lines.length;
    tokens.push(lines.slice(0, firstStackLine).join("\n"));
    const stackLines = lines.slice(firstStackLine);
    position = file ? positionInFile(stackLines, file) : null;
    tokens.push("::group::Stack");

    if (position) {
      const source = fs.readFileSync(file!, "utf8");
      tokens.push("");
      tokens.push(
        codeFrameColumns(
          source,
          { start: position },
          { highlightCode: colors.enabled }
        )
      );
    }
    tokens.push("");
    tokens.push(colors.dim(stackLines.join("\n")));
    tokens.push("::endgroup::");
  } else if (error.message) {
    tokens.push("");
    tokens.push(error.message);
  } else {
    tokens.push("");
    tokens.push(error.value);
  }
  return {
    position,
    message: tokens.join("\n"),
  };
}

function pad(line: string, char: string): string {
  if (line) line += " ";
  return line + colors.gray(char.repeat(Math.max(0, 100 - line.length)));
}

function indent(lines: string, tab: string) {
  return lines.replace(/^(?=.+$)/gm, tab);
}

interface Position {
  column: number;
  line: number;
}

function positionInFile(
  stackLines: string[],
  file: string
): Position | undefined {
  // Stack will have /private/var/folders instead of /var/folders on Mac.
  file = fs.realpathSync(file);
  for (const line of stackLines) {
    const parsed = stackUtils.parseLine(line);
    if (!parsed || !parsed.file) continue;
    if (path.resolve(process.cwd(), parsed.file) === file)
      return { column: parsed.column || 0, line: parsed.line || 0 };
  }
}

function monotonicTime(): number {
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1000 + ((nanoseconds / 1000000) | 0);
}

const asciiRegex = new RegExp(
  "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
  "g"
);
export function stripAnsiEscapes(str: string): string {
  return str.replace(asciiRegex, "");
}
