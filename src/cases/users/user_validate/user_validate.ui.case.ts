/* ========================================================================== *
 * Example: user_validate — UI Surface
 * ========================================================================== */

import { BaseUiCase, UiContext, UIState } from "../../../core/ui.case";
import { UserValidateInput, UserValidateOutput } from "./user_validate.domain.case";

/* --------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------ */

interface UserValidateState extends UIState {
  email: string;
  name: string;
  age: string;
  result: UserValidateOutput | null;
  loading: boolean;
  error: string | null;
}

/* --------------------------------------------------------------------------
 * UI Case
 * --------------------------------------------------------------------------
 * Grammar: view <-> _viewmodel <-> _service <-> _repository
 *
 * This view is a self-contained validation form.
 * Framework lifecycle (render, mount, dismount) is internal to view().
 * ------------------------------------------------------------------------ */

export class UserValidateUi extends BaseUiCase<UserValidateState> {
  constructor(ctx: UiContext) {
    super(ctx, {
      email: "",
      name: "",
      age: "",
      result: null,
      loading: false,
      error: null,
    });
  }

  /* =======================================================================
   * Public — visual entrypoint
   * ===================================================================== */

  public view(): unknown {
    const vm = this._viewmodel();

    // Framework-agnostic structure — in practice this returns JSX, HTML, etc.
    return {
      type: "form",
      fields: vm.fields,
      submitLabel: vm.submitLabel,
      feedback: vm.feedback,
      onSubmit: () => this._service(),
    };
  }

  /* =======================================================================
   * Public — test
   * ===================================================================== */

  public async test(): Promise<void> {
    const previousApi = this.ctx.api;
    this.ctx.api = {
      request: async () => ({
        valid: true,
        errors: [],
      }),
    };

    this.setState({ email: "test@example.com", name: "Test User", age: "25" });

    try {
      await this._service();
      const vm = this._viewmodel();
      if (!vm.feedback || vm.feedback.type !== "success") {
        throw new Error("Expected validation to succeed for valid input");
      }
    } finally {
      this.ctx.api = previousApi;
    }
  }

  /* =======================================================================
   * Internal — canonical slots
   * ===================================================================== */

  /**
   * Viewmodel — transforms state into presentation model.
   */
  protected _viewmodel() {
    const { email, name, age, result, loading, error } = this.state;

    return {
      fields: [
        { name: "email", value: email, label: "Email", type: "email" },
        { name: "name", value: name, label: "Name", type: "text" },
        { name: "age", value: age, label: "Age (optional)", type: "number" },
      ],
      submitLabel: loading ? "Validating..." : "Validate",
      feedback: error
        ? { type: "error" as const, message: error }
        : result
          ? result.valid
            ? { type: "success" as const, message: "User data is valid" }
            : {
                type: "error" as const,
                message: result.errors.join(", "),
              }
          : null,
    };
  }

  /**
   * Service — local business logic (submit validation).
   */
  protected async _service(): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const input: UserValidateInput = {
        email: this.state.email,
        name: this.state.name,
        age: this.state.age ? Number(this.state.age) : undefined,
      };

      const result = await this._repository(input);
      this.setState({ result, loading: false });
    } catch (err) {
      this.setState({
        error: (err as Error).message,
        loading: false,
      });
    }
  }

  /**
   * Repository — data access (calls the backend API).
   */
  protected async _repository(
    input: UserValidateInput
  ): Promise<UserValidateOutput> {
    const response = await this.ctx.api?.request({
      method: "POST",
      url: "/users/validate",
      body: input,
    });

    return response as UserValidateOutput;
  }
}
