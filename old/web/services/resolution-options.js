module.exports = function () {
    return {
        get: () => {
            return [
                {id:"420x420",description:"420x420 (1:1)"},
                {id:"480x270",description:"480x270 (HD1080/16 16:9)"},
                {id:"576x320",description:"576x320 (18:10)"},
                {id:"640x360",description:"640x360 (nHD 16:9)"},
                {id:"720x480",description:"720x480 (WVGA 3:2)"},
                {id:"800x600",description:"800x600 (SVGA 4:3)"},
                {id:"1024x768",description:"1024x768 (WXGA 4:3)"},
                {id:"1280x720",description:"1280x720 (HD 16:9)"},
                {id:"1920x1080",description:"1920x1080 (FHD 16:9)"},
                {id:"3840x2160",description:"3840x2160 (4K 16:9)"},
            ];
        }
    }
}