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

(function () {

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
     * @typedef {Promise} RequestPromise
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


    if (typeof unsafeWindow === 'undefined') unsafeWindow = window;


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

    /**
     *
     * @param responseHeaders
     * @returns {{fileExtension: string | *, contentType: string}}
     */
    function getContentType(responseHeaders) {
        const [fullMatch, mimeType1, mimeType2] = responseHeaders.match(/content-type: ([\w]+)\/([\w\-]+)/);
        const contentType = [mimeType1, mimeType2].join('/');

        const fileExtension = unsafeWindow.mimeTypes.hasOwnProperty(contentType) && unsafeWindow.mimeTypes[contentType] ?
            unsafeWindow.mimeTypes[contentType].extensions[0] :
            mimeType2;
        return {contentType, fileExtension};
    }

    /**
     * @param {Tampermonkey.Response} res - parses the responseHeaders from the response and adds them as fields to `res`
     */
    function extendResponse(res) {
        // you'll get a match like this:    ["content-type: image/png", "image", "png"]
        const responseHeaders = res.responseHeaders;
        const {contentType, fileExtension} = getContentType(responseHeaders);

        // adding properties
        res.contentType = contentType;
        res.fileExtension = fileExtension;
    }

    (function extendJSZip() {
        if (typeof JSZip !== 'undefined') {
            /** The current file index being downloaded/added to the zip */
            JSZip.prototype.current = 0;
            /**
             The total count of files to be zipped+already zipped.
             This is useful for automatically generating the zip when zip.current >= zip.zipTotal
             */
            JSZip.prototype.zipTotal = 0;
            JSZip.prototype.totalSize = 0;
            JSZip.prototype.totalLoaded = 0;

            JSZip.prototype.generateIndexHtml = function generateIndexHtml() {
                let html = '';
                for (const key of Object.keys(this.files)) {
                    try {
                        const file = this.files[key];
                        /**{url, name, page}*/
                        const data = JSON.parse(file.comment ? file.comment : '{}');

                        //TODO: replace this with using the element API, using raw strings causes issues
                        html += '<div> <a href="' + (data.url || file.name) + '">' +
                            '<img src="' + file.name + '" alt="' + key + '"> </a>' +
                            '<div>' +
                            '<a href="' + data.page + '" target="_blank">' + file.name + ' </a> <h4>' + file.name + ' </h4> ' +
                            '<h3>' + (data.name || file.name) + '</h3> ' +
                            '</div>' +
                            '</div>';
                    } catch (e) {
                        console.error(e)
                    }
                }
                return this.file('index.html', new Blob([html], {type: 'text/plain'}));
            };
            JSZip.prototype.isZipGenerated = false; // has the zip been generated/downloaded?
            JSZip.prototype.name = '';
            JSZip.prototype.__defineGetter__('pathname', function () {
                return `${Config.MAIN_DIRECTORY}${this.name} [${Object.keys(this.files).length}].zip`;
            });

            /**called when the zip is generated*/
            // TODO: maybe use an EventEmitter instead of setting a single function
            JSZip.prototype.onGenZip = function () {
                console.log('onGenZip()', this);
            };

            JSZip.prototype.genZip = function genZip(updateCallback = null) {
                const zip = this;

                zip.__ongenzipProgressCounter = 0; //TODO: refactor: delete zip

                var genzipProgressBar = new ProgressBar.Circle(zip.progressBar._container, {
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
                    genzipProgressBar.animate(metadata.percent);

                    if (++zip.__ongenzipProgressCounter % 50 === 0) {
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

                        zip.onGenZip && zip.onGenZip();

                        // remove from pendingZips set
                        const result = pendingZips.delete(zip);
                        if (result === false) {
                            console.warn('warning: zip was generated and was never even initiated. Check pendingZips')
                        }

                        return GM_download({
                            url: objectUrl,
                            name: zip.pathname,
                            onload: function (e) {
                                zip.onDownload && zip.onDownload();
                                genzipProgressBar && genzipProgressBar.destroy();
                            },
                            onerror: function (e) {
                                console.warn('couldn\'t download zip', zip, e);
                                saveByAnchor(objectUrl, zip.pathname);
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
            JSZip.prototype.responseBlobs = new Set();
            /** @type {ProgressBar} */
            JSZip.prototype.__defineGetter__('progressBar', function () {
                if (!this._progressBar)
                    this._progressBar = setupProgressBar();
                return this._progressBar;
            });

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
             * @param {function=} checkResponse function(this: zip, response): function which is passed the response in both onload and onerror
             */
            JSZip.prototype.requestAndZip = function (fileUrl, fileName, checkResponse = (res, furl, fname) => null) {
                var zip = this;
                var fileSize = 0;
                zip.loadedLast = 0;
                zip.activeZipThreads++;
                checkResponse = checkResponse.bind(zip); // the `this` argument will always be the zip

                //TODO: move removeDoubleSpaces and name fixing to getValidIteratedName
                fileName = zip.getValidIteratedName(removeDoubleSpaces(fileName.replace(/\//g, ' ')));

                if (zip.file(fileName)) {
                    console.warn('ZIP already contains the file: ', fileName);
                    return;
                }

                const xhr = GM_xmlhttpRequestPromise({
                    method: 'GET',
                    url: fileUrl,
                    responseType: 'arraybuffer',
                    binary: true,
                    onload: res => {
                        if (zip.file(fileName)) {
                            console.warn('ZIP already contains the file: ', fileName);
                            return;
                        }

                        res && console.debug(
                            'onload:' +
                            '\nreadyState:', res.readyState,
                            '\nresponseHeaders:', res.responseHeaders,
                            '\nstatus:', res.status,
                            '\nstatusText:', res.statusText,
                            '\nfinalUrl:', res.finalUrl,
                            '\nresponseText:', res.responseText ? res.responseText.slice(0, 100) + '...' : ''
                        );

                        if (checkResponse(res, fileUrl, fileName)) {
                            zip.current++;
                            return;
                        }

                        const {contentType, fileExtension} = getContentType(res.responseHeaders);
                        const blob = new Blob([res.response], {type: contentType});

                        console.log(`Adding file to zip:\n"${fileName}"\n"${fileUrl}"`, '\ncontentType:', contentType);

                        zip.file(`${fileName.trim()}_${zip.current + 1}.${fileExtension}`, blob);
                        zip.responseBlobs.add(blob);
                        zip.current++;

                        // if finished, stop
                        if (zip.current < zip.zipTotal || zip.zipTotal <= 0) {
                            return;
                        }

                        // Completed! TODO: move this outside, make it that when all requestAndZip()s finish
                        if (zip.current >= zip.zipTotal - 1) {
                            debug && console.log('Generating ZIP...\nFile count:', Object.keys(zip.files).length);
                            zip.zipTotal = -1;
                            if (zip.progressBar) zip.progressBar.destroy();
                            zip.genZip();
                        }
                        zip.activeZipThreads--;
                    },
                    onreadystatechange: res => {
                        console.debug('Request state changed to: ' + res.readyState);
                        if (res.readyState === 4) {
                            console.debug('ret.readyState === 4');
                        }
                    },
                    onerror: res => {
                        if (checkResponse(res, fileUrl, fileName)) {
                            return;
                        }

                        console.error('An error occurred.',
                            '\nreadyState: ', res.readyState,
                            '\nresponseHeaders: ', res.responseHeaders,
                            '\nstatus: ', res.status,
                            '\nstatusText: ', res.statusText,
                            '\nfinalUrl: ', res.finalUrl,
                            '\nresponseText: ', res.responseText,
                        );
                        zip.activeZipThreads--;
                    },
                    onprogress: res => {

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
                            const justLoaded = loadedSoFar - zip.loadedLast;    // What has been added since the last progress call
                            const fileprogress = loadedSoFar / res.total;   //

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

        } else {
            console.warn('downloader_script: JSZip is undefined in downloader script, if you\'re using this script via @require, be sure to also include its dependencies (check script @require).' +
                '\nMost likely missing:', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.4/jszip.min.js');
        }
    })();


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
    function extractFullUrlForSpecialHostnames(fileUrl) {
        if (new URL(fileUrl).hostname.indexOf('gfycat.com') === 0) {
            fileUrl = fileUrl.replace(/gfycat\.com/i, 'giant.gfycat.com') + '.webm';
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
                    name: name + '.' + getFileExtension(o.url),
                    url: o.url,
                    onload: details.onload(rr),
                    onerror: function (rrr) {
                        console.warn('Download failed:', o.url, rrr);
                    }
                });
                downloadedSet.delete(o.url); // upon failure, remove the url from the list to give it another chance.
                console.error('Download failed, onerrorFinal():', name, o.url, rr);
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
            if (opts.attempts > 0 || opts.fallbackUrls && opts.fallbackUrls.length) {
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
        opts.url = extractFullUrlForSpecialHostnames(String(opts.url).replace(/["]/gi, ''));

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
        // TODO: kill global variables (kill fileNumber)

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
        let fileExtension = opts.fileExtension || getFileExtension(opts.url);
        // remove all extra extensions (don't remove it if there isn't a fileExtension)
        if (fileExtension) opts.name = opts.name.replace(RegExp('\.' + fileExtension, 'gi'), '');

        console.debug(
            'fileUrl:', opts.url,
            '\ndownloadDirectory:', opts.directory,
            '\nextension:', fileExtension,
            '\nFINAL_NAME:', removeDoubleSpaces(Config.MAIN_DIRECTORY + opts.directory + opts.name + '.' + fileExtension),
            '\nopts:', opts,
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
            name: removeDoubleSpaces(Config.MAIN_DIRECTORY + opts.directory + opts.name + '.' + fileExtension),
            onload: function onload(e) {
                console.log('Download finished', opts.name, '\n' + opts.url, e);
                downloadedSet.add(opts.url);
                if (typeof (opts.onload) === 'function')
                    opts.onload(e);
            },
            onerror: function (r) {
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
                switch (r.error.toLowerCase()) {
                    case 'not_succeeded':
                        switch (r.details.current.toLowerCase()) {
                            case 'not_whitelisted':
                                opts.url = opts.url.replace(/\?.*/, '');
                                opts.name = opts.name.substring(0,
                                    (opts.name.lastIndexOf('?') > -1) ?
                                        opts.name.lastIndexOf('?') :
                                        (opts.name.length + '.oops.jpg')
                                );
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

        // prepend all functions with _
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
            _onload: () => undefined,
            _onerror: () => undefined,
            _onprogress: () => undefined,
            _ontimeout: () => undefined,
            _onabort: () => undefined,
            _onloadstart: () => undefined,
            _onreadystatechange: () => undefined,
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
                console.log('GM_xmlhttpRequest(', details, ')\n ->', promise);

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

    /**
     * @deprecated
     * @param inputUrls
     * @param directory
     * @param maxDlLimit
     */
    function downloadBatch(inputUrls, directory, maxDlLimit) { // download batch but with a max count limit
        let message = 'downloadBatch() is deprecated, plz use download() or zipFiles() instead';
        console.error(message);
        alert(message);

        console.log('maxDownloadCount was passed (but all inputUrls will be downloaded anyways):', maxDlLimit);
        directory = directory || document.title;

        zipImages(inputUrls, `${directory} ${directory}`);
        if (!inputUrls) throw 'input URLs null!';

        console.log('MAIN_DIRECTORY:', Config.MAIN_DIRECTORY);


        let i = 0;
        var interval = setInterval(() => {
            if (i < inputUrls.length) {
                const url = inputUrls[i];
                download(url, null, `${location.hostname} - ${document.title}`);
            } else clearInterval(interval);
        }, 200);
    }

    /**@deprecated*/
    function downloadImageBatch(inputUrls, directory) {
        let message = 'downloadImageBatch() is deprecated, plz use download() or zipFiles() instead';
        console.error(message);
        alert(message);

        if (!inputUrls) throw 'mainImage input URLs null!';

        console.log('Image batch received:', inputUrls);
        const batchName = `${cleanFileName(cleanGibberish(document.title), true)}/`;
        zipImages(inputUrls, `${directory} ${batchName}`);
    }


    function tryDecodeURIComponent(str) {
        try {
            return decodeURIComponent(str);
        } catch (e) {
            debug && console.warn('tryDecodeURIComponent(' + str + '), failed');
            return str;
        }
    }
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
            .replace(/[^\w]/gi, '');

        if (!isValidExtension(ext)) {
            ext = 'oops.gif';
        }

        return ext;
    }

    function cleanFileName(fileName, isDirectory = false) {
        // file names can't include '/' or '\'
        const fileCleanerRegex = new RegExp(`[${invalidNameCharacters}${isDirectory ? '' : '\\\\/'}]|(^[\\W.]+)|(\\s\\s+)`, 'gi');
        return clearUrlGibberish(tryDecodeURIComponent(fileName)).replace(fileCleanerRegex, ' ').trim();
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
     * @param {string=} name
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
     * @param {(Object[]|Downloadable[])=} fileUrls  this should be an iterable containing objects, each containing the fileUrl and the desired fileName.
     *  if empty, will use images matching this selector by default: "img.img-big"
     *
     * @param {string=} zipName
     * @return {JSZip}
     */
    function zipFiles(fileUrls, zipName = '') {
        const zip = new JSZip();

        pendingZips.add(zip);
        zip.name = (zipName ? zipName : document.title).replace(/\//g, ' ');
        var pb = zip.progressBar; // init progressBar
        zip.fetchList = [];

        const files = Array.from(fileUrls || document.querySelectorAll('img.img-big'))
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


        for (const file of files)
            try {
                zip.requestAndZip(file.url, file.name);
            } catch (r) {
                console.error(r);
            }

        //TODO: this should return a promise of when all the files have been zipped,
        //          this can be done using Promise.all(zip.fetchList)
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
            if (!isDdgUrl(res.finalUrl || res.url)) {
                console.debug(
                    'retrying with ddgproxy',
                    '\nddgpURL:', ddgProxy(fileUrl),
                    '\nfileURL:', fileUrl,
                    '\nresponse.finalURL:', res.finalUrl
                );

                // you'll get a match like this:    ["content-type: image/png", "image", "png"]
                const {contentType, fileExtension} = getContentType(res.responseHeaders);
                const blob = new Blob([res.response], {type: contentType});

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
     * extract name and url from
     *
     *   file.url = file.fileURL || file.fileUrl || file.url || file.src || file.href;
     *   file.name = file.fileName || file.alt || file.title || nameFile(file.fileURL) || "Untitled image";
     * @param {Object|string} file
     * @returns {Downloadable}
     */
    function normalizeFile(file) {
        if (!file) return {};
        if (typeof file === 'string') { // if string
            //TODO: name is never specified here
            const url = file;
            return ({
                url: url,
                name: nameFile(url) || 'untitled.unkownformat.gif'
            });
        }

        function getFirstProperty(o, properties) {
                if (!o) return null;
                for (const p of properties) {
                    if (o[p])
                        return o[p];
            }
        }

        const dFile = {};
        dFile.url = getFirstProperty(file, ['fileURL', 'fileUrl', 'url', 'src', 'href']);
        dFile.name = getFirstProperty(file, ['fileName', 'name', 'download-name', 'alt', 'title']) || nameFile(file.url) || 'Untitled';

        return dFile;
    }


    function setupProgressBar() {
        const pbHeader = createElement(`<header id="progressbar-container"/>`);
        if (!document.querySelector('#progressbar-container')) {
            document.body.firstElementChild.before(pbHeader);
        }

        // noinspection JSUnresolvedVariable
        if (typeof (ProgressBar) == 'undefined') {
            console.error('ProgressBar.js is not defined.');
            return;
        }

        // noinspection JSUnresolvedVariable
        var progressBar = new ProgressBar.Line('#progressbar-container', {
            easing: 'easeInOut',
            color: '#FCB03C',
            strokeWidth: 1,
            trailWidth: 1,
            text: {
                value: '0'
            }
        });

        pbHeader.style.position = 'fixed';
        pbHeader.style.top = '0';
        pbHeader.style.left = '0';
        pbHeader.style.width = '100%';
        pbHeader.style['min-height'] = '30px';
        pbHeader.style.padding = '10px 0';
        pbHeader.style['background-color'] = '#36465d';
        pbHeader.style['box-shadow'] = '0 0 0 1px hsla(0,0%,100%,.13)';
        pbHeader.style['z-index'] = '100';

        progressBar.set(0);
        const progressbarText = document.querySelector('.progressbar-text');
        progressbarText.style.display = 'inline';
        progressbarText.style.position = 'relative';
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
        if (url) {
            var m = url.toString().match(/.*\/(.+?)\./);
            if (m && m.length > 1) {
                return m[1];
            }
        } else
            return '';
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
    unsafeWindow.downloadBatch = downloadBatch;
    unsafeWindow.downloadImageBatch = downloadImageBatch;
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

    // exposeSymbols([
    //     'JSZip',
    //     'setNameFilesByNumber',
    //     'download',
    //     'GM_download',
    //     'downloadBatch',
    //     'downloadImageBatch',
    //     'getFileExtension',
    //     'nameFile',
    //     'makeTextFile',
    //     'anchorClick',
    //     'saveByAnchor',
    //     'zipFiles',
    //     'zipImages',
    //     'storeDownloadHistory',
    //     'GM_fetch',
    //     'GM_xmlhttpRequest',
    //     'GM_downloadPromise',
    //     'GM_xmlhttpRequestPromise',
    // ], this);
    unsafeWindow.MAIN_DIRECTORY = Config.MAIN_DIRECTORY;

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