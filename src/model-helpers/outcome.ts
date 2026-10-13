/**
 * What a Model Helper returns for an expected failure: a reason code, never a sentence.
 * The controller turns the code into the message the user sees.
 */
export type Outcome<Reason extends string, Data extends object = object> =
  ({ ok: true } & Data) | { ok: false; reason: Reason };

export const fail = <Reason extends string>(reason: Reason) => ({ ok: false, reason }) as const;
