/* ========================================================================== *
 * Example: user_register — UI Surface
 * --------------------------------------------------------------------------
 * Grammar: view <-> _viewmodel <-> _service <-> _repository
 *
 * A self-contained registration form.
 * ========================================================================== */

import { BaseUiCase, UiContext, UIState } from "../../../core/ui.case";
import {
  UserRegisterInput,
  UserRegisterOutput,
} from "./user_register.domain.case";

/* --------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------ */

interface UserRegisterState extends UIState {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
  result: UserRegisterOutput | null;
  loading: boolean;
  error: string | null;
}

/* --------------------------------------------------------------------------
 * UI Case
 * ------------------------------------------------------------------------ */

export class UserRegisterUi extends BaseUiCase<UserRegisterState> {
  constructor(ctx: UiContext) {
    super(ctx, {
      email: "",
      name: "",
      password: "",
      confirmPassword: "",
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

    return {
      type: "form",
      fields: vm.fields,
      submitLabel: vm.submitLabel,
      submitDisabled: vm.submitDisabled,
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
        id: "test-user-id",
        email: "new@example.com",
        name: "New User",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    };

    this.setState({
      email: "new@example.com",
      name: "New User",
      password: "securepass123",
      confirmPassword: "securepass123",
    });

    try {
      await this._service();
      if (!this.state.result) {
        throw new Error("Expected registration to produce a result");
      }
    } finally {
      this.ctx.api = previousApi;
    }
  }

  /* =======================================================================
   * Internal — canonical slots
   * ===================================================================== */

  protected _viewmodel() {
    const { email, name, password, confirmPassword, result, loading, error } =
      this.state;

    const passwordMismatch =
      confirmPassword.length > 0 && password !== confirmPassword;

    return {
      fields: [
        { name: "email", value: email, label: "Email", type: "email" },
        { name: "name", value: name, label: "Full Name", type: "text" },
        {
          name: "password",
          value: password,
          label: "Password",
          type: "password",
        },
        {
          name: "confirmPassword",
          value: confirmPassword,
          label: "Confirm Password",
          type: "password",
          error: passwordMismatch ? "Passwords do not match" : null,
        },
      ],
      submitLabel: loading ? "Registering..." : "Register",
      submitDisabled:
        loading ||
        !email ||
        !name ||
        !password ||
        !confirmPassword ||
        passwordMismatch,
      feedback: error
        ? { type: "error" as const, message: error }
        : result
          ? {
              type: "success" as const,
              message: `Welcome, ${result.name}! Your account has been created.`,
            }
          : null,
    };
  }

  protected async _service(): Promise<void> {
    const { email, name, password, confirmPassword } = this.state;

    if (password !== confirmPassword) {
      this.setState({ error: "Passwords do not match" });
      return;
    }

    this.setState({ loading: true, error: null });

    try {
      const input: UserRegisterInput = { email, name, password };
      const result = await this._repository(input);
      this.setState({ result, loading: false });
    } catch (err) {
      this.setState({ error: (err as Error).message, loading: false });
    }
  }

  protected async _repository(
    input: UserRegisterInput
  ): Promise<UserRegisterOutput> {
    const response = await this.ctx.api?.request({
      method: "POST",
      url: "/users/register",
      body: input,
    });

    return response as UserRegisterOutput;
  }
}
