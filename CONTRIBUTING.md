# Contributing to Tunarr

The full guide covers setup, commands, code style, and commit conventions: [docs/dev/contributing.md](docs/dev/contributing.md), also published at https://tunarr.com/dev/contributing/.

## Pull request policy

The short version of the [pull request policy](https://tunarr.com/dev/contributing/#pull-request-policy), which applies however your code was written:

- You own every line of your PR and must be able to explain it in review.
- Large or structural changes need a design issue labeled `design approved` before you write code. These include new media sources, migrations, new runtime dependencies, new top-level features, cross-package API changes, and anything over 500 changed lines outside tests or 1,500 including tests.
- A bot converts PRs that skip the design step to drafts and labels them `needs design`. They are closed after 30 days without an approved design.

## AI use

AI tools are welcome. The short version of the [AI use rules](https://tunarr.com/dev/contributing/#ai-use):

- Every PR says whether AI tools were used and what they did, in the "AI use" section of the PR template.
- Write your own review replies.
- Bug reports describe what you saw. Any AI analysis of the cause goes in its own field.
