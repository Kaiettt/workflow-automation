Here is the step-by-step workflow for how you and the AI agents will collaborate to implement a feature:

### 1. Feature Inception & Specs
When starting a new feature (let's call it `checkout-flow`), you initialize it in the local issue tracker:
- A new directory is created at `.scratch/checkout-flow/`
- The overarching requirements are written in `.scratch/checkout-flow/spec.md` (or you can use the `/grill-me` command to have an agent help you refine the spec by asking you tough questions before you start).

### 2. Breakdown into Tickets
Rather than tackling a huge feature at once, the work is broken down into small, numbered markdown files (tickets) inside `.scratch/checkout-flow/issues/`:
- e.g., `01-research-payment-api.md`
- e.g., `02-prototype-cart-ui.md`
- e.g., `03-implement-cart-state.md`

Each ticket is assigned a **type** (`research`, `prototype`, `grilling`, or `task`) and starts with a status like `Status: open` or a triage label like `ready-for-agent`.

### 3. Agent Delegation (Wayfinding)
Once tickets are ready, agents can pick them up. If an agent is using the `wayfinder` skill, it will:
1. Scan `.scratch/checkout-flow/issues/` for tickets that are unblocked and unclaimed.
2. Claim a ticket by setting its status to `Status: claimed` in the markdown file.
3. Perform the work (writing code, doing research, building a prototype).
4. Resolve the ticket by appending the answer to the bottom of the file, setting `Status: resolved`, and linking any major decisions back to the main map.

### 4. Implementation Using Specialized Skills
While resolving a ticket, you or the agent can trigger specific skills based on the task:
- **Test-Driven Development:** Trigger the `tdd` skill to have the agent write failing tests first, then write the implementation to turn them green.
- **Prototyping:** Trigger the `prototype` skill if the ticket is just about throwing together a quick, disposable UI or logic check to answer a design question.
- **Debugging:** If the implementation hits a hard issue, trigger the `diagnosing-bugs` skill for a structured diagnostic loop.
- **Domain Modeling:** If new terms or architectural decisions arise, the `domain-modeling` skill is used to update the central `CONTEXT.md` or write a new Architecture Decision Record (ADR) in `docs/adr/`.

### 5. Review & Merging
Once the tickets for a feature are resolved and the code is written, you can trigger the `code-review` skill. This will run sub-agents to check the new code against two things:
1. **Standards:** Does the code follow the repo's established guidelines (like your NestJS or React guidelines)?
2. **Spec:** Does the code actually do what `.scratch/checkout-flow/spec.md` asked for?

### Summary of the loop
**Map the work** -> **Break into local markdown tickets** -> **Assign `ready-for-agent`** -> **Agent executes using `tdd`/`prototype`** -> **Update `CONTEXT.md`** -> **Review**.