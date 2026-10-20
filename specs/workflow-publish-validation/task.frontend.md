# Frontend Tasks: Workflow Publish Validation

## Phase 1: Publish error handling
- [x] Update publish API error handling to parse structured validation issues
- [x] Preserve validation issue details, including code, node ID, and field where available

## Phase 2: Validation feedback
- [x] Render a readable validation summary in the designer after publish fails
- [x] Highlight affected nodes or fields on the canvas or properties panel
- [x] Show actionable messages that explain what the user needs to fix
- [x] Ensure the publish interaction communicates that invalid workflows cannot be published

## Phase 3: Frontend tests
- [x] Add a test that exercises publishing when the API returns validation issues
- [x] Verify the validation summary is rendered
- [x] Verify affected node or field context is shown when provided

## Definition of done
- [x] Publish validation failures are displayed in user-friendly language
- [x] Users can identify the node or field that needs attention
- [x] The frontend test covers rendering validation feedback