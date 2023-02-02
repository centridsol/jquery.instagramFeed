/*!
 * jquery.instagramFeed
 *
 * @version 3.0.4
 *
 * https://github.com/jsanahuja/jquery.instagramFeed
 *
 */
(function ($) {
    var defaults = {
        'host': "https://graph.instagram.com/",
        'access_token': '',
        'container': '',
        'display_gallery': true,
        'display_captions': false,
        'max_tries': 8,
        'callback': null,
        'styling': true,
        'items': 8,
        'items_per_row': 4,
        'margin': 0.5,
        'image_size': 640,
        'lazy_load': false,
        'cache_time': 360,
        'filter_images': null,
        'isSlider': false,
        'on_error': console.error
    };

    /**
     * Cache management
     */
    function get_cache(options, last_resort){
        var read_cache = last_resort || false;
        
        if (!last_resort && options.cache_time > 0) {
            var cached_time = localStorage.getItem(options.cache_time_key);
            if(cached_time !== null && parseInt(cached_time) + 1000 * 60 * options.cache_time > new Date().getTime()){
                read_cache = true;
            }
        }

        if(read_cache){
            var data = localStorage.getItem(options.cache_data_key);
            if(data !== null){
                return JSON.parse(data);
            }
        }
        return false;
    };

    function set_cache(options, data){
        var cached_time = localStorage.getItem(options.cache_time_key),
            cache = options.cache_time != 0 && (cached_time === null || parseInt(cached_time) + 1000 * 60 * options.cache_time > new Date().getTime());
        
        if(cache){
            localStorage.setItem(options.cache_data_key, JSON.stringify(data));
            localStorage.setItem(options.cache_time_key, new Date().getTime());
        }
    }


    function request_data(url, tries, callback){
        $.get(url, function(response){
            if(response !== false){
                callback(response);
            }else{
                // Unexpected response, not retrying
                callback(false);
            }
        }).fail(function (e) {
            if(tries > 1){
                console.warn("Instagram Feed: Request failed, " + (tries-1) + " tries left. Retrying...");
                request_data(url, tries-1, callback, autoFallback, !googlePrefix);
            }else{
                callback(false, e);
            }
        });
    }

    /**
     * Parse data items
     * Extract from https://github.com/stevenschobert/instafeed.js:_getItemData
     */
    function getItemData(data) {

        function extractTags(str) {
            var exp = /#([^\s]+)/gi;
            var badChars = /[~`!@#$%^&*\(\)\-\+={}\[\]:;"'<>\?,\./|\\\s]+/i;
            var tags = [];
            var match = null;
            if (typeof str === "string") {
                while ((match = exp.exec(str)) !== null) {
                    if (badChars.test(match[1]) === false) {
                        tags.push(match[1]);
                    }
                }
            }
            return tags;
        };
          
        var type = null;
        var image = null;

        switch (data.media_type) {
            case "IMAGE":
                type = "image";
                image = data.media_url;
                break;
            case "VIDEO":
                type = "video";
                image = data.thumbnail_url;
                break;
            case "CAROUSEL_ALBUM":
                type = "album";
                image = data.media_url;
                break;
        }
        return {
            caption: data.caption,
            tags: extractTags(data.caption),
            id: data.id,
            image: image,
            link: data.permalink,
            model: data,
            timestamp: data.timestamp,
            type: type,
            username: data.username
        };
    };

    /**
     * Retrieve data
     */
    function get_data(options, callback){
        var data = get_cache(options, false);

        if(data !== false){
            // Retrieving data from cache
            callback(data);
        }else{
            // No cache, let's do the request
            var url = options.host+"me/media?fields=caption,id,media_type,media_url,permalink,thumbnail_url,timestamp,username&access_token="+options.access_token
            
            request_data(url, options.max_tries, function(data, exception){
                if(data !== false){
                    set_cache(options, data);
                    callback(data);
                }else if(typeof exception === "undefined"){
                    options.on_error("Instagram Feed: It looks like the profile you are trying to fetch is age restricted. See https://github.com/jsanahuja/InstagramFeed/issues/26", 3);
                }else{
                    // Trying cache as last resort before throwing
                    data = get_cache(options, true);
                    if(data !== false){
                        callback(data);
                    }else{
                        options.on_error("Instagram Feed: Unable to fetch the given user. Instagram responded with the status code: " + exception.status, 5);
                    }
                }
            });
        }
    }

    /**
     * Rendering
     */
    function render(options, data){
        var html = "", styles;

        /**
         * Styles
         */
        if(options.styling){
            var width = (100 - options.margin * 2 * options.items_per_row) / options.items_per_row;
            styles = {
                profile_container: ' style="text-align:center;"',
                profile_image: ' style="border-radius:10em;width:15%;max-width:125px;min-width:50px;"',
                profile_name: ' style="font-size:1.2em;"',
                profile_biography: ' style="font-size:1em;"',
                gallery_image: ' style="width:100%;"',
                gallery_image_link: ' style="width:' + width + '%; margin:' + options.margin + '%;position:relative; display: inline-block; height: 100%;"'
            };
            
            if(options.display_captions){
                html += "<style>\
                    a[data-caption]:hover::after {\
                        content: attr(data-caption);\
                        text-align: center;\
                        font-size: 0.8rem;\
                        color: black;\
                        position: absolute;\
                        left: 0;\
                        right: 0;\
                        bottom: 0;\
                        padding: 1%;\
                        max-height: 100%;\
                        overflow-y: auto;\
                        overflow-x: hidden;\
                        background-color: hsla(0, 100%, 100%, 0.8);\
                    }\
                </style>";
            }
        }else{
            styles = {
                profile_container: "",
                profile_image: "",
                profile_name: "",
                profile_biography: "",
                gallery_image: "",
                gallery_image_link: ""
            };
        }

        /**
         * Gallery
         */
        if(options.display_gallery){
            var imgs = data.data,
                max = (imgs.length > options.items) ? options.items : imgs.length;

            if (options.filter_images){
                imgs = options.filter_images(imgs)
            }

            html += options.isSlider ? "<div class='instagram_gallery carousel slide' data-ride='carousel'>" : "<div class='instagram_gallery'>" ;
            
            html += options.isSlider ?  `
                    <ol class="carousel-indicators">
                        <li data-target=".instagram_gallery" data-slide-to="0" class="active"></li>
                        <li data-target=".instagram_gallery" data-slide-to="1"></li>
  
                    </ol>` : '';

            html += options.isSlider ? "<div class='carousel-inner'>" : "<div class='row'>";

            for (var i = 0; i < max; i++) {
                itemData = getItemData(imgs[i])

                html += '<a href="' + itemData.image + '"' + (options.display_captions && itemData.caption ? ' data-caption="' + itemData.caption + '"' : '') + ' class="instagram-' + itemData.type + ' item '+ (i === 0 ? 'active': '') +' " rel="noopener" target="_blank"' + (options.isSlider ? "" : styles.gallery_image_link )+ '>';
                html += '<img' + (options.lazy_load ? ' loading="lazy"' : '') + ' src="' + itemData.image + '" alt="' + itemData.caption + '"' + styles.gallery_image + ' />';
                html += '</a>';
            }

            html += "</div>";
            html += options.isSlider ?  `
            <a class="left carousel-control" href=".instagram_gallery" data-slide="prev">
                <span class="fa fa-chevron-left"></span>
                <span class="sr-only">Previous</span>
            </a>
            <a class="right carousel-control" href=".instagram_gallery" data-slide="next">
                <span class="fa fa-chevron-right"></span>
                <span class="sr-only">Next</span>
            </a>` : '';
            html += '</div>';
        }
        
        $(options.container).html(html);
    }

    $.instagramFeed = function (opts) {
        var options = $.fn.extend({}, defaults, opts);

        if (options.access_token == undefined || options.access_token == "") {
            options.on_error("Instagram Feed: Access token needs to be set.", 1);
            return false;
        }

        if (options.callback == null && options.container == "") {
            options.on_error("Instagram Feed: Error, neither container found nor callback defined.", 2);
            return false;
        }

        options.cache_data_key = 'instagramFeed_' + options.id;
        options.cache_time_key = options.cache_data_key + '_time';

        get_data(options, function(data){
            if(options.container != ""){
                render(options, data);
            }
            if(options.callback != null){
                options.callback(data);
            }
        });
        return true;
    };

})(jQuery);
