/* ========================================================================== *
 * Example: user_register — Domain Surface
 * ========================================================================== */

import { AppSchema, BaseDomainCase } from "../../../core/domain.case";

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
}
