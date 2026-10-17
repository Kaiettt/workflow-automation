export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ExpressionSyntaxError extends ExpressionError {}

export class NodeReferenceError extends ExpressionError {}

export class PairedItemError extends ExpressionError {}
