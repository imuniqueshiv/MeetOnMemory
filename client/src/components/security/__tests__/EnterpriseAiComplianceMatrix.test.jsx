// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EnterpriseAiComplianceMatrix from "../EnterpriseAiComplianceMatrix.jsx";

describe("EnterpriseAiComplianceMatrix Component", () => {
  it("renders matrix title and header badges", () => {
    render(<EnterpriseAiComplianceMatrix />);
    expect(
      screen.getByText(/Enterprise AI Security & Compliance Matrix/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Safeguard Status/i)).toBeInTheDocument();
    expect(screen.getByText(/100% Enforced/i)).toBeInTheDocument();
  });

  it("renders compliance controls in table", () => {
    render(<EnterpriseAiComplianceMatrix />);
    expect(screen.getByText(/SEC-AI-01/i)).toBeInTheDocument();
    expect(
      screen.getByText(/In-Memory LLM Processing & Zero Log Retention/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/SEC-AI-03/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Multi-Tenant Vector DB Namespace Segregation/i),
    ).toBeInTheDocument();
  });

  it("filters controls based on search query", () => {
    render(<EnterpriseAiComplianceMatrix />);
    const searchInput = screen.getByPlaceholderText(
      /Search controls by ID, framework, keyword, or safeguard.../i,
    );

    fireEvent.change(searchInput, { target: { value: "Pinecone" } });
    expect(screen.getByText(/SEC-AI-03/i)).toBeInTheDocument();
    expect(screen.queryByText(/SEC-AI-04/i)).not.toBeInTheDocument();
  });

  it("filters controls based on framework selection", () => {
    render(<EnterpriseAiComplianceMatrix />);
    const hipaaBtn = screen.getByRole("button", { name: "HIPAA" });
    fireEvent.click(hipaaBtn);

    // SEC-AI-02 matches HIPAA
    expect(screen.getByText(/SEC-AI-02/i)).toBeInTheDocument();
  });

  it("opens inspect evidence audit modal when clicking Inspect Evidence button", () => {
    render(<EnterpriseAiComplianceMatrix />);
    const inspectButtons = screen.getAllByRole("button", {
      name: /Inspect Evidence/i,
    });
    fireEvent.click(inspectButtons[0]);

    expect(screen.getByText(/Audit Evidence Details/i)).toBeInTheDocument();
    expect(screen.getByText(/Verification Code Command:/i)).toBeInTheDocument();
  });
});
