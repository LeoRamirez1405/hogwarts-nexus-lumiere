---
description: Commit all changes in logical groups and push — verify nothing left behind
---

Stage, commit (multiple logical commits), and push all changes. Ensure zero untracked/staged files remain.

Steps:
1. `git status` — show current state
2. `git add -A` — stage everything (new, modified, deleted)
3. `git status` — verify staging

4. **Create multiple logical commits** (instead of one large commit):
   - Group staged changes by scope/type (e.g., feat:core, fix:api, refactor:utils, docs:readme, test:unit, chore:config)
   - For each group:
     a. `git reset HEAD` — unstage all
     b. `git add <files-for-group>` — stage only that group's files
     c. `git commit -m "<type>(<scope>): <subject>"` — conventional commit per group
        - Type: `feat|fix|refactor|chore|docs|test|perf|build|ci`
        - Scope: module name or `audit|rootcause|infra|deps`
        - Subject: imperative, <72 chars
        - Body: brief rationale if non-trivial (optional, use `-m` twice)
   - Repeat until all staged changes are committed

5. `git push origin HEAD` — push current branch
6. `git status` — confirm clean working tree

Abort if:
- Untracked files remain after `git add -A` (except `.opencode/`, `.git/`, `graphify-out/`, `AUDITS/history/`, `__pycache__/`, `*.pyc`)
- Any commit would be empty
- Push fails (handle upstream/rebase if needed)

Output: list of commit SHAs + push status