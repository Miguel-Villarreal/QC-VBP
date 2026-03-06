Review the ENTIRE current conversation history and the current state of the codebase, then update ALL of the following documentation files. The goal is to preserve full context so that a future conversation can pick up exactly where this one left off.

## Step 1: Gather context from this conversation

Before editing any files, review the full conversation and identify:
- Features added, changed, or removed
- Bug fixes and their root causes
- Architectural decisions made
- New files created or files significantly modified
- API changes (new endpoints, changed signatures, new fields)
- UI changes (new pages, new columns, changed behavior)
- Any user preferences or conventions established
- Anything discussed that is NOT yet reflected in the documentation files

## Step 2: Update these files

Read each file first, then update only what has changed or is missing.

1. **`plan.md`** - Update Architecture Overview and step completion status. Add any new features to the "Additional Features" section under Step 4. Update step statuses if any have progressed.

2. **`PROJECT_STATUS.md`** - Update:
   - Current State summary
   - Architecture section
   - File Inventory (line counts, new files, removed files)
   - API Endpoints (new endpoints, changed signatures)
   - Data Models (new fields, changed types)
   - UI Features (new pages, changed behavior)
   - Technical Notes (any new notes)
   - Remaining Steps table

3. **`AGENTS.md`** - Update if any business requirements, coding standards, or project conventions have changed.

4. **Auto-memory at `C:\Users\user\.claude\projects\c--AI-QC\memory\MEMORY.md`** - Update:
   - Current Progress
   - Key Files (line counts, new files)
   - Any feature sections that have changed
   - Remove outdated information
   - Add any new insights, patterns, or decisions from this conversation that would be useful in future sessions

## Rules:
- Read each file before editing
- Only update what has actually changed -- do not rewrite unchanged sections
- Keep descriptions concise
- Verify line counts by reading files if unsure
- Capture decisions and context from the conversation, not just code changes
- After updating, list what changed in each file as a summary
