/* ========================================================================== *
 * Example: user_validate — Domain Surface
 * ========================================================================== */

import { AppSchema, BaseDomainCase, DomainExample } from "../../../core/domain.case";

/* --------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------ */

export interface UserValidateInput {
  email: string;
  name: string;
  age?: number;
}

export interface UserValidateOutput {
  valid: boolean;
  errors: string[];
}

/* --------------------------------------------------------------------------
 * Domain Case
 * ------------------------------------------------------------------------ */

export class UserValidateDomain extends BaseDomainCase<
  UserValidateInput,
  UserValidateOutput
> {
  caseName(): string {
    return "user_validate";
  }

  description(): string {
    return "Validates user input data: email format, name length, and optional age constraints.";
  }

  inputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        email: { type: "string" },
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["email", "name"],
    };
  }

  outputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        valid: { type: "boolean" },
        errors: { type: "array", items: { type: "string" } },
      },
      required: ["valid", "errors"],
    };
  }

  validate(input: UserValidateInput): void {
    if (!input.email || typeof input.email !== "string") {
      throw new Error("email is required and must be a string");
    }
    if (!input.name || typeof input.name !== "string") {
      throw new Error("name is required and must be a string");
    }
  }

  invariants(): string[] {
    return [
      "Email must be a valid format (contains @)",
      "Name must have at least 2 characters",
      "Age, if provided, must be between 0 and 150",
    ];
  }

  examples(): DomainExample<UserValidateInput, UserValidateOutput>[] {
    return [
      {
        name: "valid_user",
        description: "A valid user input",
        input: { email: "john@example.com", name: "John Doe", age: 30 },
        output: { valid: true, errors: [] },
      },
      {
        name: "invalid_email",
        description: "An invalid email format",
        input: { email: "not-an-email", name: "Jane" },
        output: { valid: false, errors: ["Invalid email format"] },
      },
    ];
  }

  async test(): Promise<void> {
    // Phase 1 — Definition integrity
    const def = this.definition();
    if (!def.caseName) throw new Error("test: caseName is empty");
    if (!def.description) throw new Error("test: description is empty");
    if (!def.inputSchema.properties) throw new Error("test: inputSchema has no properties");
    if (!def.outputSchema.properties) throw new Error("test: outputSchema has no properties");

    // Phase 2 — Validation behavior
    this.validate!({ email: "test@example.com", name: "Test User" });

    let threw = false;
    try { this.validate!({ email: "", name: "" } as UserValidateInput); } catch { threw = true; }
    if (!threw) throw new Error("test: validate should reject empty fields");

    // Phase 3 — Examples consistency
    const examples = this.examples();
    if (!examples || examples.length === 0) throw new Error("test: no examples defined");
    for (const ex of examples) {
      const output = ex.output as UserValidateOutput | undefined;
      if (output?.valid) {
        // Valid examples should pass validation without throwing
        this.validate!(ex.input);
      }
    }
  }
}
