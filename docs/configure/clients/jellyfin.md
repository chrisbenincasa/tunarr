# Jellyfin

Once you have your channels created with programming/shows added, head over to Jellyfin. The following pictures show step-by-step how connect Tunarr to your Jellyfin server.

<figure markdown="span">
    ![Jellyfin Hamburger](/assets/Jellyfin-home-menu.png)
    <figcaption>1. Locate "Hamburger" menu on the Jellyfin homepage</figcaption>
</figure>

<figure markdown="span">
    ![Jellyfin Admin Dash](/assets/Jellyfin-admin-dashboard.png)
    <figcaption>2. Locate the "Dashboard" menu item under "Administration"</figcaption>
</figure>
<figure markdown="span">
    ![Jellyfin Live TV Setup](/assets/Jellyfin-live-tv-options.png)
    <figcaption>3. Locate the "Live TV" menu item under "Live TV" in the sidebar</figcaption>
</figure>

<hr/>
At this point, Jellyfin will ask for your tuner type - we recdommend selecting HD Homerun. 

!!! note
    Tunarr supports M3U and HDHR style connections from clients. However, some users have experienced stability issues at program boundaries when using Tunarr as an M3U tuner in Jellyfin. This seems to occur when Jellyfin is _not_ transcoding / remuxing the incoming stream and seems related to the following issues: [jellyfin/jellyfin-ffmpeg#57](https://github.com/jellyfin/jellyfin-ffmpeg/issues/57) and [trac.ffmpeg.org/ticket/5419](https://trac.ffmpeg.org/ticket/5419)

![Jellyfin Add HD Homerun](/assets/Jellyfin-add-hdh.png)

You can then select "Detect My Devices," and Jellyfin may be able to detect your Tunarr instance and its IP address. If it does not, you can fill in your info manually. Use the following format replacing serverIP with your server's IP address and chosen port (if using Docker): e.g. `http://serverIP:8000`

![Jellyfin HDHR Setup](/assets/Jellyfin-tuner-setup.png)

Once you have entered your server's URL and port, you will have to add the XMLTV Guide. 

1. First select Add Provider.
2. Choose XMLTV.
3. A screen asking for several items and categories will appear - you generally don't have to change these unless you know what you're doing. What we care about is the first "File or URL" textbox.
4. In this textbox, use the following template replacing serverIP with your Tunarr servers IP address: e.g. `http://serverIP:8000/api/xmltv.xml`.
   
![Jellyfin Add XMLTV Setup](/assets/Jellyfin-add-xmltv.png)

![Jellyfin XMLTV Guide Setup](/assets/Jellyfin-xmltv-settings.png)

If you only have one instance of Tunarr running, you can leave the "Enable for all tuner devices" checked. 

If you have more than one instance, you can uncheck this and then apply this guide to only the tuners you select.

⚠ You can overwrite tuners' channels if you apply more than one guide with the same channel mappings to all tuners. ⚠

![Jellyfin Apply to All](/assets/Jellyfin-apply-to-all.png)

Be careful when assigning if this applies to you!

![Plex settings tuner 2](/assets/plex-settings-tuner2.png)

Select "Save" and Jellyfin should then return you to the Live TV screen and show you it is updating the guide info.

![Plex settings XMLTV](/assets/plex-settings-xmltv.png)

To see if your channels and settings were applied, go back to your main Jellyfin page by selecting the Home icon in the upper left with your server's name.

![Jellyfin Return to Home](/assets/Jellyfin-home.png)

You should now see a "Live TV" card in your My media section - select it!

![Jellyfin Live TV Card](/assets/Jellyfin-new-live-tv-card.png)

From here, you should see all shows that are playing on your channels under the Programs tab, or you can choose to see individual channels or guides from the other tabs.

Play your channel by hovering over the channel icon and selecting the play icon.

![Jellyfin On Now](/assets/Jellyfin-on-now.png)

Happy watching! 📺
