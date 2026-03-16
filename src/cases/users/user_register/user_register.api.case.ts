/* ========================================================================== *
 * Example: user_register — API Surface
 * --------------------------------------------------------------------------
 * This is a composed Case — it uses _composition to orchestrate:
 * 1. Validate input via ctx.cases (user_validate)
 * 2. Persist user via _repository
 * 3. Return the created user
 *
 * Note: the stream event emission happens in a separate stream surface,
 * not inside the API surface. The API returns the result; the event
 * is published by the host/adapter or by the stream surface reacting
 * to the same operation.
 * ========================================================================== */

import { ApiContext, ApiResponse, BaseApiCase } from "../../../core/api.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import {
  UserRegisterInput,
  UserRegisterOutput,
} from "./user_register.domain.case";

/* --------------------------------------------------------------------------
 * Composition dependency — local type for cross-case access.
 *
 * O Case declara apenas o shape que precisa de ctx.cases, sem importar
 * de apps/. Isso preserva a direção de dependência: apps → cases → core.
 * O tipo real (BackendCasesMap) é derivado do registry pelo host; aqui
 * definimos apenas o contrato esperado pelo _composition.
 * ------------------------------------------------------------------------ */
type UserValidateApiLike = {
  handler(input: {
    email: string;
    name: string;
  }): Promise<ApiResponse<{ valid: boolean; errors?: string[] }>>;
};

type ExpectedCasesMap = {
  users?: {
    user_validate?: {
      api?: UserValidateApiLike;
    };
  };
};

/* --------------------------------------------------------------------------
 * API Case
 * ------------------------------------------------------------------------ */

export class UserRegisterApi extends BaseApiCase<
  UserRegisterInput,
  UserRegisterOutput
> {
  constructor(ctx: ApiContext) {
    super(ctx);
  }

  /* =======================================================================
   * Public — capability entrypoint
   * ===================================================================== */

  public async handler(
    input: UserRegisterInput
  ): Promise<ApiResponse<UserRegisterOutput>> {
    return this.execute(input);
  }

  /* =======================================================================
   * Public — transport binding
   * ===================================================================== */

  public router(): unknown {
    return {
      method: "POST",
      path: "/users/register",
      handler: (req: { body: UserRegisterInput }) => this.handler(req.body),
    };
  }

  /* =======================================================================
   * Public — test
   * ===================================================================== */

  public async test(): Promise<void> {
    // Phase 1 — Slot availability
    if (!this._composition) {
      throw new Error("test: _composition must be implemented (composed Case)");
    }

    // Phase 2 — Validation behavior
    await this._validate!({ email: "test@example.com", name: "Test User", password: "SecureP@ss1" });

    let threw = false;
    try { await this._validate!({ email: "", name: "", password: "" }); } catch { threw = true; }
    if (!threw) throw new Error("test: _validate should reject empty fields");

    await this._authorize!();

    // Phase 3 — Integrated execution
    const result = await this.handler({
      email: "test@example.com",
      name: "Test User",
      password: "SecureP@ss1",
    });
    if (!result.success) throw new Error("test: handler returned failure");
    if (!result.data?.id) throw new Error("test: handler response missing id");
    if (!result.data?.email) throw new Error("test: handler response missing email");
  }

  /* =======================================================================
   * Internal — canonical slots
   * ===================================================================== */

  protected async _validate(input: UserRegisterInput): Promise<void> {
    const errors: string[] = [];
    if (!input.email) errors.push("email is required");
    if (!input.name) errors.push("name is required");
    if (!input.password) errors.push("password is required");
    if (errors.length > 0) {
      throw new AppCaseError("VALIDATION_FAILED", errors.join("; "), { errors });
    }
  }

  protected async _authorize(): Promise<void> {
    // Registration is public — no auth required
  }

  /**
   * Composition — orchestrates cross-case via ctx.cases.
   *
   * 1. Validates via user_validate Case
   * 2. Persists via _repository
   */
  protected async _composition(
    input: UserRegisterInput
  ): Promise<UserRegisterOutput> {
    // Step 1: validate via user_validate Case (cross-case composition)
    // Cast ctx.cases to the expected shape — defined locally, not imported from apps/.
    const cases = this.ctx.cases as ExpectedCasesMap | undefined;

    const validation = await cases?.users?.user_validate?.api?.handler({
      email: input.email,
      name: input.name,
    });

    if (!validation?.data?.valid) {
      throw new AppCaseError(
        "COMPOSITION_FAILED",
        `Validation failed: ${validation?.data?.errors?.join(", ")}`,
        { errors: validation?.data?.errors }
      );
    }

    // Step 2: persist via _repository
    const user = await this._persist(input);

    return user;
  }

  /**
   * Repository — persistence.
   */
  protected _repository(): unknown {
    return this.ctx.db;
  }

  /**
   * Internal helper for persistence (called by _composition).
   */
  private async _persist(
    input: UserRegisterInput
  ): Promise<UserRegisterOutput> {
    // In practice: hash password, insert into DB, return created user
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

    return {
      id,
      email: input.email,
      name: input.name,
      createdAt: new Date().toISOString(),
    };
  }
}
