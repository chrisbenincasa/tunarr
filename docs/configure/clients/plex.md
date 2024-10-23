# Plex

Once you have your channels created with programming/shows added, head over to Plex > Settings icon > Manage > Live TV & DVR > Set Up Plex Tuner.

![Plex settings](/assets/plex-settings.png)

![Plex settings DVR](/assets/plex-settings-dvr.png)

![Plex settings tuner](/assets/plex-settings-tuner.png)

Plex should already detect Tunarr and you should see your servers IP address. If you do not, select "Don't see your HDHomeRun device? Enter its network address manually". Use the following format replacing serverIP with your servers IP address: e.g. `http://serverIP:8000`

Once your server is shown, select "Have an XMLTV guide on your server? Click here to use it."

![Plex settings tuner 2](/assets/plex-settings-tuner2.png)

In the "XMLTV GUIDE" field, use the following template replacing serverIP with your Tunarr servers IP address: e.g. `http://serverIP:8000/api/xmltv.xml`

Select "Continue"

![Plex settings XMLTV](/assets/plex-settings-xmltv.png)

Your channels should automatically be mapped. Select "Continue".

![Plex settings channels](/assets/plex-settings-channels.png)

Plex should now display your Tunarr channels in the Live TV section. Select "View Guide" to be brought directly there.

![Plex settings view guide](/assets/plex-settings-viewguide.png)

Play your channel by hovering over the channel icon and selecting the play icon.

![Plex settings guide](/assets/plex-settings-guide.png)

!!! warning

    Please note, at the time of writing the Plex Windows client is not currently supported and will yield a "This Live TV session has ended" error. Windows users should use the web browser client located at http://serverIP:32400/web until this is resolved. This issue is tracked in <a href="https://github.com/chrisbenincasa/tunarr/issues/718" target="_blank">chrisbenincasa/tunarr#718</a>
