Commit all changes to git and push to GitHub.

The user provides a version/description as the argument: $ARGUMENTS

## Steps:

1. Run `git status` to see all changed/untracked files
2. Run `git diff --stat` to see a summary of changes
3. Run `git log --oneline -10` to see recent commits
4. Ask the user which option they want:
   - **Replace an existing commit**: Show the list of recent commits (from step 3) and ask which one to replace. Use `git reset --soft <commit_hash>~1` to undo that commit while keeping changes staged, then create a new commit with the updated content. Only allow replacing the most recent commit (amend) -- if they pick an older one, warn that this rewrites history and confirm.
   - **New commit**: If $ARGUMENTS is provided, use it as the commit message. If empty, ask the user for a commit message.
5. Stage all relevant files (avoid secrets like .env). Use specific file paths, not `git add -A`
6. Create the commit
7. Push to the remote repository (use `--force-with-lease` if a commit was replaced)

## Rules:
- Do NOT stage .env files or credentials
- Append `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` to the commit
- Show the user the commit hash and push result when done
- Always ask the user to choose between replacing an existing commit or creating a new one BEFORE staging/committing
- When replacing, clearly show what will happen before proceeding
