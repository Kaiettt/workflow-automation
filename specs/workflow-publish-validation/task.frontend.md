# Frontend Tasks: Workflow Publish Validation

## Phase 1: Publish error handling
- [x] Update publish API error handling to parse structured validation issues
- [x] Preserve validation issue details, including code, node ID, and field where available

## Phase 2: Validation dialog & feedback UI
- [x] Replace wall of errors banner with modal `PublishValidationDialog`
- [x] Group errors by node instead of individual fields (e.g. `Read Google Sheet (2 errors)`)
- [x] Hide internal technical IDs (e.g. `actionNode-179277...`), displaying user-friendly node names
- [x] Format human-friendly validation messages (e.g. `Spreadsheet ID is required` instead of raw `spreadsheet_id`)
- [x] Reduce red overload with neutral card design, using subtle red indicators and badges
- [x] Highlight invalid nodes on canvas with error badge count and red border rings
- [x] Clicking error card zooms, centers, selects the node and opens its properties panel
- [x] Prevent auto-save from automatically closing the error dialog or clearing validation state
- [x] Header "Error" button with badge count to reopen validation dialog anytime

## Phase 3: Frontend tests
- [x] Add a test that exercises publishing when the API returns validation issues
- [x] Verify the validation dialog and node grouping are rendered
- [x] Verify node focusing callback selects the target node

## Definition of done
- [x] Publish validation failures are displayed in user-friendly English
- [x] Users can identify the node and fields that need attention
- [x] Dialog remains open until dismissed or a node is selected, and can be reopened via the header "Error" button