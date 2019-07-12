// ==UserScript==
// @name         Downloader
// @namespace    https://github.com/buzamahmooza
// @version      0.5.3
// @description  A downloader script that has handy features such as: (download zip and download an array of images, download an image),
// @description  (useful when combined with other scripts)
// @description  Note:  if you include this script via @require, make sure to also include all the dependencies of this script (all the @require urls below)
// @author       Faris Hijazi
// @match        *
// @include      *
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @require      https://code.jquery.com/jquery-3.2.1.slim.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.4/jszip.min.js
// @require      https://raw.githubusercontent.com/kimmobrunfeldt/progressbar.js/master/dist/progressbar.min.js
// @require      https://github.com/buzamahmooza/Helpful-Web-Userscripts/raw/master/Handy%20AF%20functions%20Faris.user.js
// @noframes
// ==/UserScript==

/*
 * A downloader script that has handy features such as: (download zip and download an array of images, download an image),
 * (useful when combined with other scripts)
 */


    /**
     * @param details can have the following attributes:
     * @param details.url - the URL from where the data should be downloaded
     * @param details.name - the filename - for security reasons the file extension needs to be whitelisted at Tampermonkey's options page
     * @param details.headers - see GM_xmlhttpRequest for more details
     * @param details.saveAs - boolean value, show a saveAs dialog
     * @param details.onerror callback to be executed if this download ended up with an error
     * @param details.onload callback to be executed if this download finished
     * @param details.onprogress callback to be executed if this download made some progress
     * @param details.ontimeout callback to be executed if this download failed due to a timeout
     * @param details.The download argument of the onerror callback can have the following attributes:
     * @param details.error - error reason
     * @param details.not_enabled - the download feature isn't enabled by the user
     * @param details.not_whitelisted - the requested file extension is not whitelisted
     * @param details.not_permitted - the user enabled the download feature, but did not give the downloads permission
     * @param details.not_supported - the download feature isn't supported by the browser/version
     * @param details.not_succeeded - the download wasn't started or failed, the details attribute may provide more information
     * @param details.details - detail about that error
     * @param details.Returns an object with the following property:
     * @param details.abort - function to be called to cancel this download
     */
    // GM_download;


    /**
 * @typedef {Promise} RequestPromise - (), a custom object extended from Promise
 *
     * @property {Function} onload - identical to `promise.then()`
     * @property {Function} onerror -
     * @property {Function} onprogress -
     * @property {Function} ontimeout -
     * @property {Function} onabort -
     * @property {Function} onloadstart -
     * @property {Function} onreadystatechange -
     */

    /**
     * @typedef {Tampermonkey.DownloadRequest} downloadOptions
     * @property {string}    url
     * @property {string}    name
     * @property {bool}      [rename=true]
     * @property {string}    directory
     * @property {string[]}  fallbackUrls - list of urls
     * @property {Element}   element - an HTML element
     * @property {string}    mainDirectory
     * @property {string}    directory
     * @property {string}    fileExtension
     * @property {number}    blobTimeout - set this value to save memory, delete a download blob object after it times out
     * @property {number}    attempts - Each download has a few attempts before it gives up.
     * @property {Function}  onload
     * @property {Function}  onerror
     * @property {Function}  ondownload - when the file is finally downloaded to the file system, not just to the browser
     *  Having the element could be helpful getting it's ATTRIBUTES (such as: "download-name")
     */

 //TODO: FIXME: there's an issue with filenames ending with '_', like "example.gif_", this is an issue (not sure where it's happening)

