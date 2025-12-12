# Migrating from 0.22.x to 1.x

If you ran Tunarr before 1.0, you can still upgrade directly to the 1.x line! However, there are some things to consider:

1. There are _many_ breaking changes between these versions.
2. Like Tunarr release that contain breaking changes, rolling back is not supported.

We recommend taking a **full backup** of your Tunarr data directory before upgrading to 1.x. Should something go wrong with your upgrade, or you experience an issue only present in 1.x and wish to revert, you can restore your backup for 0.22.x.

## How To Take a Backup

1. In Tunarr, navigate to the "System" page and find the location of your "Data Directory"
     1. If you are in Docker, this will show `/config/tunarr`, you must locate the directory _outside_ of your container.
1. **TAKE NOTE** of the version of Tunarr you are currently running.
1. Shutdown Tunarr.
1. Create an archive (zip, tar, etc) of the _entire_ data directory
1. Proceed with the upgrade to 1.0

## To restore a backup

1. Stop Tunarr
1. Remove the data directory (or back it up)
1. Inflate the backup to the original location of the data directory
1. Launch the version of Tunarr you _were previously running_

