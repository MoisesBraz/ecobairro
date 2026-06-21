export interface TestCase {
  name: string;
  run: () => Promise<void> | void;
}

export async function runSuite(name: string, testCases: TestCase[]): Promise<number> {
  console.log(`\n${name}`);

  let failures = 0;

  for (const testCase of testCases) {
    try {
      await testCase.run();
      console.log(`  OK ${testCase.name}`);
    } catch (error) {
      failures += 1;
      console.error(`  FAIL ${testCase.name}`);
      console.error(formatError(error));
    }
  }

  return failures;
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }

  return String(error);
}
