# AGENTS.md

This repository has one project-level skill, and any agent entering this working directory must load it before doing meaningful work.

## Mandatory Skill

The required project skill is:

- `./SKILL.md`

Absolute path:

- `/Users/hyperorchid/ninja/TweetClaw/SKILL.md`

## Mandatory Rule

Before proposing implementation, refactor, review conclusions, architecture changes, product decisions, or documentation changes, read:

1. `./SKILL.md`
2. then the source-of-truth docs required by `SKILL.md` for the current task

If you have not read `./SKILL.md`, you are not ready to work in this repository.

## Scope Rule

Do not invent a different local workflow.
Do not skip `SKILL.md` and work only from code guesses.
Do not treat undocumented behavior as product direction.

## Task-specific Follow-through

After reading `./SKILL.md`, continue reading the relevant docs by task type, including:

- product charter and policy docs for all meaningful work
- tool contracts for tool changes
- signal/extraction docs for capture work
- workflow docs for write, approval, or audit work
- `docs/10-openclaw-account-maintenance-v1-spec.md` for product planning and release-scope work
- `docs/11-debug-panel-redesign-v1.md` for debug panel, scene, current object, and workspace UX work
