/* ========================================================================== *
 * Example: user_register — Domain Surface
 * ========================================================================== */

import { AppSchema, BaseDomainCase, DomainExample } from "../../../core/domain.case";

/* --------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------ */

export interface UserRegisterInput {
  email: string;
  name: string;
  password: string;
}

export interface UserRegisterOutput {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

/* --------------------------------------------------------------------------
 * Domain Case
 * ------------------------------------------------------------------------ */

export class UserRegisterDomain extends BaseDomainCase<
  UserRegisterInput,
  UserRegisterOutput
> {
  caseName(): string {
    return "user_register";
  }

  description(): string {
    return "Registers a new user: validates input, persists to database, and emits a registration event.";
  }

  inputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        email: { type: "string" },
        name: { type: "string" },
        password: { type: "string" },
      },
      required: ["email", "name", "password"],
    };
  }

  outputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        id: { type: "string" },
        email: { type: "string" },
        name: { type: "string" },
        createdAt: { type: "string" },
      },
      required: ["id", "email", "name", "createdAt"],
    };
  }

  validate(input: UserRegisterInput): void {
    if (!input.email?.includes("@")) {
      throw new Error("Invalid email format");
    }
    if (!input.name || input.name.length < 2) {
      throw new Error("Name must have at least 2 characters");
    }
    if (!input.password || input.password.length < 8) {
      throw new Error("Password must have at least 8 characters");
    }
  }

  invariants(): string[] {
    return [
      "Email must be unique in the system",
      "Password must be hashed before persistence",
      "A user_registered event must be emitted after successful registration",
    ];
  }

  examples(): DomainExample<UserRegisterInput, UserRegisterOutput>[] {
    return [
      {
        name: "valid_registration",
        description: "A valid user registration",
        input: { email: "john@example.com", name: "John Doe", password: "SecureP@ss1" },
        output: { id: "generated", email: "john@example.com", name: "John Doe", createdAt: "2026-01-01T00:00:00Z" },
      },
      {
        name: "invalid_email",
        description: "Registration with invalid email",
        input: { email: "not-an-email", name: "Jane", password: "SecureP@ss1" },
        notes: ["Should throw: Invalid email format"],
      },
      {
        name: "short_password",
        description: "Registration with short password",
        input: { email: "jane@example.com", name: "Jane Doe", password: "123" },
        notes: ["Should throw: Password must have at least 8 characters"],
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
    this.validate!({ email: "test@example.com", name: "Test User", password: "SecureP@ss1" });

    let threw = false;
    try { this.validate!({ email: "bad", name: "T", password: "short" }); } catch { threw = true; }
    if (!threw) throw new Error("test: validate should reject invalid input");

    // Phase 3 — Examples consistency
    const examples = this.examples();
    if (!examples || examples.length === 0) throw new Error("test: no examples defined");
    for (const ex of examples) {
      if (!ex.notes) {
        // Examples without notes are valid inputs — should pass validation
        this.validate!(ex.input);
      } else {
        // Examples with notes are error cases — should throw
        let exThrew = false;
        try { this.validate!(ex.input); } catch { exThrew = true; }
        if (!exThrew) throw new Error(`test: example '${ex.name}' should throw but didn't`);
      }
    }
  }
}
