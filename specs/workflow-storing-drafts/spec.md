# Workflow Draft API Specification

## 1. Overview
API to save/persist a workflow draft. The frontend sends the React Flow definition JSON and a `workflowId`. If the `Workflow` doesn't exist, it will be created on the fly. 

## 2. API Endpoint
**Endpoint:** `PUT /api/workflows/:id/draft`
**Description:** Upserts a workflow draft. The parent workflow must already exist.

### Request
**Path Parameters:**
- `id` (UUID): The required workflow ID.

**Body (JSON):**
```json
{
  "definition": {
    "nodes": [],
    "edges": [],
    "viewport": {}
  }
}
```

### Response
**Status:** 200 OK
**Body (JSON):**
```json
{
  "success": true,
  "data": {
    "workflowId": "uuid",
    "updatedAt": "ISOString"
  }
}
```

## 3. Business Rules
1. **Must Exist**: If no `workflows` record exists with the provided `id`, the API immediately throws a `NotFoundException` (or equivalent domain exception).
2. **Upsert Draft**: Update `workflow_drafts` with the provided `definition`. If the record doesn't exist, insert it.
3. **No Validation Blocking**: Drafts are allowed to be invalid. We just save the definition as-is. `validation_errors` can be null for now (or updated if we add background validation later).