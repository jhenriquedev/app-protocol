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
import {
  UserRegisterInput,
  UserRegisterOutput,
} from "./user_register.domain.case";

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

  public async test(
    input: UserRegisterInput
  ): Promise<ApiResponse<UserRegisterOutput>> {
    return this.handler(input);
  }

  /* =======================================================================
   * Internal — canonical slots
   * ===================================================================== */

  protected async _validate(input: UserRegisterInput): Promise<void> {
    if (!input.email) throw new Error("email is required");
    if (!input.name) throw new Error("name is required");
    if (!input.password) throw new Error("password is required");
  }

  protected async _authorize(): Promise<void> {
    // Registration is public — no auth required
  }

  /**
   * _service is abstract in BaseApiCase, but this is a composed Case.
   * We implement _service as a no-op fallback and use _composition as
   * the primary execution path.
   */
  protected async _service(
    _input: UserRegisterInput
  ): Promise<UserRegisterOutput> {
    throw new Error(
      "user_register is a composed Case — _composition should be used"
    );
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
    const validation = await this.ctx.cases?.users?.user_validate?.api?.handler({
      email: input.email,
      name: input.name,
    });

    if (!validation?.data?.valid) {
      throw new Error(
        `Validation failed: ${validation?.data?.errors?.join(", ")}`
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

  /**
   * Present — transforms output for API response.
   */
  protected async _present(
    output: UserRegisterOutput
  ): Promise<ApiResponse<UserRegisterOutput>> {
    return {
      success: true,
      data: output,
      statusCode: 201,
    };
  }
}
