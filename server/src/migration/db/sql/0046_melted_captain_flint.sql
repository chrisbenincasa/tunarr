PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transcode_config` (
	`uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`thread_count` integer NOT NULL,
	`hardware_acceleration_mode` text NOT NULL,
	`vaapi_driver` text DEFAULT 'system' NOT NULL,
	`vaapi_device` text,
	`resolution` text NOT NULL,
	`video_format` text NOT NULL,
	`video_profile` text,
	`video_preset` text,
	`video_bit_depth` integer DEFAULT 8,
	`video_bit_rate` integer NOT NULL,
	`video_buffer_size` integer NOT NULL,
	`audio_channels` integer NOT NULL,
	`audio_format` text NOT NULL,
	`audio_bit_rate` integer NOT NULL,
	`audio_buffer_size` integer NOT NULL,
	`audio_sample_rate` integer NOT NULL,
	`audio_volume_percent` integer DEFAULT 100 NOT NULL,
	`audio_loudnorm_config` text,
	`normalize_frame_rate` integer DEFAULT false,
	`deinterlace_video` integer DEFAULT true,
	`disable_channel_overlay` integer DEFAULT false,
	`error_screen` text DEFAULT 'pic' NOT NULL,
	`error_screen_audio` text DEFAULT 'silent' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`disable_hardware_decoder` integer DEFAULT false,
	`disable_hardware_encoding` integer DEFAULT false,
	`disable_hardware_filters` integer DEFAULT false,
	CONSTRAINT "transcode_config_hardware_accel_check" CHECK("__new_transcode_config"."hardware_acceleration_mode" in ('none', 'cuda', 'vaapi', 'qsv', 'videotoolbox')),
	CONSTRAINT "transcode_config_vaapi_driver_check" CHECK("__new_transcode_config"."vaapi_driver" in ('system', 'ihd', 'i965', 'radeonsi', 'nouveau')),
	CONSTRAINT "transcode_config_video_format_check" CHECK("__new_transcode_config"."video_format" in ('h264', 'hevc', 'mpeg2video')),
	CONSTRAINT "transcode_config_audio_format_check" CHECK("__new_transcode_config"."audio_format" in ('aac', 'ac3', 'copy', 'mp3', 'libopus')),
	CONSTRAINT "transcode_config_error_screen_check" CHECK("__new_transcode_config"."error_screen" in ('static', 'pic', 'blank', 'testsrc', 'text', 'kill')),
	CONSTRAINT "transcode_config_error_screen_audio_check" CHECK("__new_transcode_config"."error_screen_audio" in ('silent', 'sine', 'whitenoise'))
);
--> statement-breakpoint
INSERT INTO `__new_transcode_config`("uuid", "name", "thread_count", "hardware_acceleration_mode", "vaapi_driver", "vaapi_device", "resolution", "video_format", "video_profile", "video_preset", "video_bit_depth", "video_bit_rate", "video_buffer_size", "audio_channels", "audio_format", "audio_bit_rate", "audio_buffer_size", "audio_sample_rate", "audio_volume_percent", "audio_loudnorm_config", "normalize_frame_rate", "deinterlace_video", "disable_channel_overlay", "error_screen", "error_screen_audio", "is_default", "disable_hardware_decoder", "disable_hardware_encoding", "disable_hardware_filters") SELECT "uuid", "name", "thread_count", "hardware_acceleration_mode", "vaapi_driver", "vaapi_device", "resolution", "video_format", "video_profile", "video_preset", "video_bit_depth", "video_bit_rate", "video_buffer_size", "audio_channels", "audio_format", "audio_bit_rate", "audio_buffer_size", "audio_sample_rate", "audio_volume_percent", "audio_loudnorm_config", "normalize_frame_rate", "deinterlace_video", "disable_channel_overlay", "error_screen", "error_screen_audio", "is_default", "disable_hardware_decoder", "disable_hardware_encoding", "disable_hardware_filters" FROM `transcode_config`;--> statement-breakpoint
DROP TABLE `transcode_config`;--> statement-breakpoint
ALTER TABLE `__new_transcode_config` RENAME TO `transcode_config`;--> statement-breakpoint
PRAGMA foreign_keys=ON;