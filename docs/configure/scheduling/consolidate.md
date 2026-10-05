# Consolidate

Consolidate merges runs of back-to-back blocks into a single block whose duration is the sum of the run. Use it to clean up a lineup that other tools have left fragmented, such as many short flex blocks in a row.

These blocks are merged:

- **Flex**: adjacent flex blocks merge when they use the same filler settings. Flex blocks with different filler lists or cooldowns stay separate.
- **Redirects**: adjacent redirects merge when they point at the same channel.

Programs, custom show items, and filler items are never merged. Each one plays a specific media item, so merging them would stretch that item past its real length.
