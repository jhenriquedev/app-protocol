/* ========================================================================== *
 * Example: user_register — Agentic Surface
 * --------------------------------------------------------------------------
 * Demonstrates a composed Case exposed to agents. Execution resolves to the
 * canonical API surface, which composes user_validate via ctx.cases.
 * ========================================================================== */

import {
  AgenticContext,
  AgenticDiscovery,
  AgenticExample,
  AgenticExecutionContext,
  AgenticMcpContract,
  AgenticPolicy,
  AgenticPrompt,
  AgenticRagContract,
  AgenticToolContract,
  BaseAgenticCase,
} from "../../../core/agentic.case";
import { ApiContext, ApiResponse } from "../../../core/api.case";
import { AppLogger } from "../../../core/shared/app_base_context";
import {
  AppCaseError,
  toAppCaseError,
} from "../../../core/shared/app_structural_contracts";
import { UserRegisterApi } from "./user_register.api.case";
import {
  UserRegisterDomain,
  UserRegisterInput,
  UserRegisterOutput,
} from "./user_register.domain.case";

type UserValidateInputLike = {
  email: string;
  name: string;
};

type UserValidateOutputLike = {
  valid: boolean;
  errors?: string[];
};

type UserRegisterCases = {
  users?: {
    user_validate?: {
      api?: {
        handler(
          input: UserValidateInputLike
        ): Promise<ApiResponse<UserValidateOutputLike>>;
      };
    };
    user_register?: {
      api?: {
        handler(
          input: UserRegisterInput
        ): Promise<ApiResponse<UserRegisterOutput>>;
      };
    };
  };
};

const testLogger: AppLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function validateUserForRegistration(
  input: UserValidateInputLike
): UserValidateOutputLike {
  const errors: string[] = [];

  if (!input.email.includes("@")) {
    errors.push("Invalid email format");
  }
  if (input.name.length < 2) {
    errors.push("Name must have at least 2 characters");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function createTestCases(correlationId: string): UserRegisterCases {
  const cases: UserRegisterCases = {
    users: {},
  };

  const registerCtx: ApiContext = {
    correlationId,
    logger: testLogger,
    cases,
  };

  cases.users!.user_validate = {
    api: {
      handler: async (
        input: UserValidateInputLike
      ): Promise<ApiResponse<UserValidateOutputLike>> => ({
        success: true,
        data: validateUserForRegistration(input),
      }),
    },
  };

  cases.users!.user_register = {
    api: new UserRegisterApi(registerCtx),
  };

  return cases;
}

function createTestContext(): AgenticContext {
  const correlationId = "agentic-test-user-register";

  return {
    correlationId,
    logger: testLogger,
    cases: createTestCases(correlationId),
  };
}

export class UserRegisterAgentic extends BaseAgenticCase<
  UserRegisterInput,
  UserRegisterOutput
> {
  protected domain(): UserRegisterDomain {
    return new UserRegisterDomain();
  }

  public discovery(): AgenticDiscovery {
    return {
      name: this.domainCaseName() ?? "user_register",
      description:
        this.domainDescription() ??
        "Register a new user through the canonical APP registration flow.",
      category: "users",
      tags: ["users", "registration", "creation"],
      aliases: ["register_user", "create_user_account"],
      capabilities: ["registration"],
      intents: ["create a new user", "register account"],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      requiresTenant: false,
      dependencies: [
        "user_register.domain",
        "user_register.api",
        "user_validate.api",
      ],
      preconditions: [
        "The email must pass canonical validation before persistence.",
      ],
      constraints: [
        "Execution must follow the canonical registration API flow.",
        "Do not bypass validation or persistence steps.",
      ],
      notes: [
        "This is a mutating capability.",
        "The API surface composes user_validate via ctx.cases.",
      ],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose:
        "Register a new user by validating input and persisting the user through the canonical API flow.",
      whenToUse: [
        "When a new account must be created.",
        "When the caller expects the registration flow to use canonical validation.",
      ],
      whenNotToUse: [
        "When only validation is needed without user creation.",
        "When updating an existing user.",
      ],
      constraints: [
        "Always execute through the canonical API surface.",
        "Treat this capability as mutating and potentially user-visible.",
      ],
      reasoningHints: [
        "Registration composes validation before persistence.",
        "Prefer explicit approval or confirmation in interactive contexts.",
      ],
      expectedOutcome:
        "A created user object with id, email, name, and createdAt timestamp.",
    };
  }

  public tool(): AgenticToolContract<UserRegisterInput, UserRegisterOutput> {
    const inputSchema = this.domainInputSchema();
    const outputSchema = this.domainOutputSchema();

    if (!inputSchema || !outputSchema) {
      throw new Error("user_register agentic requires domain schemas");
    }

    return {
      name: "user_register",
      description:
        "Register a new user through the canonical APP API composition flow.",
      inputSchema,
      outputSchema,
      isMutating: true,
      requiresConfirmation: true,
      execute: async (input, ctx) => {
        const cases = ctx.cases as UserRegisterCases | undefined;
        const result = await cases?.users?.user_register?.api?.handler(input);

        if (!result?.success || !result.data) {
          throw toAppCaseError(
            result?.error,
            "user_register API surface did not return data"
          );
        }

        return result.data;
      },
    };
  }

  public mcp(): AgenticMcpContract {
    return {
      enabled: true,
      name: "user_register",
      title: "User Register",
      description:
        "Register a user through the canonical APP user_register API composition flow.",
      metadata: {
        category: "users",
        mutating: true,
      },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["user_registration", "input_validation"],
      resources: [
        {
          kind: "case",
          ref: "users/user_register",
          description: "Canonical registration capability.",
        },
        {
          kind: "case",
          ref: "users/user_validate",
          description: "Validation dependency used by the registration flow.",
        },
      ],
      hints: [
        "Prefer canonical registration flow instead of partial direct mutations.",
      ],
      scope: "project",
      mode: "recommended",
    };
  }

  public policy(): AgenticPolicy {
    return {
      requireConfirmation: true,
      requireAuth: false,
      requireTenant: false,
      riskLevel: "medium",
      executionMode: "manual-approval",
    };
  }

  public examples(): AgenticExample<UserRegisterInput, UserRegisterOutput>[] {
    return super.examples();
  }

  public async test(): Promise<void> {
    this.validateDefinition();

    const definition = this.definition();

    if (definition.discovery.name !== "user_register") {
      throw new Error("Agentic discovery name mismatch for user_register");
    }

    const example = this.examples()[0];
    if (!example) {
      throw new Error("Expected user_register to expose at least one example");
    }

    const testInstance = new UserRegisterAgentic(createTestContext());
    const result = await testInstance.execute({
      email: "new@example.com",
      name: "New User",
      password: "securepass123",
    });

    if (!result.id || result.email !== "new@example.com") {
      throw new Error("Expected user_register agentic execution to create a user");
    }

    let propagatedError: unknown;
    try {
      await testInstance.execute({
        email: "",
        name: "",
        password: "",
      } as UserRegisterInput);
    } catch (error: unknown) {
      propagatedError = error;
    }

    if (!(propagatedError instanceof AppCaseError)) {
      throw new Error("Expected user_register to propagate AppCaseError failures");
    }
  }
}
