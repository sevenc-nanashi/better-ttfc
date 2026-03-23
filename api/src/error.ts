export class UnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnreachableError";
  }
}

export class ExhaustiveError extends Error {
  constructor(value: never) {
    super(`Exhaustive check failed: ${JSON.stringify(value)}`);
    this.name = "ExhaustiveError";
  }
}
