# Virtual Live On-Demand Feature

## Problem Statement

Currently, Tunarr's on-demand channels have two modes:
1. **Always-on**: Channel continuously encodes 24/7, consuming CPU/GPU resources even when no one is watching
2. **On-demand with pause/resume**: Pauses encoding when no viewers, resumes from cursor when someone tunes in

The user wants a third mode: **Virtual Live** - where:
- Schedule position is calculated as if the channel were always live
- No encoding happens until someone tunes in
- When someone tunes in, encoding starts at the calculated "live" position
- EPG shows what "would" be playing based on virtual schedule

## Design

### Schema Changes

Add `virtualLive` field to channel's `onDemand` config:

```typescript
// types/src/schemas/channelSchema.ts
onDemand: z.object({
  enabled: z.boolean(),
  virtualLive: z.boolean().optional().default(false),
}),
```

### Behavior

When `virtualLive: true`:
1. **No cursor tracking** - position is always calculated in real-time
2. **getLiveTimestamp()** calculates: `(requestTime - channelStartTime) % channelDuration + channelStartTime`
3. **No pause/resume** - channel is conceptually "always live" but just not encoding
4. **EPG generation** uses the same calculation to show current/next programs

### Implementation Changes

1. **OnDemandChannelService.getLiveTimestamp()**
   - If `virtualLive: true`, calculate position from current time
   - Skip cursor-based calculation

2. **OnDemandChannelService.pauseChannel()** / **resumeChannel()**
   - No-op for virtual live channels (no state to track)

3. **EPG generation**
   - Use virtual live calculation for current program determination

## Files to Modify

- `types/src/schemas/channelSchema.ts` - Add virtualLive field
- `server/src/db/derived_types/Lineup.ts` - May need updates for consistency
- `server/src/services/OnDemandChannelService.ts` - Core logic
- `server/src/services/OnDemandChannelService.test.ts` - Tests

## Test Plan

1. Unit test: `getLiveTimestamp` returns calculated position for virtual live channels
2. Unit test: `pauseChannel`/`resumeChannel` are no-ops for virtual live
3. Integration test: Stream starts at correct position when tuning in
