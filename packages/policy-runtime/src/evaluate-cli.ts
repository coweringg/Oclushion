import { policyEvaluationContextSchema } from "@oclushion/shared";

import { compileSnapshot, evaluatePolicy } from "./index.js";

let serializedInput = "";
for await (const chunk of process.stdin) {
  serializedInput += String(chunk);
}

const input = JSON.parse(serializedInput) as {
  snapshot: unknown;
  context: unknown;
};
const snapshot = compileSnapshot(input.snapshot);
const context = policyEvaluationContextSchema.parse(input.context);
const decision = evaluatePolicy(snapshot, context);

process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
