-- Channels in 'clip' mode with no fallback clip have always shown the offline
-- picture, because nothing could set a clip. Make the stored mode match.
UPDATE `channel`
SET `offline` = json_set(`offline`, '$.mode', 'pic')
WHERE json_valid(`offline`)
  AND json_extract(`offline`, '$.mode') IS NOT 'pic'
  AND `uuid` NOT IN (SELECT `channel_uuid` FROM `channel_fallback`);
