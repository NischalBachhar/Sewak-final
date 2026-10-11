# Combined caregiver and household organizations

`Caregiver & Household Staffing Agency` follows `Household Staffing Agency` in registration and organization profile editors. The UI, Worker validation, and generated OpenAPI enum share `src/organizationTypes.mjs`; existing persisted labels are unchanged.

The existing service selector offers both categories, supports multiple explicit selections, and retains selections through category filtering and organization-type changes. Choosing a type does not assign services. Existing limits, inactive/medical service restrictions, tenant ownership checks, and atomic catalog-version guards still apply.

No database migration is required. Organization type and selected IDs remain in the existing `extra_json` fields on organizations/applications. `organization_services` is synchronized atomically when the organization is saved. Admin approval retains the type and selections; admin application and organization cards display the type, and organization search matches name or type.

Public discovery remains based on approved, active caregivers and their actual service assignments. An organization's combined type does not give its caregivers unselected skills or bypass marketplace approval. Older organizations, including records without a type, retain their existing behavior.

Validation: 38 frontend unit tests, lint, Worker typecheck, 43 D1 tests (including real workerd bindings), production build, guarded Wrangler dry-run, credential/runtime scan, and two browser journeys at 320px and 1440px. New tests cover mixed selections, removal, empty selections, exact persistence, approval, profile edits, legacy types, tenant boundaries, invalid IDs, category/service filtering, and admin search.

The production release is based on live application commit `8425a3b` to exclude unrelated, undeployed Super Admin recovery changes from the working branch.
