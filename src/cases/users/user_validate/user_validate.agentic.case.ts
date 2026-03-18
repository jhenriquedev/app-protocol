/* ========================================================================== *
 * Example: user_validate — Agentic Surface
 * --------------------------------------------------------------------------
 * Demonstrates domain-derived agentic metadata and canonical tool execution
 * through the API surface.
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
import { UserValidateApi } from "./user_validate.api.case";
import {
  UserValidateDomain,
  UserValidateInput,
  UserValidateOutput,
} from "./user_validate.domain.case";

type UserValidateCases = {
  users?: {
    user_validate?: {
      api?: {
        handler(
          input: UserValidateInput
        ): Promise<ApiResponse<UserValidateOutput>>;
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

function createTestCases(correlationId: string): UserValidateCases {
  const apiCtx: ApiContext = {
    correlationId,
    logger: testLogger,
  };

  const cases: UserValidateCases = {
    users: {
      user_validate: {
        api: new UserValidateApi(apiCtx),
      },
    },
  };

  apiCtx.cases = cases;

  return cases;
}

function createTestContext(): AgenticContext {
  const correlationId = "agentic-test-user-validate";

  return {
    correlationId,
    logger: testLogger,
    cases: createTestCases(correlationId),
  };
}

export class UserValidateAgentic extends BaseAgenticCase<
  UserValidateInput,
  UserValidateOutput
> {
  protected domain(): UserValidateDomain {
    return new UserValidateDomain();
  }

  public discovery(): AgenticDiscovery {
    return {
      name: this.domainCaseName() ?? "user_validate",
      description:
        this.domainDescription() ??
        "Validate user input data before downstream operations.",
      category: "users",
      tags: ["users", "validation", "input"],
      aliases: ["validate_user", "user_input_validate"],
      capabilities: ["validation"],
      intents: ["validate user payload", "check user form data"],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      requiresTenant: false,
      dependencies: ["user_validate.domain", "user_validate.api"],
      constraints: [
        "Use the canonical API surface for execution.",
        "Do not infer validation rules beyond the domain and API implementation.",
      ],
      notes: [
        "This capability is safe for direct execution.",
        "Validation is pure from the caller perspective and does not mutate state.",
      ],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose:
        "Validate user input fields such as email, name, and optional age.",
      whenToUse: [
        "Before creating or updating a user.",
        "When a UI or workflow needs deterministic validation feedback.",
      ],
      whenNotToUse: [
        "When you need to persist or register a user.",
        "When you need authentication or tenant checks.",
      ],
      constraints: [
        "Return canonical validation feedback from the API surface.",
      ],
      reasoningHints: [
        "Treat invalid input as a business result, not an inferred rule.",
      ],
      expectedOutcome:
        "A structured validation result with valid boolean and error list.",
    };
  }

  public tool(): AgenticToolContract<UserValidateInput, UserValidateOutput> {
    const inputSchema = this.domainInputSchema();
    const outputSchema = this.domainOutputSchema();

    if (!inputSchema || !outputSchema) {
      throw new Error("user_validate agentic requires domain schemas");
    }

    return {
      name: "user_validate",
      description:
        "Validate user input data through the canonical APP API surface.",
      inputSchema,
      outputSchema,
      isMutating: false,
      requiresConfirmation: false,
      execute: async (input, ctx) => {
        const cases = ctx.cases as UserValidateCases | undefined;
        const result = await cases?.users?.user_validate?.api?.handler(input);

        if (!result?.success || !result.data) {
          throw toAppCaseError(
            result?.error,
            "user_validate API surface did not return data"
          );
        }

        return result.data;
      },
    };
  }

  public mcp(): AgenticMcpContract {
    return {
      enabled: true,
      name: "user_validate",
      title: "User Validate",
      description:
        "Validate user input through the canonical APP user_validate API flow.",
      metadata: {
        category: "users",
        safe: true,
      },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["user_validation", "input_validation"],
      resources: [
        {
          kind: "case",
          ref: "users/user_validate",
          description: "Canonical validation capability for user payloads.",
        },
      ],
      hints: [
        "Prefer canonical APP validation over inferred heuristics.",
      ],
      scope: "case-local",
      mode: "optional",
    };
  }

  public policy(): AgenticPolicy {
    return {
      requireConfirmation: false,
      requireAuth: false,
      requireTenant: false,
      riskLevel: "low",
      executionMode: "direct-execution",
    };
  }

  public examples(): AgenticExample<UserValidateInput, UserValidateOutput>[] {
    return super.examples();
  }

  public async test(): Promise<void> {
    this.validateDefinition();

    const definition = this.definition();

    if (definition.discovery.name !== "user_validate") {
      throw new Error("Agentic discovery name mismatch for user_validate");
    }

    const example = this.examples()[0];
    if (!example) {
      throw new Error("Expected user_validate to expose at least one example");
    }

    const testInstance = new UserValidateAgentic(createTestContext());
    const result = await testInstance.execute({
      email: "john@example.com",
      name: "John Doe",
      age: 30,
    });

    if (!result.valid || result.errors.length !== 0) {
      throw new Error("Expected user_validate agentic execution to succeed");
    }

    let propagatedError: unknown;
    try {
      await testInstance.execute({
        email: "",
        name: "",
      } as UserValidateInput);
    } catch (error: unknown) {
      propagatedError = error;
    }

    if (!(propagatedError instanceof AppCaseError)) {
      throw new Error("Expected user_validate to propagate AppCaseError failures");
    }
  }
}
