---

name: code-review
description: Review a diff against CODING_STANDARDS.md.
---

Review the changes (default: `git diff origin/main...HEAD`) against each rule in `CODING_STANDARDS.md`, and nothing else.

For each violation, report the file and line, the rule, what is wrong, and a fix. If there are none, say so.
