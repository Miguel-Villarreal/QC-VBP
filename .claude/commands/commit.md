Commit all changes to git and push to GitHub.

The user provides a version/description as the argument: $ARGUMENTS

## Steps:

1. Run `git status` to see all changed/untracked files
2. Run `git diff --stat` to see a summary of changes
3. Run `git log --oneline -5` to see recent commit style
4. Stage all relevant files (avoid secrets like .env). Use specific file paths, not `git add -A`
5. Create a commit with the message from $ARGUMENTS
6. Push to the remote repository

## Rules:
- Do NOT stage .env files or credentials
- Use the $ARGUMENTS text as the commit message (keep it concise)
- Append `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` to the commit
- Show the user the commit hash and push result when done
- If $ARGUMENTS is empty, ask the user what the commit message should be
