import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { PropertiesPanel } from "./PropertiesPanel";
import { useDesignerStore } from "../store/designer.store";
import type { NodeTypeDefinition } from "../models/workflow.model";

vi.mock("../hooks/useCredentials", () => ({
  useConnectors: () => ({ data: [] }),
}));
afterEach(cleanup);
const hidden: NodeTypeDefinition = {
  id: "switch",
  key: "logic.switch",
  displayName: "Hidden Switch",
  category: "LOGIC",
  icon: null,
  color: null,
  description: null,
  connectorId: null,
  isCatalogVisible: false,
  isExecutionAllowed: true,
  configSchema: {
    type: "object",
    properties: { label: { type: "string", title: "Label" } },
  },
};
describe("Designer compatibility (BDD-NM-02)", () => {
  it("keeps hidden metadata available for editing without exposing a palette item", () => {
    useDesignerStore.setState({ nodeTypes: [hidden], selectedNodeId: "n1" });
    render(<Sidebar />);
    expect(screen.queryByText("Hidden Switch")).toBeNull();
    cleanup();
    const onChange = vi.fn();
    render(
      <PropertiesPanel
        workflowId="wf"
        nodes={[
          {
            id: "n1",
            position: { x: 0, y: 0 },
            data: {
              key: hidden.key,
              name: "Old node",
              config: { label: "Original" },
            },
          },
        ]}
        onNodeDataChange={onChange}
        onDeleteNode={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("Original"), {
      target: { value: "Updated" },
    });
    expect(onChange).toHaveBeenCalledWith(
      "n1",
      expect.objectContaining({ config: { label: "Updated" } }),
    );
  });
});
