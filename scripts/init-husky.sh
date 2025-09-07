#!/usr/bin/env bash

# Check if bunx is installed
if command -v bun &> /dev/null; then
  # Run the command with bunx
  bun -e "if (process.env.NODE_ENV !== 'production'){process.exit(1)}" || bunx husky
else
  # Fall back to npx if bunx is not available
  node -e "if (process.env.NODE_ENV !== 'production'){process.exit(1)}" || npx husky
fi