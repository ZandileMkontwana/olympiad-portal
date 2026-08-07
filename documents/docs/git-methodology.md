When to commit:
after each logically complete, working chunk — not time-based

How to write commits: 
Conventional Commits format (type(scope): description) 

When to branch: 
one branch per ticket/task, off main

How to name branches: 
feature/function

When to merge: 
when the feature works and passes CI, via Pull Request — not direct pushes

Requirements for merging: 
at least 1 approval + CI passing

When to version: 
at sprint boundaries(end)

How to version: 
MAJOR.MINOR.PATCH via git tags, with a CHANGELOG.md