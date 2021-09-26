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
import {
  monotonicTime,
  relativeTestPath,
  Position,
  pad,
  stripAnsiEscapes,
  indent,
  stepSuffix,
  positionInFile,
  formatTestHeader,
  BaseReporter,
} from "./base";

const stackUtils = new StackUtils();

type TestResultOutput = { chunk: string | Buffer; type: "stdout" | "stderr" };
const kOutputSymbol = Symbol("output");

type GithubLogType = "debug" | "notice" | "warning" | "error";
interface GithubLogOptions {
  title?: string;
  file?: string;
  col?: number;
  endColumn?: number;
  line?: number;
  endLine?: number;
}

class GithubLogger {
  shouldLog = true;
  isCI: boolean = process.env.CI === "true";
  isGithubAction: boolean = process.env.GITHUB_ACTION !== undefined;

  log(
    message: string,
    type: GithubLogType = "notice",
    options: GithubLogOptions = {}
  ) {
    if (this.shouldLog) {
      if (this.isGithubAction) {
        message = message.replace(/\n/g, "%0A");
      }
      const configs = Object.entries(options)
        .map(([key, option]) => `${key}=${option}`)
        .join(",");
      console.log(`::${type} ${configs}::${message}`);
    }
  }

  debug(message: string, options?: GithubLogOptions) {
    this.log(message, "debug", options);
  }

  error(message: string, options?: GithubLogOptions) {
    this.log(message, "error", options);
  }

  notice(message: string, options?: GithubLogOptions) {
    this.log(message, "notice", options);
  }

  warning(message: string, options?: GithubLogOptions) {
    this.log(message, "warning", options);
  }
}

export class GithubReporter extends BaseReporter {
  githubLogger = new GithubLogger();

  override async onEnd(result: FullResult) {
    this.duration = monotonicTime() - this.monotonicStartTime;
    this.result = result;
    this.epilogue(true);
  }

  // private _printSlowTests() {
  //   if (!this.config.reportSlowTests) return;
  //   const fileDurations = [...this.fileDurations.entries()];
  //   fileDurations.sort((a, b) => b[1] - a[1]);
  //   const count = Math.min(
  //     fileDurations.length,
  //     this.config.reportSlowTests.max || Number.POSITIVE_INFINITY
  //   );
  //   for (let i = 0; i < count; ++i) {
  //     const duration = fileDurations[i][1];
  //     if (duration <= this.config.reportSlowTests.threshold) break;
  //     console.log(
  //       `::warning title=Slow Test::${fileDurations[i][0]} (${milliseconds(
  //         duration
  //       )})`
  //     );
  //   }
  // }

  override epilogue(full: boolean) {
    let expected = 0;
    const skippedWithError: TestCase[] = [];
    const unexpected: TestCase[] = [];
    const flaky: TestCase[] = [];

    this.suite.allTests().forEach((test) => {
      switch (test.outcome()) {
        case "skipped": {
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
      this._printFailureAnnotations(failuresToPrint);
    }

    this.githubLogger.notice("Hello world Test");

    // this._printSlowTests();
  }

  private _printFailureAnnotations(failures: TestCase[]) {
    failures.forEach((test, index) => {
      const annotations = formatFailure(this.config, test, index + 1, true);
      annotations.forEach(({ filePath, title, message, position }) => {
        this.githubLogger.error(message, {
          file: filePath,
          title,
          line: position.line,
          col: position.column,
        });
      });
    });
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
    process.env["GITHUB_WORKSPACE"] ?? "",
    test.location.file
  );
  const annotations: Annotation[] = [];
  for (const result of test.results) {
    const lines: string[] = [];
    lines.push(colors.red(formatTestHeader(config, test, "  ", index)));
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
      message: lines.join("\n"),
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

export default GithubReporter;
