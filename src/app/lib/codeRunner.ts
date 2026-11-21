import vm from "node:vm";

export interface ITestCaseItem {
	id?: string;
	input: any;
	expectedOutput?: any;
	output?: any;
	isHidden?: boolean;
	points?: number;
}

export interface ITestCaseExecutionResult {
	testCaseIndex: number;
	input: string;
	expectedOutput: string;
	actualOutput: string;
	passed: boolean;
	executionTimeMs: number;
	error: string | null;
	isHidden?: boolean;
}

export interface ICodeExecutionSummary {
	totalTestCases: number;
	passedTestCases: number;
	allPassed: boolean;
	averageExecutionTimeMs: number;
	results: ITestCaseExecutionResult[];
}

/**
 * Normalizes input to string format
 */
const normalizeInput = (input: any): string => {
	if (input === null || input === undefined) return "";
	if (typeof input === "object") {
		try {
			return JSON.stringify(input);
		} catch {
			return String(input);
		}
	}
	return String(input);
};

/**
 * Normalizes output string for comparison (trims whitespace and normalizes CRLF)
 */
const normalizeOutput = (val: any): string => {
	if (val === null || val === undefined) return "";
	if (typeof val === "object") {
		try {
			return JSON.stringify(val).trim();
		} catch {
			return String(val).trim();
		}
	}
	return String(val).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
};

/**
 * Runs a single code execution against one test case in a secure Node.js VM context
 */
export const runSingleTestCase = (
	userCode: string,
	rawInput: any,
	rawExpectedOutput: any,
	testCaseIndex = 1,
	isHidden = false,
	timeoutMs = 2500,
): ITestCaseExecutionResult => {
	const stringInput = normalizeInput(rawInput);
	const expected = normalizeOutput(rawExpectedOutput);

	let actualOutput = "";
	let executionError: string | null = null;

	// Capture output from console methods
	const captureLog = (...args: any[]) => {
		const formatted = args
			.map((arg) => {
				if (typeof arg === "object" && arg !== null) {
					try {
						return JSON.stringify(arg);
					} catch {
						return String(arg);
					}
				}
				return String(arg);
			})
			.join(" ");

		actualOutput += (actualOutput ? "\n" : "") + formatted;
	};

	// Safe sandbox environment with restricted globals
	const sandbox = {
		input: stringInput,
		console: {
			log: captureLog,
			info: captureLog,
			warn: captureLog,
			error: captureLog,
		},
		Math,
		JSON,
		Date,
		parseInt,
		parseFloat,
		Array,
		Object,
		String,
		Number,
		Boolean,
		RegExp,
		Map,
		Set,
		Promise,
		isNaN,
		isFinite,
		encodeURI,
		decodeURI,
	};

	const context = vm.createContext(sandbox);

	// Wrapper to allow both console output and returning from a solution() function
	const wrappedCode = `
    "use strict";
    ${userCode}

    if (typeof solution === "function") {
      try {
        let parsedInput = input;
        try {
          parsedInput = JSON.parse(input);
        } catch (_) {}
        const fnResult = solution(parsedInput);
        if (fnResult !== undefined && !${Boolean(actualOutput)}) {
          console.log(typeof fnResult === "object" ? JSON.stringify(fnResult) : fnResult);
        }
      } catch (err) {
        console.error(err.message || String(err));
      }
    } else if (typeof solve === "function") {
      try {
        let parsedInput = input;
        try {
          parsedInput = JSON.parse(input);
        } catch (_) {}
        const fnResult = solve(parsedInput);
        if (fnResult !== undefined && !${Boolean(actualOutput)}) {
          console.log(typeof fnResult === "object" ? JSON.stringify(fnResult) : fnResult);
        }
      } catch (err) {
        console.error(err.message || String(err));
      }
    }
  `;

	const startTime = process.hrtime.bigint();

	try {
		vm.runInContext(wrappedCode, context, {
			timeout: timeoutMs,
		});
	} catch (err: any) {
		if (err.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") {
			executionError = `Time Limit Exceeded (>${timeoutMs}ms)`;
		} else {
			executionError = err.message || String(err);
		}
	}

	const endTime = process.hrtime.bigint();
	const executionTimeMs = Number((endTime - startTime) / 1000000n);

	const normalizedActual = normalizeOutput(actualOutput);
	const passed = !executionError && normalizedActual === expected;

	return {
		testCaseIndex,
		input: stringInput,
		expectedOutput: expected,
		actualOutput: normalizedActual,
		passed,
		executionTimeMs,
		error: executionError,
		isHidden,
	};
};

/**
 * Runs a suite of test cases against the user's code
 */
export const executeCodeSuite = (
	userCode: string,
	testCases: ITestCaseItem[],
	_language = "javascript",
): ICodeExecutionSummary => {
	// If no test cases are provided, execute once with empty input to verify code compiles/runs
	if (!testCases || testCases.length === 0) {
		const singleResult = runSingleTestCase(userCode, "", "", 1, false);
		return {
			totalTestCases: 1,
			passedTestCases: singleResult.passed ? 1 : 0,
			allPassed: singleResult.passed,
			averageExecutionTimeMs: singleResult.executionTimeMs,
			results: [singleResult],
		};
	}

	const results: ITestCaseExecutionResult[] = [];
	let totalTime = 0;

	testCases.forEach((tc, index) => {
		const expected = tc.expectedOutput ?? tc.output ?? "";
		const result = runSingleTestCase(
			userCode,
			tc.input,
			expected,
			index + 1,
			Boolean(tc.isHidden),
		);
		results.push(result);
		totalTime += result.executionTimeMs;
	});

	const passedCount = results.filter((r) => r.passed).length;

	return {
		totalTestCases: results.length,
		passedTestCases: passedCount,
		allPassed: passedCount === results.length,
		averageExecutionTimeMs:
			results.length > 0 ? Math.round(totalTime / results.length) : 0,
		results,
	};
};
