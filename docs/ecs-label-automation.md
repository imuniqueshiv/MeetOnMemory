# ECSoC26 Labeling Automation

To streamline repository management and maintain consistent labeling during **Elite Coders Summer of Code 2026 (ECSoC26)**, this repository implements an automated workflow that automatically applies the official `ECSoC26` label to eligible issues and pull requests created by external contributors.

## How It Works

1. **Trigger Events**:
   - The workflow is triggered when a new **Issue** is opened (`issues.opened`).
   - The workflow is triggered when a new **Pull Request** is opened (`pull_request_target.opened`).

2. **Casing & Target Label**:
   - Applies the exact label: `ECSoC26`.

3. **Eligibility Check**:
   - The automation checks the author's association with the repository:
     - **Eligible Contributors**: Authors with an association of `NONE`, `FIRST_TIME_CONTRIBUTOR`, `FIRST_TIMER`, or `CONTRIBUTOR`.
     - **Excluded Users**: Authors with an association of `OWNER`, `MEMBER`, or `COLLABORATOR` (repository owners, organization members, maintainers, and administrative collaborators).

4. **Idempotence**:
   - If the issue or pull request already has the `ECSoC26` label, the workflow runs safely without making duplicate API calls or adding duplicate labels.

## Implementation Details

- **Workflow File**: `.github/workflows/10-auto-label-ecs.yml`
- **Execution Script**: `.github/scripts/label-ecs.js`
- **Permissions Required**: `issues: write`, `pull-requests: write`, `contents: read`
