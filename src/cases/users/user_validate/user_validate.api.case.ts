/* ========================================================================== *
 * Example: user_validate — API Surface
 * ========================================================================== */

import { ApiContext, ApiResponse, BaseApiCase } from "../../../core/api.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import { UserValidateInput, UserValidateOutput } from "./user_validate.domain.case";

/* --------------------------------------------------------------------------
 * API Case
 * --------------------------------------------------------------------------
 * This is an atomic Case — uses _service, not _composition.
 * handler is the capability entrypoint (not an HTTP endpoint).
 * router() binds the capability to HTTP transport.
 * ------------------------------------------------------------------------ */

export class UserValidateApi extends BaseApiCase<
  UserValidateInput,
  UserValidateOutput
> {
  constructor(ctx: ApiContext) {
    super(ctx);
  }

  /* =======================================================================
   * Public — capability entrypoint
   * ===================================================================== */

  public async handler(
    input: UserValidateInput
  ): Promise<ApiResponse<UserValidateOutput>> {
    return this.execute(input);
  }

  /* =======================================================================
   * Public — transport binding
   * ===================================================================== */

  public router(): unknown {
    // Framework-specific — example with a generic router interface
    // In practice: app.post('/users/validate', async (req) => this.handler(req.body))
    return {
      method: "POST",
      path: "/users/validate",
      handler: (req: { body: UserValidateInput }) => this.handler(req.body),
    };
  }

  /* =======================================================================
   * Public — test
   * ===================================================================== */

  public async test(): Promise<void> {
    // Phase 1 — Slot availability
    if (!this._service) {
      throw new Error("test: _service must be implemented (atomic Case)");
    }

    // Phase 2 — Validation behavior
    await this._validate!({ email: "test@example.com", name: "Test User" });

    let threw = false;
    try { await this._validate!({ email: "", name: "" }); } catch { threw = true; }
    if (!threw) throw new Error("test: _validate should reject empty fields");

    // Phase 3 — Integrated execution
    const result = await this.handler({
      email: "test@example.com",
      name: "Test User",
      age: 25,
    });
    if (!result.success) throw new Error("test: handler returned failure");
    if (result.data?.valid !== true) throw new Error("test: valid input should return valid=true");
  }

  /* =======================================================================
   * Internal — canonical slots
   * ===================================================================== */

  protected async _validate(input: UserValidateInput): Promise<void> {
    const errors: string[] = [];
    if (!input.email) errors.push("email is required");
    if (!input.name) errors.push("name is required");
    if (errors.length > 0) {
      throw new AppCaseError("VALIDATION_FAILED", errors.join("; "), { errors });
    }
  }

  protected async _service(
    input: UserValidateInput
  ): Promise<UserValidateOutput> {
    const errors: string[] = [];

    if (!input.email.includes("@")) {
      errors.push("Invalid email format");
    }
    if (input.name.length < 2) {
      errors.push("Name must have at least 2 characters");
    }
    if (input.age !== undefined && (input.age < 0 || input.age > 150)) {
      errors.push("Age must be between 0 and 150");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
