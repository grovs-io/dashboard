import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { androidGradleDependency } from "../AndroidPageConstants";
import Step2AddSDK from "@/app/(protected)/settings/developers/android_setup/steps/Step2AddSDK";

describe("androidGradleDependency", () => {
  it("quotes the coordinates for the Kotlin DSL", () => {
    expect(androidGradleDependency("1.4.0")).toBe(
      'implementation("io.grovs:Grovs:1.4.0")'
    );
    expect(androidGradleDependency(null)).toBe(
      'implementation("io.grovs:Grovs:LATEST_VERSION")'
    );
  });

  it("is what the Android setup guide shows", () => {
    render(<Step2AddSDK releaseTagName="1.4.0" />);
    expect(
      screen.getByDisplayValue('implementation("io.grovs:Grovs:1.4.0")')
    ).toBeInTheDocument();
  });
});
