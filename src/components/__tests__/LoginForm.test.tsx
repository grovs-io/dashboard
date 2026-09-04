import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginForm } from "../loginForm/login-form";
import { loginSchema, type LoginFormValues } from "@/schemas/auth";

vi.mock("@/lib/config", () => ({
  config: {
    apiUrl: "https://test.example.com",
    apiPath: "/api/v1",
    docsUrl: "https://docs.example.com",
    supportEmail: "support@example.com",
    termsUrl: "https://example.com/terms",
    privacyUrl: "https://example.com/privacy",
    pricingUrl: "https://example.com/pricing",
    salesUrl: "https://example.com/sales",
    appUrl: "https://app.example.com",
  },
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, ...rest } = props;
    return <img src={typeof src === "string" ? src : ""} {...rest} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function TestLoginForm(
  overrides: Partial<Parameters<typeof LoginForm>[0]> = {}
) {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", otp: "" },
    mode: "onChange",
  });

  const defaults = {
    form,
    otpEnabled: false,
    handleLogin: vi.fn(),
    loginWithSSO: vi.fn(),
    ssoProviders: ["google_oauth2", "microsoft_graph"] as const,
    ...overrides,
  };

  return <LoginForm {...defaults} />;
}

describe("LoginForm", () => {
  it("renders email and password fields", () => {
    render(<TestLoginForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter password")).toBeInTheDocument();
  });

  it("does not render OTP field when otpEnabled is false", () => {
    render(<TestLoginForm otpEnabled={false} />);

    expect(screen.queryByLabelText("OTP")).not.toBeInTheDocument();
  });

  it("renders OTP field when otpEnabled is true", () => {
    render(<TestLoginForm otpEnabled={true} />);

    expect(screen.getByLabelText("OTP")).toBeInTheDocument();
  });

  it("renders SSO buttons", () => {
    render(<TestLoginForm />);

    expect(screen.getByText("Login with Google")).toBeInTheDocument();
    expect(screen.getByText("Login with Microsoft")).toBeInTheDocument();
  });

  it("renders only the configured SSO provider", () => {
    render(<TestLoginForm ssoProviders={["microsoft_graph"]} />);

    expect(screen.queryByText("Login with Google")).not.toBeInTheDocument();
    expect(screen.getByText("Login with Microsoft")).toBeInTheDocument();
    expect(screen.getByText("Or continue with")).toBeInTheDocument();
  });

  it("renders email login without an SSO divider when no provider is configured", () => {
    render(<TestLoginForm ssoProviders={[]} />);

    expect(screen.queryByText("Login with Google")).not.toBeInTheDocument();
    expect(screen.queryByText("Login with Microsoft")).not.toBeInTheDocument();
    expect(screen.queryByText("Or continue with")).not.toBeInTheDocument();
    expect(
      screen.getByText("Login with your email and password")
    ).toBeInTheDocument();
  });

  it("calls loginWithSSO with correct provider on SSO button click", () => {
    const loginWithSSO = vi.fn();
    render(<TestLoginForm loginWithSSO={loginWithSSO} />);

    fireEvent.click(screen.getByText("Login with Google"));
    expect(loginWithSSO).toHaveBeenCalledWith("google_oauth2");

    fireEvent.click(screen.getByText("Login with Microsoft"));
    expect(loginWithSSO).toHaveBeenCalledWith("microsoft_graph");
  });

  it("tucks the password behind a link and drops social buttons when a connection is discovered", () => {
    const loginWithSSO = vi.fn();
    render(
      <TestLoginForm enterpriseConnectionId={12} loginWithSSO={loginWithSSO} />
    );

    fireEvent.click(screen.getByText("Continue with your organisation"));
    expect(loginWithSSO).toHaveBeenCalledWith("oidc");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText("Login with Google")).not.toBeInTheDocument();
    expect(screen.queryByText("Or continue with")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Sign in with a password instead"));
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText("Forgot your password?")).toBeInTheDocument();
  });

  it("hides the password and social buttons when the domain is enforced", () => {
    render(<TestLoginForm enterpriseConnectionId={12} enterpriseEnforced />);

    expect(
      screen.getByText("Continue with your organisation")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText("Forgot your password?")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Sign in with a password instead")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Login with Google")).not.toBeInTheDocument();
    expect(screen.queryByText("Or continue with")).not.toBeInTheDocument();
    expect(
      screen.getByText("Your organisation requires single sign-on")
    ).toBeInTheDocument();
  });

  it("submit button is disabled when form is invalid", () => {
    render(<TestLoginForm />);

    const button = screen.getByRole("button", { name: "Login" });
    expect(button).toBeDisabled();
  });

  it("renders forgot password and sign up links", () => {
    render(<TestLoginForm />);

    expect(screen.getByText("Forgot your password?")).toBeInTheDocument();
    expect(screen.getByText("Sign up")).toBeInTheDocument();
  });
});