// main
(function () {


    if (typeof unsafeWindow === 'undefined') unsafeWindow = window;

    const MAX_NAME_LENGTH = 128;

    // Note: directory names should include the trailing "/" path terminator
    const Config = $.extend({
        NAME_FILES_BY_NUMBER: false,
        MAX_DOWNLOADS: 200,// maximum number of downloads per batch
        defaultDownloadAttempts: 2,// Default number of download attempts until giving up
        MAIN_DIRECTORY: 'GM_Downloads/',// [ ↓ ⇓ ]
        IndividualDirectoryName: '', // example: "_misc/"
        NEST_DIRECTORIES: true,// if set to true: batch directories will be stored under the main tempDirectory.
        ALLOW_BASE64_IMAGE_DOWNLOADS: false,
        ALLOW_DUPES: true,
        NAME_ATTRIBUTES: ['download-name', 'title', 'img-title', 'subtitle', 'alt', 'content', 'description', 'name'],
        BLACK_LIST: new Set(['https://raw.githubusercontent.com/RaitaroH/DuckDuckGo-DeepDark/master/Images/BigLogo.png']),
        saveDownloadHistory: true,
    }, GM_getValue('Config'));

    const invalidNameCharacters = '@*:"|<>\\n\\r\?\~' + '\u200f';
    var isValidExtension = ext => typeof (ext) === 'string' && !/com|exe/i.test(ext) && ext.length > 0 && ext.length <= 3;

    var debug = true;
    var fileNumber = 1;

    // a list containing all the download urls in this session (used for checking if we already downloaded this item).
    var downloadedSet;
    if (!downloadedSet) {
        downloadedSet = new Set();
    }
    unsafeWindow.downloadedSet = downloadedSet;


    /**
     * @param url
     * @param {Object} opts - {
     *   method: String,
     *   url: String,
     *   params: String | Object,
     *   headers: Object
     * }
     * @returns {(RequestPromise|Promise)}
     */
    function GM_fetch(url, opts = {}) {
        opts.fetch = true;
        return GM_xmlhttpRequestPromise(url, opts);
    }

    GM_xmlhttpRequest.fetch = GM_fetch;


    /** returns full path, not just partial path */
    var normalizeUrl = (function () {
        var fakeLink = document.createElement('a');
        return function (url) {
            fakeLink.href = url;
            return fakeLink.href;
        }
    })();

    /**
     * zips that have been initiated but have not yet been generated
     * @type {Set<any>}
     */
    var pendingZips = new Set();
    // just globally keeping track of all the zips
    if (!unsafeWindow.zips) {
        unsafeWindow.zips = [];
    }

    /** mimeTypeJSON contains the mimeType to file extension database, useful for getting the extension from the mimetype */
    if (!(typeof unsafeWindow.mimeTypes === 'object' && Object.keys(unsafeWindow.mimeTypes).length > 0)) {
        GM_fetch('https://cdn.rawgit.com/jshttp/mime-db/master/db.json', {
            method: 'GET', // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, cors, *same-origin
            cache: 'force-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, *same-origin, omit
            headers: {
                //         'Content-Type': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            redirect: 'follow', // manual, *follow, error
            referrer: 'no-referrer', // no-referrer, *client
            body: null, // body data type must match "Content-Type" header
        }).then(res => {
            const json = JSON.parse(res.responseText);
            if (typeof unsafeWindow.mimeTypes === 'object' && Object.keys(unsafeWindow.mimeTypes).length > 0) {
                debug && console.debug('unsafeWindow already contains unsafeWindow.mimeTypes, no need to load another one');
                return;
            }
            unsafeWindow.mimeTypes = json;
            console.log('unsafeWindow.mimeTypes:', json);
        }).catch(res => {
            console.error('loading json failed', res);
            unsafeWindow.mimeTypes = {};
        });
    }

    if (Config.saveDownloadHistory) {
        window.addEventListener('beforeunload', function (event) {
            // merge and store the download history
            storeDownloadHistory();
            return true;
        });
    }

    (function extendJSZip() {
        if (typeof JSZip === 'undefined') {
            console.warn('downloader_script: JSZip is undefined in downloader script, if you\'re using this script via @require, be sure to also include its dependencies (check script @require).' +
                '\nMost likely missing:', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.4/jszip.min.js');
            return;
        }

        /** The current file index being downloaded/added to the zip */
        JSZip.prototype.current = 0;
        /**
             The total count of files to be zipped+already zipped.
             This is useful for automatically generating the zip when zip.current >= zip.zipTotal
             */
            JSZip.prototype.zipTotal = 0;
            JSZip.prototype.totalSize = 0;
            JSZip.prototype.totalLoaded = 0;

        JSZip.prototype.generateIndexHtml = function generateIndexHtml(local = true) {
            const $body = $('<body>');
                for (const key of Object.keys(this.files)) {
                    try {
                        const file = this.files[key];
                        /**{url, name, page}*/
                        const data = JSON.parse(file.comment ? file.comment : '{}');

                        //TODO: replace this with using the element API, using raw strings causes issues
                    const fname = '' + file.name;
                    const src = '' + data.page;

                    $body.append(
                        $('<div class="container">')
                            .append(
                                $('<a class="local">local</a>')
                                    .attr({
                                        'href': String(data.url || file.name),
                                    })
                                    .append(
                                        $('<img class="local" alt="local image failed to load">')
                                            .attr({
                                                src: fname,
                                                alt: fname,
                                            })
                                    )
                            )
                            .append(
                                $('<div class="online">')
                                    .append(
                                        $('<a  class="online" target="_blank">')
                                            .attr({
                                                href: src,
                                            })
                                            .text(fname)
                                    )
                                    .append(
                                        $('<h4>').text(fname)
                                    )
                            )
                            .append(
                                $('<h3>').text(String(data.name || file.name))
                            )
                    );

                    } catch (e) {
                    console.error(e);
                    }
                }

            return this.file('index.html', new Blob([$body.html()], {type: 'text/plain'}));
            };
            JSZip.prototype.isZipGenerated = false; // has the zip been generated/downloaded?
            JSZip.prototype.name = '';
            JSZip.prototype.__defineGetter__('pathname', function () {
            return `${Config.MAIN_DIRECTORY}${this.name} [${Object.keys(this.files).length}].zip`;
        });

        JSZip.prototype._inactivityTimeout = 20 * 1000;

        /**
         * reset the _inactivityTimeout
         *
         * auto genZip() when zip is fetches are inactive for a long time (when the requests die out)
         * this timeout will be called when the fetches are inactive for a time longer than 'timeoutToAutoGenZip'
         */
        JSZip.prototype.startInactivityTimeout = function () {
            clearTimeout(this._inactivityTimeout); // clear any already existing timeout
            this._inactivityTimeout = setTimeout(() => this.genZip(), this._inactivityTimeout);
        };

        /**called when the zip is generated*/
        // TODO: maybe use an EventEmitter instead of setting a single function
        JSZip.prototype.onGenZip = function () {
                console.log('onGenZip()', this);
            };

        /**
         * @param {(Object[]|Downloadable[])=} fileUrls  this should be an iterable containing objects, each containing the fileUrl and the desired fileName.
         *  if empty, will use images matching this selector by default: "img.img-big"
         *
         * @param {string=} zipName
         * @return {Promise<?>} TODO: specify type
         */
        JSZip.prototype.zipFiles = function(fileUrls, zipName = '') {
            const zip = this;

            pendingZips.add(zip);
            zip.name = (zipName ? zipName : document.title).replace(/\//g, ' ');
            var pb = zip.progressBar; // init progressBar
            zip.fetchList = [];

            const files = Array.from(fileUrls || document.querySelectorAll('img.img-big, img[loaded="true"]'))
                .map(normalizeFile)
                .filter(file => !!file && file.url);

            zip.zipTotal = files.length;

            window.addEventListener('beforeunload', zipBeforeUnload);
            console.log('zipping files:', files);

            // give access to the zip variable by adding it to the global object
            console.log(
                `zip object reference, To access, use:    window.zips[${unsafeWindow.zips.length}]\n`, zip
            );
            unsafeWindow.zips.push(zip);

            const promises = [];
            for (const file of files)
                try {
                    const req = zip.requestAndZip(file.url, file.name);
                    promises.push(req);
                } catch (r) {
                    console.error(r);
                }

            //TODO: this should return a promise of when all the files have been zipped,
            //          this can be done using Promise.all(zip.fetchList)
            return Promise.all(promises);
        };

        JSZip.prototype.genZip = function genZip(updateCallback = null) {
            const zip = this;

            clearTimeout(zip._inactivityTimeout);

            zip._ongenZipProgressCounter = 0; //TODO: refactor: delete zip

            if (zip._genZipProgressBar != null) { // if already generating zip
                console.log('genZip(): genZipProgressBar is already defined, gonna finish the old request first and abort this one, try again once it\'s done', zip);
                return;
            }

            zip._genZipProgressBar = new ProgressBar.Circle(zip.progressBar._container, {
                    strokeWidth: 4,
                    easing: 'easeInOut',
                    duration: 1400,
                    color: '#FCB03C',
                    trailColor: '#eee',
                    trailWidth: 1,
                    svgStyle: {
                        // width: '100%',
                        height: '100px',
                    },
                    text: {
                        value: '0',
                        style: {
                            // Text color.
                            // Default: same as stroke color (options.color)
                            color: '#999',
                            position: 'absolute',
                            right: '0',
                            top: '30px',
                            padding: 0,
                            margin: 0,
                            transform: null
                        },
                        alignToBottom: false,
                        autoStyleContainer: false,
                    },
                    from: {color: '#FFEA82'},
                    to: {color: '#ED6A5A'},
                    step: (state, bar) => {
                        bar.setText(Math.round(bar.value() * 100) + ' %');
                    },
                });

                const _updateCallback = function (metadata) {
                zip._genZipProgressBar.animate(metadata.percent / 100);

                if (++zip._ongenZipProgressCounter % 50 === 0) {
                        console.log('progression: ' + metadata.percent.toFixed(2) + ' %');
                        if (metadata.currentFile) {
                            console.log('current file = ' + metadata.currentFile);
                        }
                    }

                    if (typeof (updateCallback) === 'function')
                        updateCallback.call(zip, metadata);
                };


                return zip.generateIndexHtml()
                    .generateAsync({type: 'blob'}, _updateCallback)
                    .then(blob => {
                        const objectUrl = URL.createObjectURL(blob);
                        console.debug('zip objectUrl\n' + objectUrl);

                        zip.name = zip.name.replace('$name$', document.title);
                        zip.isZipGenerated = true;


                        // remove from pendingZips set
                        const result = pendingZips.delete(zip);
                        if (result === false) {
                            console.warn('warning: zip was generated and was never even initiated. Check pendingZips')
                        }

                    const onload = function (e) {
                        zip.onDownload && zip.onDownload();
                        zip._genZipProgressBar && zip._genZipProgressBar.destroy();
                        zip._genZipProgressBar = undefined;

                        zip.onGenZip && zip.onGenZip();
                    };

                        return GM_download({
                            url: objectUrl,
                            name: zip.pathname,
                        onload: onload,
                            onerror: function (e) {
                                console.warn('couldn\'t download zip', zip, e);
                                saveByAnchor(objectUrl, zip.pathname);
                            onload(e);
                            }
                        });
                    });
            };

            /**
             * @param fname:    the desired file name
             * @returns the first iterated filename valid for the current zip (iterated: with a number added to its end).
             * this is used to prevent overwriting  files with the same name
             */
            JSZip.prototype.getValidIteratedName = function (fname) {
                if (!this.file(fname)) {
                    return fname;
                } else {
                    var numberStr = (fname).match(/\d+/g);
                    var newName = fname;
                    if (numberStr) {
                        numberStr = numberStr.pop();
                        var number = parseInt(numberStr);
                        newName = fname.replace(numberStr, ++number)
                    } else {
                        var split = newName.split('.');
                        newName = split.slice(0, -1).join('.') + (' 1.') + split.slice(-1);
                    }
                    return this.getValidIteratedName(newName);
                }
            };

            JSZip.prototype.current = 0;
            JSZip.prototype.activeZipThreads = 0;
            JSZip.prototype.totalSize = 0;
            JSZip.prototype.totalLoaded = 0;
            /** @type {ProgressBar} */
            JSZip.prototype.__defineGetter__('progressBar', function () {
                if (!this._progressBar)
                    this._progressBar = setupProgressBar();
                return this._progressBar;
            });


        /**
         * @typedef {Object} FetchObject
         *
         */

            //TODO: this should contain all the info related to the file and its request
            /**
             * @type {Promise[]} keeps track of the xhr promises made when calling requestAndZip()
             */
            JSZip.prototype.fetchList = [];

            //FIXME: fix checkResponse
            //TODO: make better arguments
            /**
         * Requests the image and adds it to the local zip
         * @param fileUrl
         * @param fileName
         */
        JSZip.prototype.requestAndZip = function (fileUrl, fileName) {
            var zip = this;
            var fileSize = 0;
            zip.loadedLast = 0;
            zip.activeZipThreads++;

            //TODO: move removeDoubleSpaces and name fixing to getValidIteratedName
            fileName = zip.getValidIteratedName(removeDoubleSpaces(fileName.replace(/\//g, ' ')));

                if (zip.file(fileName)) {
                    console.warn('ZIP already contains the file: ', fileName);
                    return;
                }

            var xhr = {};
            xhr = GM_xmlhttpRequestPromise({
                    method: 'GET',
                    url: fileUrl,
                responseType: 'arraybuffer',
                binary: true,
                onload: res => {
                    zip.startInactivityTimeout();

                    if (zip.file(fileName)) {
                        console.warn('ZIP already contains the file: ', fileName);
                        return;
                        }

                    res && console.debug('onload:', res);

                    const fileExtension = contentTypeToFileExtension(res.headers['content-type']);

                    xhr.res = res;
                    const blob = new Blob([res.response], {type: res.headers['content-type']});

                    const name = `${fileName.trim()}_${zip.current + 1}.${fileExtension}`;

                    console.log(
                        'Adding file to zip:',
                        {
                            fileName: fileName,
                            contentType: res.headers['content-type'],
                            name: name,
                            url: fileUrl,
                        }
                    );

                    zip.file(name, blob);
                    xhr.blob = blob;
                        zip.current++;

                        // if finished, stop
                        if (zip.current < zip.zipTotal || zip.zipTotal <= 0) {
                            return;
                        }

                    // Completed!
                    // TODO: move this outside, make it that when all requestAndZip()s finish
                        if (zip.current >= zip.zipTotal - 1) {
                            debug && console.log('Generating ZIP...\nFile count:', Object.keys(zip.files).length);
                            zip.zipTotal = -1;
                            if (zip.progressBar) zip.progressBar.destroy();
                            zip.genZip();
                        }
                    zip.activeZipThreads--;
                },
                onreadystatechange: res => {
                    zip.startInactivityTimeout();

                    console.debug('Request state changed to: ' + res.readyState);
                    if (res.readyState === 4) {
                        console.debug('ret.readyState === 4');
                    }
                },
                onerror: res => {
                    zip.startInactivityTimeout();

                    console.error('An error occurred:\n', res);

                    zip.activeZipThreads--;
                },
                onprogress: res => {
                    zip.startInactivityTimeout();

                    // FIXME: fix abort condition, when should it abort?
                    const abortCondition = zip.files.hasOwnProperty(fileName) || zip.current < zip.zipTotal || zip.zipTotal <= 0;
                        if (abortCondition && false) {
                            if (xhr.abort) {
                                xhr.abort();
                                console.log('GM_xmlhttpRequest ABORTING zip!!!!!');
                            } else
                                console.error('xhr.abort not defined');
                            return;
                        }

                        if (res.lengthComputable) {
                            if (fileSize === 0) { // happens once
                                fileSize = res.total;
                                zip.totalSize += fileSize;
                            }
                            const loadedSoFar = res.loaded;
                        const justLoaded = loadedSoFar - zip.loadedLast; // What has been added since the last progress call
                        const fileprogress = loadedSoFar / res.total; //

                            zip.totalLoaded += justLoaded;
                            const totalProgress = zip.totalLoaded / zip.totalSize;

                            if (debug) console.debug(
                                'loadedSoFar:', res.loaded,
                                '\njustLoaded:', loadedSoFar - zip.loadedLast,
                                '\nfileprogress:', fileprogress
                            );

                            const progressText = `Files in ZIP: (${Object.keys(zip.files).length} / ${zip.zipTotal}) Active threads: ${zip.activeZipThreads}     (${zip.totalLoaded} / ${zip.totalSize})`;
                            if (zip.progressBar) {
                                zip.progressBar.set(totalProgress);
                                zip.progressBar.setText(progressText);
                            } else {
                                $('#progressbar-container').text(progressText);
                            }

                            zip.loadedLast = loadedSoFar;
                        }
                    },
                });

                zip.fetchList.push(xhr);

                //TODO: use GM_xmlhttpRequestPromise/GM_fetch instead and return that promise
                return xhr;
        };

        //
    })();

    function contentTypeToFileExtension(contentType, mimeTypes = unsafeWindow.mimeTypes) {
        contentType = contentType.split(' ')[0];
        return mimeTypes.hasOwnProperty(contentType) && mimeTypes[contentType] ?
            mimeTypes[contentType].extensions[0] :
            contentType.split('/').pop().match(/\w+/); // match the first few word chars
    }

    function storeDownloadHistory() {
        if (downloadedSet.size <= 0) return;
        const storedDlH = GM_getValue('downloadHistory', []),
            mergedDlH = Array.from(downloadedSet).concat(storedDlH);
        console.debug(
            'storedDlH:', storedDlH,
            'downloadedSet: ', downloadedSet,
            '\nmergedDownloadHistory:', mergedDlH
        );
        return GM_setValue('downloadHistory', Array.from(new Set(mergedDlH)));
    }

    function setNameFilesByNumber(newValue) {
        Config.NAME_FILES_BY_NUMBER = newValue;
        GM_getValue('NAME_FILES_BY_NUMBER', Config.NAME_FILES_BY_NUMBER);
    }


    /** if there's a **special** hostname url (like gify.com), the big url can be extracted */
    function tryToGetBigImageUrl(fileUrl) {
        try {
            const url = new URL(fileUrl);
            if (url.hostname.indexOf('gfycat.com') === 0) {
                url.hostname = 'giant.gfycat.com';
                url.pathname += '.webm';
                return url.toString()
            } else
            // "https://pbs.twimg.com/media/"
            if (/pbs\.twimg\.com/.test(url.hostname) && /^\/media/.test(url.pathname)) {
                url.searchParams.set('format', 'jpg');
                url.searchParams.set('name', 'orig');
                return url.toString()
            } else if (/imgur\.com/.test(url.hostname)) {
                const imgurThumbnailToFullres = src => 'https://i.imgur.com/' + src.split('/').pop()
                    .replace(/b\./, '.');// remove the last 'b'
                return imgurThumbnailToFullres(fileUrl)
            }


            if (/https:\/\/gfycat\.com\/gifs\/detail\/.+/.test(fileUrl)) { // if gfycat home page url, image can be extracted
                return `https://thumbs.gfycat.com/${fileUrl.split('/').pop()}-size_restricted.gif`;
            }
        } catch (e) {
        }
        return fileUrl;
    }

    /**
     * Adds chain-able function setters to a promise
     * given a `promise` and a `details` object (any options parameter object)
     *
     * Renames all the function type objects in `details` to by prepending '_' to them,
     * while the original functions will now become the setters.
     *
     * @param {Promise} promise
     * @param {Object} details - this gets mutated
     *
     *
     * @example
     *  details = { onload: function (e) { } }
     *
     *  bindPromiseSetters(promise, details)
     *
     *  // will allow the promise to be used as follows:
     *  // the value of onloadCallback is stored in `promise[_onload] = onloadCallback`
     *  promise.onload(function onloadCallback(res){
     *      ...
     *  }).then(function(res){
     *      ...
     *  }).catch(function(res){
     *      ...
     *  });
     *
     * @private
     */
    function _bindPromiseSetters(promise, details) {
        for (const key of Object.keys(details)) {
            if (typeof details[key] === 'function' && key.charAt(0) !== '_') {
                promise[key] = function (callback) {
                    console.debug('binding setter promise.' + key + '()');
                    details['_' + key] = function (e) {
                        var ret;
                        if (typeof callback === 'function')
                            ret = callback(e);

                        var newPromise = (ret instanceof Promise) ?
                            ret :
                            Promise.resolve(ret);

                        return _bindPromiseSetters(newPromise, details);
                    };
                    return this;
                }
            }
        }

        return promise;
    }

    function _detectXml(text) {
        const blacklistedPhrases = ['Bad request', '<html', '<!DOCTYPE html PUBLIC'];
        const re = new RegExp('(' + blacklistedPhrases.join(')|(') + ')', 'i');
        return re.test(text || '');
    }

    /**
     * Same as download but without cleaning the filename or anything
     * @param o
     * @returns {Object}
     */
    //FIXME: big mess, sort out what variables are needed and what aren't, and what o should contain
    function download2(o) {
        // to the actual downloading part
        // FIXME: to we even need fileUrl and finalName? are they gonna change? aren't they the same as details.name and details.url?
        /**
         * @type Object
         * @property {Function} abort
         */
        var promise = {};

        /**
         * keep in mind that the details object is specific to a single download2() function call, do NOT pass details to another download2(details) function
         * details is to be passed to the GM_download and xmlhttpRequest() only.
         * changing names and urls is to be done with the options objectc o
         * @type {{headers: {}, onerrorFinal: onerrorFinal, onerror: onerror, saveAs: boolean, onloadFinal: onloadFinal, name: (*|string), onprogress: onprogress, url: *, ontimeout: ontimeout, onload: onload}}
         */
        const details = { // defaults
            name: o.name,
            url: o.url,
            onerror: function (r) {
                // remove the url from the list to give it another chance.
                downloadedSet.delete(o.url);
                console.warn(
                    'onerror(): Download failed:',
                    '\nUrl', o.url,
                    '\nError:', r,
                    '\nDetails obj:', details
                );

                if (o.attempts > 0) { // retry
                    console.log('retry:', details);
                    o.attempts--;

                    switch (r.error) {
                        case 'not_succeeded':
                            switch (r.details.current.toLowerCase()) {
                                case 'server_failed': // fall-through
                                case 'network_failed':
                                    // retry as if that didn't even happen
                                    o.attempts = Config.defaultDownloadAttempts;
                                    download2(o);
                                    break;
                                case 'not_whitelisted':
                                    download(
                                        {
                                            url: o.url.replace(/\?.+/, ''),
                                            name: o.name.replace(/\?.+/, '') + '.oops.jpg'
                                        },
                                        null,
                                        null,
                                        {attempts: Config.defaultDownloadAttempts}// FIXME: idk what this is supposed to be, but it's wrong
                                    );
                                    break;
                                case 'user_canceled':
                                    console.log('Download canceled by user.');
                                    break;
                            }
                            break;
                        case 'not_enabled':
                        case 'not_permitted':
                        case 'not_supported':
                            break;
                        case 'not_whitelisted': // fall-through
                        default:
                            // last retry
                            GM_download(details);
                    }
                } else {
                    o.name = `${o.name}.${getFileExtension(o.url)}`;
                    o.onerror && o.onerror(r);
                }

            },
            onload: function onload(res) {
                // res may be undefined because GM_download does NOT pass the response
                if (!res) { //
                    console.warn('onload(res), why is the response undefined?!');
                }

                var blob = new Blob([res.response], {type: 'application/octet-stream'});
                var objectUrl = URL.createObjectURL(blob); // blob url

                debug && console.log(
                    'onload(res)',
                    '\nres:', res,
                    '\nblob:', blob,
                    '\nobjectUrl:', objectUrl
                );

                // FIXME: Uncaught TypeError: Cannot read property 'responseText' of undefined
                if (_detectXml(res.responseText)) {
                    console.error('Response was in XML:', o.url, res.responseText);

                    details.onerror && details.onerror(res);
                    // cancel this download attempt
                    promise && promise.abort && promise.abort();
                    return;
                }

                // TODO: use the mime types in the response to get the file extension

                /**
                 * @param options
                 * @param options.url - the URL from where the data should be downloaded
                 * @param options.name - the filename - for security reasons the file extension needs to be whitelisted at Tampermonkey's options page
                 * @param options.headers - see GM_xmlhttpRequest for more details
                 * @param options.saveAs - boolean value, show a saveAs dialog
                 * @param options.onerror - callback to be executed if this download ended up with an error
                 * @param options.onload - callback to be executed if this download finished
                 * @param options.onprogress - callback to be executed if this download made some progress
                 * @param options.ontimeout - callback to be executed if this download failed due to a timeout
                 */
                var download_details = {
                    url: details.url,
                    name: details.name,
                    headers: details.headers,
                    saveAs: details.saveAs,
                    onerror: details.onerror,
                    onload: () => o.onload && o.onload(res) || o.ondownload && o.ondownload(res),
                    onprogress: details.onprogress,
                    ontimeout: details.ontimeout,
                };
                GM_download(download_details); // use GM_download for the last download bit, this way we can use paths too

                // reduce memory usage
                if (details.blobTimeout !== undefined && details.blobTimeout !== -1) {
                    setTimeout(function () {
                        URL.revokeObjectURL(objectUrl);
                        if ('close' in blob) blob.close(); // File Blob.close() API, not supported by all the browser right now
                        blob = undefined;
                    }, details.blobTimeout);
                }

                downloadedSet.add(o.url);

                console.log('Download finished', o.name, '\n' + o.url);
                details.onloadFinal && details.onloadFinal(res);
            },
            onprogress: function (p) {
                console.debug('Progress:', p);
            },
            saveAs: false,
            headers: null,
            ontimeout: function () {
            },
            onloadFinal: function (res) {
            },
            onerrorFinal: function (rr) { //  default is to try
                GM_download({
                    name: o.name + '.' + getFileExtension(o.url),
                    url: o.url,
                    onload: details.onload(rr),
                    onerror: function (rrr) {
                        console.warn('Download failed:', o.url, rrr);
                        saveByAnchor(o.url, o.name + '.' + getFileExtension(o.url));
                    }
                });
                downloadedSet.delete(o.url); // upon failure, remove the url from the list to give it another chance.
                console.error('Download failed, onerrorFinal():', o.name, o.url, rr);
            },
        };

        // extending the options object (but not taking onerror or onload)
        for (const k of Object.keys(o)) {
            switch (k) {
                case 'onafterload':
                case 'onload':
                    details.onloadFinal = o.onload;
                    break;
                case 'onerror':
                    details.onerrorFinal = o.onerror;
                    break;
                default:
                    details[k] = o[k] || details[k];
                    break;
            }
        }

        promise = GM_xmlhttpRequestPromise(details);
        return promise;
    }


    //TODO: add support for passing url patterns
    /**
     * @param {(downloadOptions|string|Element)} fileUrl the url to the file to download
     * @param {string=} fileName - gets extracted by default
     * @param {(downloadOptions|Object)=} opts - options, note, this is always the last argument
     *      so if only one parameter is passed, it will be considered the options object
     */
    function download(fileUrl, fileName = '', opts = {}) {
        const args = Array.from(arguments);
        /** @type {DownloadOptions} */
        opts = args.pop();
        // if opts was a string (probably directory)
        if (typeof opts === 'string') {
            switch (arguments.length) {
                case 1: // just url
                    opts = {url: fileUrl};
                    break;
                case 2: // no fileName
                    opts = {name: fileName};
                    break;
                case 3: // directory was passed as opts
                    console.warn('download() parameters were updated, 3rd parameter NOT the directory, use opts.directory instead', opts.url);
                    opts = {directory: opts};
                    break;
            }
        }
        if (fileUrl === opts) fileUrl = opts.url;
        if (fileName === opts) fileName = opts.name;

        // if opts was an element
        if (opts instanceof Element) {
            console.warn('download(): element passed in place of opts');
            var element = opts;
            opts = {element: element};

            for (const prop of ['url', 'name', 'directory', 'onload', 'onerror', 'fallbackUrls', 'element', 'mainDirectory', 'directory', 'fileExtension', 'blobTimeout', 'attempts', 'ondownload',]) {
                opts[prop] = element[prop];
            }
        }

        // check if there are enough attempts remaining
        if (typeof opts.attempts === 'number') {
            if (opts.attempts > 0) {
                opts.attempts--;
            } else {
                console.debug('download(): ran out of attempts');
                return;
            }
        }

        // extending defaults
        opts = $.extend({
            url: fileUrl,
            name: fileName,
            fallbackUrls: typeof (PProxy) !== 'undefined' && PProxy.proxyList ? PProxy.proxyList(fileUrl) : [],
            directory: '',
            fileExtension: undefined,
            blobTimeout: -1, // don't delete blobs
            attempts: Config.defaultDownloadAttempts,
            element: undefined,
            mainDirectory: Config.MAIN_DIRECTORY,
            rename: true,
            onload: function (e) {
                console.debug('download():  onload()', e);
            },
            onerror: function (e) {
                console.warn('download():  onerror()', e);
            },
            ondownload: function (e) {
                console.log('download(): ondownload() downloaded (even locally)', opts.url, '\n', e);
            },
        }, opts);

        console.log('URL Added to downloads:', opts.url);

        // if iterable, set the URLs as fallback URLs
        if (typeof opts.url === 'object' && typeof opts.url[Symbol.iterator] === 'function') {
            opts.fallbackUrls.concat(opts.url);
            opts.url = opts.fallbackUrls.shift();
            // throw 'fallback URLs not yet implemented'; //TODO: test fallbackUrls
        }
        opts.fallbackUrls = [].filter.call(opts.fallbackUrls, s => !!s);

        if (!opts.url) throw 'Input URL is null';

        //
        opts.url = tryToGetBigImageUrl(String(opts.url).replace(/["]/gi, ''));

        if (/^data:/.test(opts.url) && !Config.ALLOW_BASE64_IMAGE_DOWNLOADS) {
            console.error('The source is a base64-type, download was prevented:', opts.url);
            throw 'The source is a base64-type, download was prevented: "' + String(opts.url) + '"';
        }
        if (Config.BLACK_LIST.has(opts.url)) {
            console.warn('Blacklisted URL:', opts.url);
            throw 'URL is blacklisted';
        }
        if (downloadedSet.has(opts.url) && !Config.ALLOW_DUPES) {
            throw 'Request to download duplicate file: "' + opts.url + '"\nto avoid this, set Config.ALLOW_DUPES=true';
        }


        // == naming the file

        if (opts.rename === true) {
            opts.name = cleanFileName(opts.name) || // if opts.name passed
                getNameFromElement(opts.element) || //
                nameFile(opts.url) ||
                'a_' + (cleanGibberish(nameFile(document.title)) || cleanGibberish(nameFile(opts.name))) + ' ' + (++fileNumber);
        }
        opts.rename = false; // set to false for successive retries (otherwise the name would be ruined)

        // == naming the directory

        if (opts.directory) {// if downloadDirectory passed
            opts.directory = cleanFileName(opts.directory, true);
        } else { // if directory NOT passed, get directory from the filename
            const split = opts.name.split(/\//);
            if (split.length > 1) {
                [opts.name, opts.directory] = [split.pop(), split.pop()];
            } else {
                opts.directory = '';
            }
        }
        if (opts.directory && opts.directory.slice(-1) !== '/') // adding trailing path terminator
            opts.directory += '/';

        // == file extension
        opts.fileExtension = opts.fileExtension || getFileExtension(opts.url);
        // remove all extra extensions (don't remove it if there isn't a fileExtension)
        if (opts.fileExtension) opts.name = opts.name.replace(RegExp('\.' + opts.fileExtension, 'gi'), '');

        console.debug(
            'final download() args:',
            '\nfileUrl:', opts.url,
            '\ndownloadDirectory:', opts.directory,
            '\nextension:', opts.fileExtension,
            '\nFINAL_NAME:', removeDoubleSpaces(Config.MAIN_DIRECTORY + opts.directory + opts.name + '.' + opts.fileExtension),
            '\n\nopts:', opts,
        );

        // TODO: maybe the function should just stop here, maybe it should just be for renaming/building the opts
        //  this is the point where we just call download2 or something..


        // extending defaults (to prevent null function issues)
        let details = $.extend({
            url: undefined,
            name: undefined,
            headers: undefined,
            saveAs: undefined,
            timeout: undefined,

            onload: function (e) {
                // console.debug('onload()', e);
            },
            onprogress: function (e) {
                // console.debug('onprogress()', e);
            },
            onerror: function (e) {
                // console.debug('onerror()', e);
            },
            ontimeout: function (e) {
                // console.debug('ontimeout()', e);
            },
        }, opts);

        // force these functions to be passed
        details = $.extend(details, {
            name: removeDoubleSpaces(Config.MAIN_DIRECTORY + opts.directory + opts.name + '.' + opts.fileExtension),
            onload: function onload(e) {
                console.log('Download finished', opts.name, '\n' + opts.url, e);
                downloadedSet.add(opts.url);
                if (typeof (opts.onload) === 'function')
                    opts.onload(e);
            },
            onerror: function (r = {error: '', details: {current: ''}}) {
                //EXP: note: this needs to be changed to onerrorfinal once onerrorfinal is implemented
                if (opts.attempts === 1) // this is the last attempt
                    if (typeof (opts.onerror) === 'function')
                        opts.onerror(r);

                downloadedSet.delete(opts.url); // upon failure, remove the url from the list to give it another chance.
                console.warn(
                    'Download failed for link:', opts.url,
                    '\nError:', r,
                    '\nDetails:', r.details
                );
                switch (r.error) {
                    case 'not_succeeded':
                        switch (r.details.current.toLowerCase()) {
                            case 'not_whitelisted':
                                opts.url = opts.url.replace(/\?.*/, '');
                                const idx = opts.name.lastIndexOf('?');
                                opts.name = opts.name.substring(0, idx > -1 ? idx : (opts.name.length + '.oops.jpg'));
                                download(opts);
                                break;
                            case 'user_canceled':
                                console.log('Download canceled by user.');
                                break;
                            case 'server_forbidden':
                            case 'server_failed':
                            case 'network_failed':
                            default:
                                if (opts.fallbackUrls.length)
                                    opts.url = opts.fallbackUrls.shift();
                                download(opts);
                                break;
                        }
                        break;
                    case 'not_enabled':
                    case 'not_permitted':
                    case 'not_supported':
                        break;
                    default:
                        console.warn('unknown error code:', r);
                        if (opts.fallbackUrls.length)
                            opts.url = opts.fallbackUrls.shift();
                        else
                            opts.attempts = 1;
                        download(opts);
                }
            },
        });
        delete details.element;
        delete details.imgEl;

        //FIXME: VM148:9 Uncaught TypeError: Converting circular structure to JSON
        //     --> starting at object with constructor 'HTMLImageElement'
        //     |     property '_meta' -> object with constructor 'Object'
        //     --- property 'imgEl' closes the circle
        GM_download(details);
    }


    function parseResponseHeaders(responseHeaders) {
        return Object.fromEntries(
            (responseHeaders || '').split('\n')
                .map(line => line.split(': '))
                .filter(pair => pair[0] !== undefined && pair[1] !== undefined)
        );
    }

    /**
     * basic promise that will be built up on later, pure GM_download promise
     * @param url
     * @param opts
     * @returns {Promise}
     * @constructor
     */
    function GM_downloadPromise(url, opts = {}) {
        var xhr = {};
        var timeout;
        var details = $.extend({
            url: url,
            name: 'untitled.gif',
            headers: undefined,
            saveAs: false,
            timeout: undefined,

            // actual callbacks (passed by user)
            _onload: () => undefined,
            _onerror: () => undefined,
            _onprogress: () => undefined,
            _ontimeout: () => undefined,
        }, opts);

        // prepend all functions with '_'
        for (const key of Object.keys(details)) {
            if (typeof (details[key]) === 'function' && key[0] !== '_') {
                details['_' + key] = details[key];
                delete details[key];
            }
        }

        const promise = new Promise(function (resolve, reject) {
            console.debug('promise.execute()');
            details = $.extend(details, {
                url: url,

                // the functions that the user passes
                onload: function (res) {
                    if (res && res.status >= 200 && res.status < 300) {
                        // parsing headers object from responseHeaders (string)
                        res.headers = parseResponseHeaders(res.responseHeaders);
                        details._onload(res);
                        resolve(res);
                    } else {
                        reject(res);
                    }
                },
                onerror: function (r) {
                    details._onerror(r);
                    reject(r);
                },
                onprogress: function (p) {
                    details._onprogress(p);
                },
                ontimeout: function (r) {
                    details._ontimeout(r);
                    reject(r);
                },
            });

            //HACK: delay so `details` isn't passed immediately giving the promise time to be constructed
            //      (promise.onprogress().onload().onerror()....)
            timeout = setTimeout(function () {
                console.log('GM_download(', details, ')\n ->', promise);
                try {
                    xhr = GM_download(details);
                } catch (e) {
                    console.error(e);
                    reject(e);
                }
            }, 1);
        });

        // those are the setters (the ones used in the chain)
        _bindPromiseSetters(promise, details);

        promise.onload = promise.then;
        promise.abort = () => {
            clearTimeout(timeout);
            if (xhr && xhr.abort) {
                xhr.abort();
            } else {
                setTimeout(function () {
                    promise.abort();
                }, 0);
            }
        };


        return promise;
    }

    /**
     * @param {(string|Tampermonkey.Request|Object)} url
     * @param {(Tampermonkey.Request|Object)=} opts
     * @returns {RequestPromise}
     *
     * onload will always have a proper response object (will never be null)
     * and the response.headers object is added
     */
    function GM_xmlhttpRequestPromise(url, opts = {}) {
        if (arguments.length === 1 && typeof (url) === 'object') {
            opts = url;
            url = opts.url;
        }

        var timeout;
        var xhr = {};
        var details = $.extend({
            url: url,
            method: 'GET',
            headers: undefined,
            data: undefined,
            binary: undefined,
            timeout: undefined,
            context: undefined,
            responseType: 'arraybuffer',
            overrideMimeType: undefined,
            anonymous: undefined,
            fetch: false,
            username: undefined,
            password: undefined,

            /// actual callbacks (passed by user)
            _onload: (e) => undefined,
            _onerror: (e) => undefined,
            _onprogress: (e) => undefined,
            _ontimeout: (e) => undefined,
            _onabort: (e) => undefined,
            _onloadstart: (e) => undefined,
            _onreadystatechange: (e) => undefined,
        }, opts);

        // prepend all functions with _
        for (const key of Object.keys(details)) {
            if (typeof (details[key]) === 'function' && key[0] !== '_') {
                details['_' + key] = details[key];
                delete details[key];
            }
        }

        const promise = new Promise(function (resolve, reject) {
            details = $.extend(details, {
                url: url,
                // method: 'GET',
                // headers: null,
                // data: null,
                // binary: null,
                // timeout: null,
                // context: {},
                // responseType: 'arraybuffer',
                // overrideMimeType: null,
                // anonymous: null,
                // fetch: false,
                // username: null,
                // password: null,

                /// the functions that the user passes
                onload: function (res) {
                    if (res && res.status >= 200 && res.status < 300) {
                        // parsing headers object from responseHeaders (string)
                        res.headers = parseResponseHeaders(res.responseHeaders);
                        details._onload(res);
                        resolve(res);
                    } else {
                        reject(res);
                    }
                },
                onerror: function (r) {
                    details._onerror(r);
                    reject(r);
                },
                onprogress: function (p) {
                    details._onprogress(p);
                },
                ontimeout: function (r) {
                    details._ontimeout(r);
                    reject(r);
                },
                onabort: function (e) {
                    details._onabort(e);
                    reject(e);
                },
                onloadstart: function (e) {
                    details._onloadstart(e);
                },
                onreadystatechange: function (e) {
                    details._onreadystatechange(e);
                },
            });

            timeout = setTimeout(function () {
                // debug && console.log('GM_xmlhttpRequest(', details, ')\n ->', promise);

                try {
                    xhr = GM_xmlhttpRequest(details);
                } catch (e) {
                    console.error(e);
                    reject(e);
                }

            }, 1);
        });
        _bindPromiseSetters(promise, details);

        // those are the setters (the ones used in the chain)
        // promise.onload = undefined;
        // promise.onerror = undefined;
        promise.abort = () => {
            clearTimeout(timeout);
            if (xhr && xhr.abort) {
                xhr.abort();
            } else {
                setTimeout(function () {
                    promise.abort();
                }, 0);
            }
        };

        return promise;
    }


    try {
        (function () {
            return;
            // //BOOKMARK: was fixing message passsing between successive promise.onload().then()
            GM_xmlhttpRequestPromise('https://i.ytimg.com/vi/RO90omga8D4/maxresdefault.jpg', {
                responseType: 'arraybuffer',
                binary: true,
                // 		method: 'POST',
            })
                .onprogress(function (e) {
                    console.log(
                        'onprogress()',
                        '\nlengthComputable:', e.lengthComputable,
                        '\nloaded:', e.loaded,
                        '\nposition:', e.position,
                        '\ntotal:', e.total,
                        '\ntotalSize:', e.totalSize,
                        '\n', e
                    );
                })
                .ontimeout(function (e) {
                    console.log('ontimeout()', e);
                })
                .onabort(function (e) {
                    console.log('onabort()', e);
                })
                .onloadstart(function (e) {
                    console.log('onloadstart()', e);
                })
                .onreadystatechange(function (e) {
                    console.log('onreadystatechange(), readyState=', e.readyState, '\n', e);
                })

                .onerror(function (e) {
                    console.log('onerror()', e);
                })
                .onload(function (e) {
                    console.log('onload(): SUCCESS!!!', e);
                    return 'onloadReturn';
                })
                .then(e => {
                    if (e === 'onloadReturn') {
                        console.log('AMAZING!!!!!!! onload successfully passed data to then()!!!!');
                    }
                    console.log('then1():', e);
                    return {bekfast: 'bekfast1'};
                })
                .then(e => {
                    console.log('then2():', e);
                })
                .onload(function (e) {
                    console.log('onload() after then()', e);
                });

        })();
    } catch (e) {
        console.error(e);
    }


    function tryDecodeURIComponent(str) {
        try {
            return decodeURIComponent(str);
        } catch (e) {
            debug && console.warn('tryDecodeURIComponent(' + str + '), failed');
            return str;
        }
    }
    /**
    * @param fileUrl
    * @returns filename (without extension)
    */
    function nameFile(fileUrl) {
        if (Config.NAME_FILES_BY_NUMBER === true) return (` ${fileNumber++}`);

        let fileName = 'untitled';
        try {
            fileName = clearUrlGibberish(fileUrl).split('/').pop()
                .split('.')
                .sort((a, b) => b.length - a.length)[0]; // get the long part (ignore short parts like ".com")
        } catch (e) {
            console.error('Failed to name file', fileUrl, e);
        }
        fileName = cleanFileName(fileName);
        fileName = new RegExp(`[${invalidNameCharacters}]`).test(fileName) ? (`${document.title} - untitled`) : fileName;
        return fileName;
    }
    function getFileExtension(fileUrl) {
        var ext = clearUrlGibberish((String(fileUrl)).split(/[.]/).pop()) //the string after the last '.'
            .replace(/[^a-zA-Z0-9.]+($|\?)/gi, '') // replace everything that is non-alpha, numeric nor '.'
            .replace(/[]/gi, '')
        ;

        if (!isValidExtension(ext)) {
            ext = 'oops.gif';
        }

        return ext;
    }

    function cleanFileName(fileName, isDirectory = false) {
        // file names can't include '/' or '\'
        const fileCleanerRegex = new RegExp(`[${invalidNameCharacters}${isDirectory ? '' : '\\\\/'}]|(^[\\W.]+)|(\\s\\s+)`, 'gi');
        return clearUrlGibberish(tryDecodeURIComponent(fileName)).replace(fileCleanerRegex, ' ').trim().slice(MAX_NAME_LENGTH);
    }
    function removeDoubleSpaces(str) {
        return str ? str.replace(/(\s\s+)/g, ' ') : str;
    }
    function clearUrlGibberish(str) {
        return removeDoubleSpaces(tryDecodeURIComponent(str).replace(/(^site)|www(\.?)|http(s?):\/\/|proxy\.duckduckgo|&f=1|&reload=on/gi, ''));
    }

    /**
     * creates an anchor, clicks it, then removes it
     * this is done because some actions cannot be done except in this way
     * @param {string} url
     * @param {string=} name (including file extension)
     * @param {string=} target
     */
    function anchorClick(url, name = '', target = 'self') {
        name = name || nameFile(url) || 'filename';

        var a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', name);
        a.setAttribute('target', target);

        document.documentElement.appendChild(a);
        // call download
        // a.click() or CLICK the download link can't modify filename in Firefox (why?)
        // Solution from FileSaver.js, https://github.com/eligrey/FileSaver.js/
        a.dispatchEvent(new MouseEvent('click'));
        document.documentElement.removeChild(a);
    }
    function saveByAnchor(url, dlName) {
        anchorClick(url, dlName);
    }

    function makeTextFile(text) {
        var data = new Blob([text], {type: 'text/plain'});
        var textFile = null;
        // If we are replacing a previously generated file we need to manually revoke the object URL to avoid memory leaks.
        if (textFile !== null) window.URL.revokeObjectURL(textFile);
        textFile = window.URL.createObjectURL(data);
        return textFile;
    }

    function zipBeforeUnload(e) {
        var dialogText = 'You still didn\'t download your zipped files, are you sure you want to exit?';
        e.returnValue = dialogText;
        return dialogText;
    }

    /**
     * @param fileUrls
     * @param zipName
     * @returns {JSZip|*|JSZip|*}
     * @deprecated use JSZip.prototype.zipFiles()
     */
    function zipFiles(fileUrls, zipName='') {
        var zip = new JSZip();
        zip.zipFiles(fileUrls, zipName);
        return zip;
    }

    //FIXME: this is basically zipFiles with custom error handlers, just extend zipFiles to allow for fallback urls
    /**
     * @deprecated
     * @param imgList
     * @param zipName
     * @returns {JSZip}
     */
    function zipImages(imgList, zipName) {
        return zipFiles(imgList, zipName, function onBadResponse(res, fileUrl) {
            console.debug(
                'onBadResponse()',
                '\nfileURL:', fileUrl,
                '\nresponse.finalURL:', res.finalUrl
            );

            // if not a proxyUrl, try to use a proxy
            if (!PProxy.DDG.test(res.finalUrl || res.url)) {
                console.debug(
                    'retrying with ddgproxy',
                    // '\nddgpURL:', ddgProxy(fileUrl),
                    '\nfileURL:', fileUrl,
                    '\nresponse.finalURL:', res.finalUrl
                );

                const mimeType1 = res.headers['content-type'].split('/')[0];
                const fileExtension = contentTypeToFileExtension(res.headers['content-type']);

                const blob = new Blob([res.response], {type: res.headers['content-type']});

                if (/(<!DOCTYPE)|(<html)/.test(res.responseText) || !/image/i.test(mimeType1)) {
                    console.error('Not image data!', res.responseText);
                    return false;
                }

                //TODO: make it possible to enqueue more files to a zip that's already working
                this.requestAndZip(ddgProxy(fileUrl), fileName);
            } else { // if is a proxy url and it failed, just give up
                return true;
            }
        });
    }


    //TODO: create type: Downloadable or DFile (download file)
    /**
     * extract name and url from the file object
     *
     * @param {Object|string} file - object or URL string
     * @returns {Downloadable}
     *
     *   file.url = file.fileURL || file.fileUrl || file.url || file.src || file.href;
     *   file.name = file.fileName || file.alt || file.title || nameFile(file.fileURL) || "Untitled image";
     */
    function normalizeFile(file) {
        if (!file) return {};

        const dFile = {};
        var url = '';

        if (typeof file === 'string') { // if string
            //TODO: name is never specified here
            url = file;
            file = {};
        }

        function getFirstProperty(o, properties) {
                if (!o) return null;
                for (const p of properties) {
                    if (o[p])
                        return o[p];
            }
        }

        url = url || getFirstProperty(file, ['fileURL', 'fileUrl', 'url', 'src', 'href']);

        dFile.url = tryToGetBigImageUrl(url);
        dFile.name = getFirstProperty(file, ['fileName', 'name', 'download-name', 'alt', 'title']) || nameFile(file.url) || 'Untitled';


        dFile.fileExtension = getFileExtension(dFile.name);
        if(!dFile.fileExtension){
            dFile.fileExtension = getFileExtension(url);
            dFile.name += dFile.fileExtension;
        }

        dFile.name = cleanFileName(dFile.name);

        return dFile;
    }


    function setupProgressBar() {
        const container = document.createElement('div');
        const $container = $(container).attr({
            'id': 'progressbar-container'
        }).addClass('progressbar-container').css({
            'position': 'fixed',
            'top': '0',
            'left': '0',
            'width': '100%',
            // 'height': '100%',
            'min-height': '30px',
            'padding': '10px 0',
            'background-color': '#36465d',
            'box-shadow': '0 0 0 1px hsla(0,0%,100%,.13)',
            'z-index': '999999999'
        });

        document.body.firstElementChild.before(container);

        if (typeof (ProgressBar) === 'undefined') {
            console.error('ProgressBar.js is not defined.');
            return {};
        }

        // noinspection JSUnresolvedVariable
        const progressBar = new ProgressBar.Line(container, {
            strokeWidth: 4,
            easing: 'easeInOut',
            duration: 1400,
            color: '#FCB03C',
            trailColor: '#eee',
            trailWidth: 1,
            svgStyle: {width: '100%', height: '100%'},
            text: {
                value: '0',
                style: {
                    // color: '#999',// Default: same as stroke color (options.color)
                    display: 'inline',
                    position: 'relative',
                    right: '0',
                    top: '30px',
                    padding: 0,
                    margin: 0,
                    transform: null
                },
                alignToBottom: false,
                autoStyleContainer: false,
            },
            from: {color: '#FFEA82'},
            to: {color: '#ED6A5A'},
            step: (state, bar) => {
                // bar.setText(Math.round(bar.value() * 100) + ' %');
            },
        });
        console.log('progressBar:', progressBar);

        progressBar.set(0);

        return progressBar;
    }

    function saveBase64AsFile(base64, fileName) {
        var link = document.createElement('a');

        link.setAttribute('href', base64);
        link.setAttribute('download', fileName);
        link.click();
    }
    function saveBlobAsFile(blob, fileName) {
        var reader = new FileReader();

        reader.onloadend = function () {
            var base64 = reader.result;
            var link = document.createElement('a');

            link.setAttribute('href', base64);
            link.setAttribute('download', fileName);
            link.click();
        };

        reader.readAsDataURL(blob);
    }

    // unsafeWindow.imageUrl2blob = imageUrl2blob;
    function imageUrl2blob(url, callback, callbackParams) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url || 'https://i.ytimg.com/vi/RO90omga8D4/maxresdefault.jpg',
            responseType: 'arraybuffer',
            binary: true,
            onload: /** @param {XMLHttpRequest} res */ function (res) {
                try {
                    const ext = getFileExtension(url);
                    var blob = new Blob([res.response], {type: 'image/' + ext});
                    if (!!callback) {
                        callback(blob, url, callbackParams);
                    } else {
                        if (typeof saveAs === 'function')
                            saveAs(blob, 'untitled.' + ext);
                    }

                    console.debug('GM_xmlhttpRequest load', res, 'myblob:', blob);
                    console.debug([
                        res.status,
                        res.statusText,
                        res.readyState,
                        res.responseHeaders,
                        res.responseText,
                        res.finalUrl
                    ].join('\n'));
                } catch (e) {
                    console.error(e);
                }
            },

            onreadystatechange: function (res) {
                console.log('Request state changed to: ' + res.readyState);
                if (res.readyState === 4) {
                    console.log('ret.readyState === 4');
                }
            },
            onerror: /** @param {XMLHttpRequest} res */ function (res) {
                console.error(
                    'An error occurred.' +
                    '\nresponseText: ', res.responseText,
                    '\nreadyState: ', res.readyState,
                    '\nresponseHeaders: ', res.responseHeaders,
                    '\nstatus: ', res.status,
                    '\nstatusText: ', res.statusText,
                    '\nfinalUrl: ', res.finalUrl
                );
            },
            onprogress: function (res) {
                if (res.lengthComputable) {
                    console.log('progress:', res.loaded / res.total);
                }
            }
        });
    }

    function getFilenameSimple(url) {
        if (!url)
            return '';

            var m = url.toString().match(/.*\/(.+?)\./);
            if (m && m.length > 1) {
                return m[1];
            }
    }

    function getNameFromElement(element) {
        if (!(element instanceof Element)) return;
        for (const attrName of Config.NAME_ATTRIBUTES) {
            const attrValue = element.getAttribute(attrName);
            if (attrValue) {
                return attrValue;
            }
        }
    }

    unsafeWindow.JSZip = JSZip;
    unsafeWindow.setNameFilesByNumber = setNameFilesByNumber;
    unsafeWindow.download = download;
    unsafeWindow.GM_download = GM_download;
    unsafeWindow.getFileExtension = getFileExtension;
    unsafeWindow.nameFile = nameFile;
    unsafeWindow.makeTextFile = makeTextFile;
    unsafeWindow.anchorClick = anchorClick;
    unsafeWindow.saveByAnchor = saveByAnchor;
    unsafeWindow.zipFiles = zipFiles;
    unsafeWindow.zipImages = zipImages;
    unsafeWindow.storeDownloadHistory = storeDownloadHistory;
    unsafeWindow.GM_fetch = GM_fetch;
    unsafeWindow.GM_xmlhttpRequest = GM_xmlhttpRequest;
    unsafeWindow.GM_downloadPromise = GM_downloadPromise;
    unsafeWindow.GM_xmlhttpRequestPromise = GM_xmlhttpRequestPromise;

    unsafeWindow.MAIN_DIRECTORY = Config.MAIN_DIRECTORY;

    // FIXME: doesn't work
    function exposeSymbols(symbols, root = this, override = false) {
        for (const symbol of symbols) {
            if (!root) {
                console.debug('exposeSymbols: root didn\'t have symbol "' + symbol + '"', root);
                continue;
            }
            if (!(override || !unsafeWindow[symbol])) {
                console.debug('exposeSymbols: symbol already in unsafeWindow or override===true "' + symbol + '"', override);
                continue;
            }
            console.log('exposing "' + symbol + '": ', unsafeWindow[symbol], root[symbol]);
            unsafeWindow[symbol] = root[symbol];
        }
    }

})();


// ProgressBar.js
!function(a){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=a();else if("function"==typeof define&&define.amd)define([],a);else{var b;b="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,b.ProgressBar=a()}}(function(){var a;return function a(b,c,d){function e(g,h){if(!c[g]){if(!b[g]){var i="function"==typeof require&&require;if(!h&&i)return i(g,!0);if(f)return f(g,!0);var j=new Error("Cannot find module '"+g+"'");throw j.code="MODULE_NOT_FOUND",j}var k=c[g]={exports:{}};b[g][0].call(k.exports,function(a){var c=b[g][1][a];return e(c?c:a)},k,k.exports,a,b,c,d)}return c[g].exports}for(var f="function"==typeof require&&require,g=0;g<d.length;g++)e(d[g]);return e}({1:[function(b,c,d){(function(){var b=this||Function("return this")(),e=function(){"use strict";function e(){}function f(a,b){var c;for(c in a)Object.hasOwnProperty.call(a,c)&&b(c)}function g(a,b){return f(b,function(c){a[c]=b[c]}),a}function h(a,b){f(b,function(c){"undefined"==typeof a[c]&&(a[c]=b[c])})}function i(a,b,c,d,e,f,g){var h,i,k,l=a<f?0:(a-f)/e;for(h in b)b.hasOwnProperty(h)&&(i=g[h],k="function"==typeof i?i:o[i],b[h]=j(c[h],d[h],k,l));return b}function j(a,b,c,d){return a+(b-a)*c(d)}function k(a,b){var c=n.prototype.filter,d=a._filterArgs;f(c,function(e){"undefined"!=typeof c[e][b]&&c[e][b].apply(a,d)})}function l(a,b,c,d,e,f,g,h,j,l,m){v=b+c+d,w=Math.min(m||u(),v),x=w>=v,y=d-(v-w),a.isPlaying()&&(x?(j(g,a._attachment,y),a.stop(!0)):(a._scheduleId=l(a._timeoutHandler,s),k(a,"beforeTween"),w<b+c?i(1,e,f,g,1,1,h):i(w,e,f,g,d,b+c,h),k(a,"afterTween"),j(e,a._attachment,y)))}function m(a,b){var c={},d=typeof b;return"string"===d||"function"===d?f(a,function(a){c[a]=b}):f(a,function(a){c[a]||(c[a]=b[a]||q)}),c}function n(a,b){this._currentState=a||{},this._configured=!1,this._scheduleFunction=p,"undefined"!=typeof b&&this.setConfig(b)}var o,p,q="linear",r=500,s=1e3/60,t=Date.now?Date.now:function(){return+new Date},u="undefined"!=typeof SHIFTY_DEBUG_NOW?SHIFTY_DEBUG_NOW:t;p="undefined"!=typeof window?window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||window.mozCancelRequestAnimationFrame&&window.mozRequestAnimationFrame||setTimeout:setTimeout;var v,w,x,y;return n.prototype.tween=function(a){return this._isTweening?this:(void 0===a&&this._configured||this.setConfig(a),this._timestamp=u(),this._start(this.get(),this._attachment),this.resume())},n.prototype.setConfig=function(a){a=a||{},this._configured=!0,this._attachment=a.attachment,this._pausedAtTime=null,this._scheduleId=null,this._delay=a.delay||0,this._start=a.start||e,this._step=a.step||e,this._finish=a.finish||e,this._duration=a.duration||r,this._currentState=g({},a.from||this.get()),this._originalState=this.get(),this._targetState=g({},a.to||this.get());var b=this;this._timeoutHandler=function(){l(b,b._timestamp,b._delay,b._duration,b._currentState,b._originalState,b._targetState,b._easing,b._step,b._scheduleFunction)};var c=this._currentState,d=this._targetState;return h(d,c),this._easing=m(c,a.easing||q),this._filterArgs=[c,this._originalState,d,this._easing],k(this,"tweenCreated"),this},n.prototype.get=function(){return g({},this._currentState)},n.prototype.set=function(a){this._currentState=a},n.prototype.pause=function(){return this._pausedAtTime=u(),this._isPaused=!0,this},n.prototype.resume=function(){return this._isPaused&&(this._timestamp+=u()-this._pausedAtTime),this._isPaused=!1,this._isTweening=!0,this._timeoutHandler(),this},n.prototype.seek=function(a){a=Math.max(a,0);var b=u();return this._timestamp+a===0?this:(this._timestamp=b-a,this.isPlaying()||(this._isTweening=!0,this._isPaused=!1,l(this,this._timestamp,this._delay,this._duration,this._currentState,this._originalState,this._targetState,this._easing,this._step,this._scheduleFunction,b),this.pause()),this)},n.prototype.stop=function(a){return this._isTweening=!1,this._isPaused=!1,this._timeoutHandler=e,(b.cancelAnimationFrame||b.webkitCancelAnimationFrame||b.oCancelAnimationFrame||b.msCancelAnimationFrame||b.mozCancelRequestAnimationFrame||b.clearTimeout)(this._scheduleId),a&&(k(this,"beforeTween"),i(1,this._currentState,this._originalState,this._targetState,1,0,this._easing),k(this,"afterTween"),k(this,"afterTweenEnd"),this._finish.call(this,this._currentState,this._attachment)),this},n.prototype.isPlaying=function(){return this._isTweening&&!this._isPaused},n.prototype.setScheduleFunction=function(a){this._scheduleFunction=a},n.prototype.dispose=function(){var a;for(a in this)this.hasOwnProperty(a)&&delete this[a]},n.prototype.filter={},n.prototype.formula={linear:function(a){return a}},o=n.prototype.formula,g(n,{now:u,each:f,tweenProps:i,tweenProp:j,applyFilter:k,shallowCopy:g,defaults:h,composeEasingObject:m}),"function"==typeof SHIFTY_DEBUG_NOW&&(b.timeoutHandler=l),"object"==typeof d?c.exports=n:"function"==typeof a&&a.amd?a(function(){return n}):"undefined"==typeof b.Tweenable&&(b.Tweenable=n),n}();!function(){e.shallowCopy(e.prototype.formula,{easeInQuad:function(a){return Math.pow(a,2)},easeOutQuad:function(a){return-(Math.pow(a-1,2)-1)},easeInOutQuad:function(a){return(a/=.5)<1?.5*Math.pow(a,2):-.5*((a-=2)*a-2)},easeInCubic:function(a){return Math.pow(a,3)},easeOutCubic:function(a){return Math.pow(a-1,3)+1},easeInOutCubic:function(a){return(a/=.5)<1?.5*Math.pow(a,3):.5*(Math.pow(a-2,3)+2)},easeInQuart:function(a){return Math.pow(a,4)},easeOutQuart:function(a){return-(Math.pow(a-1,4)-1)},easeInOutQuart:function(a){return(a/=.5)<1?.5*Math.pow(a,4):-.5*((a-=2)*Math.pow(a,3)-2)},easeInQuint:function(a){return Math.pow(a,5)},easeOutQuint:function(a){return Math.pow(a-1,5)+1},easeInOutQuint:function(a){return(a/=.5)<1?.5*Math.pow(a,5):.5*(Math.pow(a-2,5)+2)},easeInSine:function(a){return-Math.cos(a*(Math.PI/2))+1},easeOutSine:function(a){return Math.sin(a*(Math.PI/2))},easeInOutSine:function(a){return-.5*(Math.cos(Math.PI*a)-1)},easeInExpo:function(a){return 0===a?0:Math.pow(2,10*(a-1))},easeOutExpo:function(a){return 1===a?1:-Math.pow(2,-10*a)+1},easeInOutExpo:function(a){return 0===a?0:1===a?1:(a/=.5)<1?.5*Math.pow(2,10*(a-1)):.5*(-Math.pow(2,-10*--a)+2)},easeInCirc:function(a){return-(Math.sqrt(1-a*a)-1)},easeOutCirc:function(a){return Math.sqrt(1-Math.pow(a-1,2))},easeInOutCirc:function(a){return(a/=.5)<1?-.5*(Math.sqrt(1-a*a)-1):.5*(Math.sqrt(1-(a-=2)*a)+1)},easeOutBounce:function(a){return a<1/2.75?7.5625*a*a:a<2/2.75?7.5625*(a-=1.5/2.75)*a+.75:a<2.5/2.75?7.5625*(a-=2.25/2.75)*a+.9375:7.5625*(a-=2.625/2.75)*a+.984375},easeInBack:function(a){var b=1.70158;return a*a*((b+1)*a-b)},easeOutBack:function(a){var b=1.70158;return(a-=1)*a*((b+1)*a+b)+1},easeInOutBack:function(a){var b=1.70158;return(a/=.5)<1?.5*(a*a*(((b*=1.525)+1)*a-b)):.5*((a-=2)*a*(((b*=1.525)+1)*a+b)+2)},elastic:function(a){return-1*Math.pow(4,-8*a)*Math.sin((6*a-1)*(2*Math.PI)/2)+1},swingFromTo:function(a){var b=1.70158;return(a/=.5)<1?.5*(a*a*(((b*=1.525)+1)*a-b)):.5*((a-=2)*a*(((b*=1.525)+1)*a+b)+2)},swingFrom:function(a){var b=1.70158;return a*a*((b+1)*a-b)},swingTo:function(a){var b=1.70158;return(a-=1)*a*((b+1)*a+b)+1},bounce:function(a){return a<1/2.75?7.5625*a*a:a<2/2.75?7.5625*(a-=1.5/2.75)*a+.75:a<2.5/2.75?7.5625*(a-=2.25/2.75)*a+.9375:7.5625*(a-=2.625/2.75)*a+.984375},bouncePast:function(a){return a<1/2.75?7.5625*a*a:a<2/2.75?2-(7.5625*(a-=1.5/2.75)*a+.75):a<2.5/2.75?2-(7.5625*(a-=2.25/2.75)*a+.9375):2-(7.5625*(a-=2.625/2.75)*a+.984375)},easeFromTo:function(a){return(a/=.5)<1?.5*Math.pow(a,4):-.5*((a-=2)*Math.pow(a,3)-2)},easeFrom:function(a){return Math.pow(a,4)},easeTo:function(a){return Math.pow(a,.25)}})}(),function(){function a(a,b,c,d,e,f){function g(a){return((n*a+o)*a+p)*a}function h(a){return((q*a+r)*a+s)*a}function i(a){return(3*n*a+2*o)*a+p}function j(a){return 1/(200*a)}function k(a,b){return h(m(a,b))}function l(a){return a>=0?a:0-a}function m(a,b){var c,d,e,f,h,j;for(e=a,j=0;j<8;j++){if(f=g(e)-a,l(f)<b)return e;if(h=i(e),l(h)<1e-6)break;e-=f/h}if(c=0,d=1,e=a,e<c)return c;if(e>d)return d;for(;c<d;){if(f=g(e),l(f-a)<b)return e;a>f?c=e:d=e,e=.5*(d-c)+c}return e}var n=0,o=0,p=0,q=0,r=0,s=0;return p=3*b,o=3*(d-b)-p,n=1-p-o,s=3*c,r=3*(e-c)-s,q=1-s-r,k(a,j(f))}function b(b,c,d,e){return function(f){return a(f,b,c,d,e,1)}}e.setBezierFunction=function(a,c,d,f,g){var h=b(c,d,f,g);return h.displayName=a,h.x1=c,h.y1=d,h.x2=f,h.y2=g,e.prototype.formula[a]=h},e.unsetBezierFunction=function(a){delete e.prototype.formula[a]}}(),function(){function a(a,b,c,d,f,g){return e.tweenProps(d,b,a,c,1,g,f)}var b=new e;b._filterArgs=[],e.interpolate=function(c,d,f,g,h){var i=e.shallowCopy({},c),j=h||0,k=e.composeEasingObject(c,g||"linear");b.set({});var l=b._filterArgs;l.length=0,l[0]=i,l[1]=c,l[2]=d,l[3]=k,e.applyFilter(b,"tweenCreated"),e.applyFilter(b,"beforeTween");var m=a(c,i,d,f,k,j);return e.applyFilter(b,"afterTween"),m}}(),function(a){function b(a,b){var c,d=[],e=a.length;for(c=0;c<e;c++)d.push("_"+b+"_"+c);return d}function c(a){var b=a.match(v);return b?(1===b.length||a.charAt(0).match(u))&&b.unshift(""):b=["",""],b.join(A)}function d(b){a.each(b,function(a){var c=b[a];"string"==typeof c&&c.match(z)&&(b[a]=e(c))})}function e(a){return i(z,a,f)}function f(a){var b=g(a);return"rgb("+b[0]+","+b[1]+","+b[2]+")"}function g(a){return a=a.replace(/#/,""),3===a.length&&(a=a.split(""),a=a[0]+a[0]+a[1]+a[1]+a[2]+a[2]),B[0]=h(a.substr(0,2)),B[1]=h(a.substr(2,2)),B[2]=h(a.substr(4,2)),B}function h(a){return parseInt(a,16)}function i(a,b,c){var d=b.match(a),e=b.replace(a,A);if(d)for(var f,g=d.length,h=0;h<g;h++)f=d.shift(),e=e.replace(A,c(f));return e}function j(a){return i(x,a,k)}function k(a){for(var b=a.match(w),c=b.length,d=a.match(y)[0],e=0;e<c;e++)d+=parseInt(b[e],10)+",";return d=d.slice(0,-1)+")"}function l(d){var e={};return a.each(d,function(a){var f=d[a];if("string"==typeof f){var g=r(f);e[a]={formatString:c(f),chunkNames:b(g,a)}}}),e}function m(b,c){a.each(c,function(a){for(var d=b[a],e=r(d),f=e.length,g=0;g<f;g++)b[c[a].chunkNames[g]]=+e[g];delete b[a]})}function n(b,c){a.each(c,function(a){var d=b[a],e=o(b,c[a].chunkNames),f=p(e,c[a].chunkNames);d=q(c[a].formatString,f),b[a]=j(d)})}function o(a,b){for(var c,d={},e=b.length,f=0;f<e;f++)c=b[f],d[c]=a[c],delete a[c];return d}function p(a,b){C.length=0;for(var c=b.length,d=0;d<c;d++)C.push(a[b[d]]);return C}function q(a,b){for(var c=a,d=b.length,e=0;e<d;e++)c=c.replace(A,+b[e].toFixed(4));return c}function r(a){return a.match(w)}function s(b,c){a.each(c,function(a){var d,e=c[a],f=e.chunkNames,g=f.length,h=b[a];if("string"==typeof h){var i=h.split(" "),j=i[i.length-1];for(d=0;d<g;d++)b[f[d]]=i[d]||j}else for(d=0;d<g;d++)b[f[d]]=h;delete b[a]})}function t(b,c){a.each(c,function(a){var d=c[a],e=d.chunkNames,f=e.length,g=b[e[0]],h=typeof g;if("string"===h){for(var i="",j=0;j<f;j++)i+=" "+b[e[j]],delete b[e[j]];b[a]=i.substr(1)}else b[a]=g})}var u=/(\d|\-|\.)/,v=/([^\-0-9\.]+)/g,w=/[0-9.\-]+/g,x=new RegExp("rgb\\("+w.source+/,\s*/.source+w.source+/,\s*/.source+w.source+"\\)","g"),y=/^.*\(/,z=/#([0-9]|[a-f]){3,6}/gi,A="VAL",B=[],C=[];a.prototype.filter.token={tweenCreated:function(a,b,c,e){d(a),d(b),d(c),this._tokenData=l(a)},beforeTween:function(a,b,c,d){s(d,this._tokenData),m(a,this._tokenData),m(b,this._tokenData),m(c,this._tokenData)},afterTween:function(a,b,c,d){n(a,this._tokenData),n(b,this._tokenData),n(c,this._tokenData),t(d,this._tokenData)}}}(e)}).call(null)},{}],2:[function(a,b,c){var d=a("./shape"),e=a("./utils"),f=function(a,b){this._pathTemplate="M 50,50 m 0,-{radius} a {radius},{radius} 0 1 1 0,{2radius} a {radius},{radius} 0 1 1 0,-{2radius}",this.containerAspectRatio=1,d.apply(this,arguments)};f.prototype=new d,f.prototype.constructor=f,f.prototype._pathString=function(a){var b=a.strokeWidth;a.trailWidth&&a.trailWidth>a.strokeWidth&&(b=a.trailWidth);var c=50-b/2;return e.render(this._pathTemplate,{radius:c,"2radius":2*c})},f.prototype._trailString=function(a){return this._pathString(a)},b.exports=f},{"./shape":7,"./utils":9}],3:[function(a,b,c){var d=a("./shape"),e=a("./utils"),f=function(a,b){this._pathTemplate="M 0,{center} L 100,{center}",d.apply(this,arguments)};f.prototype=new d,f.prototype.constructor=f,f.prototype._initializeSvg=function(a,b){a.setAttribute("viewBox","0 0 100 "+b.strokeWidth),a.setAttribute("preserveAspectRatio","none")},f.prototype._pathString=function(a){return e.render(this._pathTemplate,{center:a.strokeWidth/2})},f.prototype._trailString=function(a){return this._pathString(a)},b.exports=f},{"./shape":7,"./utils":9}],4:[function(a,b,c){b.exports={Line:a("./line"),Circle:a("./circle"),SemiCircle:a("./semicircle"),Square:a("./square"),Path:a("./path"),Shape:a("./shape"),utils:a("./utils")}},{"./circle":2,"./line":3,"./path":5,"./semicircle":6,"./shape":7,"./square":8,"./utils":9}],5:[function(a,b,c){var d=a("shifty"),e=a("./utils"),f={easeIn:"easeInCubic",easeOut:"easeOutCubic",easeInOut:"easeInOutCubic"},g=function a(b,c){if(!(this instanceof a))throw new Error("Constructor was called without new keyword");c=e.extend({duration:800,easing:"linear",from:{},to:{},step:function(){}},c);var d;d=e.isString(b)?document.querySelector(b):b,this.path=d,this._opts=c,this._tweenable=null;var f=this.path.getTotalLength();this.path.style.strokeDasharray=f+" "+f,this.set(0)};g.prototype.value=function(){var a=this._getComputedDashOffset(),b=this.path.getTotalLength(),c=1-a/b;return parseFloat(c.toFixed(6),10)},g.prototype.set=function(a){this.stop(),this.path.style.strokeDashoffset=this._progressToOffset(a);var b=this._opts.step;if(e.isFunction(b)){var c=this._easing(this._opts.easing),d=this._calculateTo(a,c),f=this._opts.shape||this;b(d,f,this._opts.attachment)}},g.prototype.stop=function(){this._stopTween(),this.path.style.strokeDashoffset=this._getComputedDashOffset()},g.prototype.animate=function(a,b,c){b=b||{},e.isFunction(b)&&(c=b,b={});var f=e.extend({},b),g=e.extend({},this._opts);b=e.extend(g,b);var h=this._easing(b.easing),i=this._resolveFromAndTo(a,h,f);this.stop(),this.path.getBoundingClientRect();var j=this._getComputedDashOffset(),k=this._progressToOffset(a),l=this;this._tweenable=new d,this._tweenable.tween({from:e.extend({offset:j},i.from),to:e.extend({offset:k},i.to),duration:b.duration,easing:h,step:function(a){l.path.style.strokeDashoffset=a.offset;var c=b.shape||l;b.step(a,c,b.attachment)},finish:function(a){e.isFunction(c)&&c()}})},g.prototype._getComputedDashOffset=function(){var a=window.getComputedStyle(this.path,null);return parseFloat(a.getPropertyValue("stroke-dashoffset"),10)},g.prototype._progressToOffset=function(a){var b=this.path.getTotalLength();return b-a*b},g.prototype._resolveFromAndTo=function(a,b,c){return c.from&&c.to?{from:c.from,to:c.to}:{from:this._calculateFrom(b),to:this._calculateTo(a,b)}},g.prototype._calculateFrom=function(a){return d.interpolate(this._opts.from,this._opts.to,this.value(),a)},g.prototype._calculateTo=function(a,b){return d.interpolate(this._opts.from,this._opts.to,a,b)},g.prototype._stopTween=function(){null!==this._tweenable&&(this._tweenable.stop(),this._tweenable=null)},g.prototype._easing=function(a){return f.hasOwnProperty(a)?f[a]:a},b.exports=g},{"./utils":9,shifty:1}],6:[function(a,b,c){var d=a("./shape"),e=a("./circle"),f=a("./utils"),g=function(a,b){this._pathTemplate="M 50,50 m -{radius},0 a {radius},{radius} 0 1 1 {2radius},0",this.containerAspectRatio=2,d.apply(this,arguments)};g.prototype=new d,g.prototype.constructor=g,g.prototype._initializeSvg=function(a,b){a.setAttribute("viewBox","0 0 100 50")},g.prototype._initializeTextContainer=function(a,b,c){a.text.style&&(c.style.top="auto",c.style.bottom="0",a.text.alignToBottom?f.setStyle(c,"transform","translate(-50%, 0)"):f.setStyle(c,"transform","translate(-50%, 50%)"))},g.prototype._pathString=e.prototype._pathString,g.prototype._trailString=e.prototype._trailString,b.exports=g},{"./circle":2,"./shape":7,"./utils":9}],7:[function(a,b,c){var d=a("./path"),e=a("./utils"),f="Object is destroyed",g=function a(b,c){if(!(this instanceof a))throw new Error("Constructor was called without new keyword");if(0!==arguments.length){this._opts=e.extend({color:"#555",strokeWidth:1,trailColor:null,trailWidth:null,fill:null,text:{style:{color:null,position:"absolute",left:"50%",top:"50%",padding:0,margin:0,transform:{prefix:!0,value:"translate(-50%, -50%)"}},autoStyleContainer:!0,alignToBottom:!0,value:null,className:"progressbar-text"},svgStyle:{display:"block",width:"100%"},warnings:!1},c,!0),e.isObject(c)&&void 0!==c.svgStyle&&(this._opts.svgStyle=c.svgStyle),e.isObject(c)&&e.isObject(c.text)&&void 0!==c.text.style&&(this._opts.text.style=c.text.style);var f,g=this._createSvgView(this._opts);if(f=e.isString(b)?document.querySelector(b):b,!f)throw new Error("Container does not exist: "+b);this._container=f,this._container.appendChild(g.svg),this._opts.warnings&&this._warnContainerAspectRatio(this._container),this._opts.svgStyle&&e.setStyles(g.svg,this._opts.svgStyle),this.svg=g.svg,this.path=g.path,this.trail=g.trail,this.text=null;var h=e.extend({attachment:void 0,shape:this},this._opts);this._progressPath=new d(g.path,h),e.isObject(this._opts.text)&&null!==this._opts.text.value&&this.setText(this._opts.text.value)}};g.prototype.animate=function(a,b,c){if(null===this._progressPath)throw new Error(f);this._progressPath.animate(a,b,c)},g.prototype.stop=function(){if(null===this._progressPath)throw new Error(f);void 0!==this._progressPath&&this._progressPath.stop()},g.prototype.destroy=function(){if(null===this._progressPath)throw new Error(f);this.stop(),this.svg.parentNode.removeChild(this.svg),this.svg=null,this.path=null,this.trail=null,this._progressPath=null,null!==this.text&&(this.text.parentNode.removeChild(this.text),this.text=null)},g.prototype.set=function(a){if(null===this._progressPath)throw new Error(f);this._progressPath.set(a)},g.prototype.value=function(){if(null===this._progressPath)throw new Error(f);return void 0===this._progressPath?0:this._progressPath.value()},g.prototype.setText=function(a){if(null===this._progressPath)throw new Error(f);null===this.text&&(this.text=this._createTextContainer(this._opts,this._container),this._container.appendChild(this.text)),e.isObject(a)?(e.removeChildren(this.text),this.text.appendChild(a)):this.text.innerHTML=a},g.prototype._createSvgView=function(a){var b=document.createElementNS("http://www.w3.org/2000/svg","svg");this._initializeSvg(b,a);var c=null;(a.trailColor||a.trailWidth)&&(c=this._createTrail(a),b.appendChild(c));var d=this._createPath(a);return b.appendChild(d),{svg:b,path:d,trail:c}},g.prototype._initializeSvg=function(a,b){a.setAttribute("viewBox","0 0 100 100")},g.prototype._createPath=function(a){var b=this._pathString(a);return this._createPathElement(b,a)},g.prototype._createTrail=function(a){var b=this._trailString(a),c=e.extend({},a);return c.trailColor||(c.trailColor="#eee"),c.trailWidth||(c.trailWidth=c.strokeWidth),c.color=c.trailColor,c.strokeWidth=c.trailWidth,c.fill=null,this._createPathElement(b,c)},g.prototype._createPathElement=function(a,b){var c=document.createElementNS("http://www.w3.org/2000/svg","path");return c.setAttribute("d",a),c.setAttribute("stroke",b.color),c.setAttribute("stroke-width",b.strokeWidth),b.fill?c.setAttribute("fill",b.fill):c.setAttribute("fill-opacity","0"),c},g.prototype._createTextContainer=function(a,b){var c=document.createElement("div");c.className=a.text.className;var d=a.text.style;return d&&(a.text.autoStyleContainer&&(b.style.position="relative"),e.setStyles(c,d),d.color||(c.style.color=a.color)),this._initializeTextContainer(a,b,c),c},g.prototype._initializeTextContainer=function(a,b,c){},g.prototype._pathString=function(a){throw new Error("Override this function for each progress bar")},g.prototype._trailString=function(a){throw new Error("Override this function for each progress bar")},g.prototype._warnContainerAspectRatio=function(a){if(this.containerAspectRatio){var b=window.getComputedStyle(a,null),c=parseFloat(b.getPropertyValue("width"),10),d=parseFloat(b.getPropertyValue("height"),10);e.floatEquals(this.containerAspectRatio,c/d)||(console.warn("Incorrect aspect ratio of container","#"+a.id,"detected:",b.getPropertyValue("width")+"(width)","/",b.getPropertyValue("height")+"(height)","=",c/d),console.warn("Aspect ratio of should be",this.containerAspectRatio))}},b.exports=g},{"./path":5,"./utils":9}],8:[function(a,b,c){var d=a("./shape"),e=a("./utils"),f=function(a,b){this._pathTemplate="M 0,{halfOfStrokeWidth} L {width},{halfOfStrokeWidth} L {width},{width} L {halfOfStrokeWidth},{width} L {halfOfStrokeWidth},{strokeWidth}",this._trailTemplate="M {startMargin},{halfOfStrokeWidth} L {width},{halfOfStrokeWidth} L {width},{width} L {halfOfStrokeWidth},{width} L {halfOfStrokeWidth},{halfOfStrokeWidth}",d.apply(this,arguments)};f.prototype=new d,f.prototype.constructor=f,f.prototype._pathString=function(a){var b=100-a.strokeWidth/2;return e.render(this._pathTemplate,{width:b,strokeWidth:a.strokeWidth,halfOfStrokeWidth:a.strokeWidth/2})},f.prototype._trailString=function(a){var b=100-a.strokeWidth/2;return e.render(this._trailTemplate,{width:b,strokeWidth:a.strokeWidth,halfOfStrokeWidth:a.strokeWidth/2,startMargin:a.strokeWidth/2-a.trailWidth/2})},b.exports=f},{"./shape":7,"./utils":9}],9:[function(a,b,c){function d(a,b,c){a=a||{},b=b||{},c=c||!1;for(var e in b)if(b.hasOwnProperty(e)){var f=a[e],g=b[e];c&&l(f)&&l(g)?a[e]=d(f,g,c):a[e]=g}return a}function e(a,b){var c=a;for(var d in b)if(b.hasOwnProperty(d)){var e=b[d],f="\\{"+d+"\\}",g=new RegExp(f,"g");c=c.replace(g,e)}return c}function f(a,b,c){for(var d=a.style,e=0;e<p.length;++e){var f=p[e];d[f+h(b)]=c}d[b]=c}function g(a,b){m(b,function(b,c){null!==b&&void 0!==b&&(l(b)&&b.prefix===!0?f(a,c,b.value):a.style[c]=b)})}function h(a){return a.charAt(0).toUpperCase()+a.slice(1)}function i(a){return"string"==typeof a||a instanceof String}function j(a){return"function"==typeof a}function k(a){return"[object Array]"===Object.prototype.toString.call(a)}function l(a){if(k(a))return!1;var b=typeof a;return"object"===b&&!!a}function m(a,b){for(var c in a)if(a.hasOwnProperty(c)){var d=a[c];b(d,c)}}function n(a,b){return Math.abs(a-b)<q}function o(a){for(;a.firstChild;)a.removeChild(a.firstChild)}var p="Webkit Moz O ms".split(" "),q=.001;b.exports={extend:d,render:e,setStyle:f,setStyles:g,capitalize:h,isString:i,isFunction:j,isObject:l,forEachObject:m,floatEquals:n,removeChildren:o}},{}]},{},[4])(4)});

