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
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.3/FileSaver.min.js
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
var GM_download;

/**
 * Response callback
 * @callback scriptish_response_callback
 * @param {number} responseCode
 * @param {string} responseMessage
 */


/**
 * https://tampermonkey.net/documentation.php#GM_xmlhttpRequest
 *
 * Arguments
 * Object details
 * A single object with properties defining the request behavior.
 *
 * @param {Object} details - the main details object
 *
 * @param {String=} details.method - Optional. The HTTP method to utilize. Currently only "GET" and "POST" are supported. Defaults to "GET".
 * @param {String} details.url - The URL to which the request will be sent. This value may be relative to the page the user script is running on.
 * @param {scriptish_response_callback=} [details.onload] - A function called if the request finishes successfully. Passed a Scriptish response object (see below).
 * @param {scriptish_response_callback=} [details.onerror] - A function called if the request fails. Passed a Scriptish response object (see below).
 * @param {scriptish_response_callback=} [details.onreadystatechange] - A function called whenever the request's readyState changes. Passed a Scriptish response object (see below).
 * @param {String=} [details.data] - Content to send as the body of the request.
 * @param {Object=} [details.headers] - An object containing headers to be sent as part of the request.
 * @param {Boolean=} [details.binary] - Forces the request to send data as binary. Defaults to false.
 * @param {Boolean=} [details.makePrivate] - Forces the request to be a private request (same as initiated from a private window). (0.1.9+)
 * @param {Boolean=} [details.mozBackgroundRequest] - If true security dialogs will not be shown, and the request will fail. Defaults to true.
 * @param {String=} [details.user] - The user name to use for authentication purposes. Defaults to the empty string "".
 * @param {String=} [details.password] - The password to use for authentication purposes. Defaults to the empty string "".
 * @param {String=} [details.overrideMimeType] - Overrides the MIME type returned by the server.
 * @param {Boolean=} [details.ignoreCache] - Forces a request to the server, bypassing the cache. Defaults to false.
 * @param {Boolean=} [details.ignoreRedirect] - Forces the request to ignore both temporary and permanent redirects.
 * @param {Boolean=} [details.ignoreTempRedirect] - Forces the request to ignore only temporary redirects.
 * @param {Boolean=} [details.ignorePermanentRedirect] - Forces the request to ignore only permanent redirects.
 * @param {Boolean=} [details.failOnRedirect] - Forces the request to fail if a redirect occurs.
 * @param {int=} redirectionLimit: Optional - Range allowed: 0-10. Forces the request to fail if a certain number of redirects occur.
 * Note: A redirectionLimit of 0 is equivalent to setting failOnRedirect to true.
 * Note: If both are set, redirectionLimit will take priority over failOnRedirect.
 *
 * Note: When ignore*Redirect is set and a redirect is encountered the request will still succeed, and subsequently call onload. failOnRedirect or redirectionLimit exhaustion, however, will produce an error when encountering a redirect, and subsequently call onerror.
 *
 * For "onprogress" only:
 *
 * @param {Boolean} lengthComputable: Whether it is currently possible to know the total size of the response.
 * @param {int} loaded: The number of bytes loaded thus far.
 * @param {int} total: The total size of the response.
 *
 * @return {{abort: Function}}
 */
var GM_xmlhttpRequest;


var unsafeWindow;
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
      method: String,
      url: String,
      params: String | Object,
      headers: Object
    }
 * @returns {Promise<any>}
 * @constructor
 */
function GM_fetch(url, opts = {}) {
    var xhr;

    // // this alows for calling it like this: fetch({ url:..., onload=...})
    // if (typeof url === 'object' && !opts) {
    //     url.url = url;
    //     opts = url;
    //     url = opts.url;
    //     console.log('swapping url and opts: url, opts =', url, opts);
    // }

    const promise = new Promise(function (resolve, reject) {
        const details = $.extend(opts, {
            url: opts.url || url,
        });

        /** @param {GMResponse} res */
        details.onload = function (res) {
            if (res.status >= 200 && res.status < 300) {
                resolve(this.response);
            } else {
                reject(res);
            }
        };
        /** @param {GMResponse} res */
        details.onerror = function (res) {
            reject(res);
        };

        xhr = GM_xmlhttpRequest(details);
    });

    promise.abort = () => xhr.abort();
    return promise;
}

GM_xmlhttpRequest.prototype.fetch = GM_fetch;
GM_xmlhttpRequest.fetch = GM_fetch;
unsafeWindow.GM_xmlhttpRequest = GM_xmlhttpRequest;
unsafeWindow.GM_fetch = GM_fetch;

/**abbreviation for querySelectorAll()*/
function qa(selector) {
    return document.querySelectorAll(selector);
}
/**abbreviation for querySelector()*/
function q(selector) {
    return document.querySelector(selector);
}

/** returns full path, not just partial path */
var normalizeUrl = (function () {
    var fakeLink = document.createElement('a');

    return function (url) {
        fakeLink.href = url;
        return fakeLink.href;
    }
})();

// just globally keeping track of all the zips
if (!unsafeWindow.zips) {
    unsafeWindow.zips = [];
}

/** mimeTypeJSON contains the mimeType to file extension database, useful for getting the extension from the mimetype */

var mimeTypes;
if (typeof unsafeWindow.mimeTypes !== 'object') {
    fetch('https://cdn.rawgit.com/jshttp/mime-db/master/db.json', {
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
    }).then(res => res.json()).then(json => {
        if (typeof unsafeWindow.mimeTypes === 'object') {
            debug && console.debug('unsafeWindow already contains mimeTypes, no need to load another one');
            return;
        }
        mimeTypes = json;
        unsafeWindow.mimeTypes = mimeTypes;
        console.log('mimeTypes:', json);
    }).catch(res => {
        console.error('loading json failed', res);
        mimeTypes = {};
    });
}

if (Config.saveDownloadHistory) {
    window.addEventListener('beforeunload', function (event) {
        // merge and store the download history
        storeDownloadHistory();
        return true;
    });
}
unsafeWindow.storeDownloadHistory = storeDownloadHistory;

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

/**
 url - the URL from where the data should be downloaded
 name - the filename - for security reasons the file extension needs to be whitelisted at the Tampermonkey options page
 headers - see GM_xmlhttpRequest for more details
 saveAs - boolean value, show a saveAs dialog
 onerror callback to be executed if the download ended up with an error
 onload callback to be executed if the download finished
 onprogress callback to be executed if the download made some progress
 ontimeout callback to be executed if the download failed due to a timeout
 */
function setNameFilesByNumber(newValue) {
    Config.NAME_FILES_BY_NUMBER = newValue;
    GM_getValue('NAME_FILES_BY_NUMBER', Config.NAME_FILES_BY_NUMBER);
}

(function exposingMembers() {
    unsafeWindow.MAIN_DIRECTORY = Config.MAIN_DIRECTORY;
    unsafeWindow.setNameFilesByNumber = setNameFilesByNumber;
    unsafeWindow.JSZip = JSZip;
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
})();

// todo: make the genZip() have a timeout, that if there aren't anymore files downloading for a while, it'll automatically download
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

                    html += '<div> <a href="' + data.url || file.name + '">' +
                        '<img src="' + file.name + '" alt="' + key + '"> </a>' +
                        '<div>' +
                        '<a href="' + data.page + '" target="_blank">' + file.name + ' </a> <h4>' + file.name + ' </h4> ' +
                        '<h3>' + data.name || file.name + '</h3> ' +
                        '</div>' +
                        '</div>';
                } catch (e) {
                    console.error(e)
                }
            }
            return this.file('index.html', new Blob([html], {type: 'text/plain'}));
        };
        JSZip.prototype.zipGenerated = false; // has the zip been generated/downloaded?
        /**called when the zip is generated*/
        JSZip.prototype.onGenZip = function () {
            console.log('onGenZip()', this);
        };
        JSZip.prototype.genZip = function genZip(name = '$name$') {
            return this.generateAsync({type: 'blob'}).then(blob => {
                const objectUrl = URL.createObjectURL(blob);
                this.zipName = name.replace('$name$', this.zipName || document.title);

                GM_download({
                    url: objectUrl,
                    name: `${Config.MAIN_DIRECTORY}/${this.zipName} [${Object.keys(this.files).length}].zip`,
                    onload: function() {
                        this.onDownload && this.onDownload();
                    }
                });
                this.zipGenerated = true;

                // this.dispatchEvent(new Event('genzip'));
                this.onGenZip && this.onGenZip();
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
        JSZip.prototype.zipName = document.title;
        JSZip.prototype.__defineGetter__('progressBar', function () {
            if (!this._progressBar)
                this._progressBar = setupProgressBar();
            return this._progressBar;
        });
    } else {
        console.warn('downloader_script: JSZip is undefined in downloader script, if you\'re using this script via @require, be sure to also include its dependencies (check script @require).' +
            '\nMost likely missing:', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.4/jszip.min.js');
    }
})();


/** if there's a **special** as gify.com, the big url can be extracted */
function extractFullUrlForSpecialHostnames(fileUrl) {
    if (getHostname(fileUrl).indexOf('gfycat.com') === 0) {
        fileUrl = fileUrl.replace(/gfycat\.com/i, 'giant.gfycat.com') + '.webm';
    }
    return fileUrl;
}


/**
 * @param {string|Element} fileUrl the url to the file to download
 * @param {string} fileName - gets extracted by default
 * @param {string=} directory
 *
 * @param {Object=} options
 * @param {string=} options.directory
 * @param {Function=} options.onload
 * @param {Function=} options.onerror
 * @param {string[]=[]} options.fallbackUrls - list of urls
 * @param {Element=} options.element - an HTML element
 * @param {string=} options.mainDirectory
 * @param {string=} options.fileExtension
 * @param {number=-1} options.blobTimeout - set this value to save memory, delete a download blob object after it times out
 * @param {number=} options.attempts - Each download has a few attempts before it gives up.
 * @param {Function=} options.ondownload - when the file is finally downloaded to the file system, not just to the browser
 *  defaults to -1, no deleting
 *  Having the element could be helpful getting it's ATTRIBUTES (such as: "download-name")
 */
function download(fileUrl, fileName = '', directory = '', options = {}) {
    const o = $.extend(options, {
        onload: function () {
        },
        onerror: function (r) {
        },
        fallbackUrls: [], // TODO: later implement this
        element: {},
        mainDirectory: Config.MAIN_DIRECTORY,
        fileExtension: null,
        blobTimeout: -1, // don't delete blobs
        attempts: Config.defaultDownloadAttempts,
        ondownload: function(){
            console.log('downloaded (even locally)', o.url);
        }
    });

    console.log('URL Added to downloads:', fileUrl);
    if (!fileUrl) {
        fileUrl = location.href;
        console.warn('Input URL is null, using location.href');
    }

    // if iterable, iterate and download
    if (typeof fileUrl === 'object' && typeof fileUrl[Symbol.iterator] === 'function') {
        downloadBatch(fileUrl);
        console.warn('The file url passed to be downloaded is an object, trying to download it as multiple urls:', fileUrl);
        return;
    }

    //
    fileUrl = normalizeUrl((fileUrl).replace(/["]/gi, ''));

    if (/^data:/.test(fileUrl) && !Config.ALLOW_BASE64_IMAGE_DOWNLOADS) {
        console.error('The source is a base64-type, download was prevented:', fileUrl);
        return;
    }
    if (Config.BLACK_LIST.has(fileUrl)) {
        console.warn('Blacklisted URL:', fileUrl);
        return;
    }
    if (downloadedSet.has(fileUrl) && !Config.ALLOW_DUPES) {
        throw ('Request to download duplicate file: ' + fileUrl);
    }

    fileUrl = extractFullUrlForSpecialHostnames(normalizeUrl(fileUrl));

    if (fileName && fileName.length > 1) { // if fileName passed
        var oldfName = fileName;
        fileName = cleanFileName(fileName);
        console.log(`Filename passed: "${oldfName}" -> cleaned: "${fileName}"`);
    } else {
        if (o.element === 'object') { // if element passed: try the attributes
            for (const nameAttribute of Config.NAME_ATTRIBUTES) {
                if (o.element.hasAttribute(nameAttribute)) {
                    fileName = o.element.getAttribute(nameAttribute);
                    console.log('Got fileName from element:', fileName, fileUrl);
                    break;
                }
            }
        } else { // fall back to the url
            fileName = nameFile(fileUrl);
        }
    }

    if (!fileName) {
        fileName = 'a_' + (cleanGibberish(nameFile(document.title)) || cleanGibberish(nameFile(fileName))) + ' ' + (fileNumber);
        fileNumber++;
    }

    if (directory && directory.length) {// if downloadDirectory passed
        console.log('DownloadDirectory passed:', directory);
        directory = cleanFileName(directory, true);
        console.log('DownloadDirectory passed (clean):', directory);
    } else { // if directory NOT passed, get directory from the filename
        const split = fileName.split(/\//);
        if (split.length > 1) {
            fileName = split.pop();
            directory = split.pop();
        } else {
            directory = '';
        }
    }
    if (directory) directory += '/'; // adding trailing path terminator

    /*
    // makes sure that there is a maximum of one backslash "/" (to prevent having too many nested directories)
     let result = limitBackslashes(fileName);
     downloadDirectory = result[0];
     fileName = result[1];
    */
    let fileExtension = o.fileExtension || getFileExtension(fileUrl);

    // remove all extra extensions
    if (fileExtension) {// don't remove it if there isn't a fileExtension
        fileName = fileName.replace(new RegExp('\.' + fileExtension, 'gi'), '');
    }
    let finalName = removeDoubleSpaces(
        Config.MAIN_DIRECTORY + directory + Config.IndividualDirectoryName + fileName + '.' + fileExtension
    );

    debug && console.log(
        'fileUrl:', fileUrl,
        '\ndownloadDirectory:', directory,
        '\nfileName:', fileName,
        '\nextension:', fileExtension,
        '\nFINAL_NAME:', finalName
    );

    /**
     * options:
     * url          - the URL from where the data should be downloaded
     * name         - the filename - for security reasons the file extension needs to be whitelisted at Tampermonkey's options page
     * headers      - see GM_xmlhttpRequest for more details
     * saveAs       - boolean value, show a saveAs dialog
     * onerror      callback to be executed if this download ended up with an error
     * onload       callback to be executed if this download finished
     * onprogress   callback to be executed if this download made some progress
     * ontimeout    callback to be executed if this download failed due to a timeout
     */
    GM_download({
        name: finalName,
        url: fileUrl,
        onload: function onload() {
            console.log('Download finished', finalName, '\n' + fileUrl);
            downloadedSet.add(fileUrl);
            // FIXME: error always appears stating that o.onload isn't a function
            o.onload();
        },
        onerror: function (r) {
            o.onerror(r);
            downloadedSet.delete(fileUrl); // upon failure, remove the url from the list to give it another chance.
            console.warn(
                'Download failed for link:', fileUrl,
                '\nError:', r,
                '\nDetails:', r.details
            );
            /**
             error - error reason
             not_enabled,
             not_whitelisted,
             not_permitted,
             not_supported,
             not_succeeded, - the download wasn't started or failed, the details attribute may provide more information
             */
            const error = r.error;

            switch (error) {
                case 'not_succeeded':
                    const errorCurrent = r.details.current;
                    switch (errorCurrent.toLowerCase()) {
                        case 'server_failed': // fall-through
                        case 'network_failed':
                            retry(fileUrl, finalName, Config.defaultDownloadAttempts);
                            break;
                        case 'not_whitelisted':
                            retry(
                                fileUrl.replace(/\?.*/, ''),
                                finalName.substring(0,
                                    (finalName.lastIndexOf('?') > -1) ? finalName.lastIndexOf('?') : (finalName.length + '.oops.jpg')
                                ),
                                Config.defaultDownloadAttempts);
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
                //                 case 'not_whitelisted':
                //                     break;
                default:
                    retry(fileUrl, finalName, 1);
            }
        },
        onprogress: function (p) {
            console.debug('Progress:', p);
        },
        saveAs: false,
        // headers: {},
        ontimeout: function () {
        },
    });
}

function retry(fileUrl, finalName, count) {
    console.log('RETRYING:', fileUrl);
    // noinspection JSUnresolvedFunction
    GM_download({
        name: finalName,
        url: fileUrl,
        onload: onload,
        onerror: function () {
            if (count > 0) {
                retry(fileUrl, finalName, --count);
            } else {
                // noinspection JSUnresolvedFunction
                GM_download({
                    name: `${Config.MAIN_DIRECTORY}/${nameFile(fileUrl)}.${getFileExtension(fileUrl)}`,
                    url: fileUrl,
                    onload: onload,
                    onerror: onerrorFinal
                });

            }
        }
    });

    function onerrorFinal(rr) {
        if (!isDdgUrl(fileUrl)) {
            GM_download({
                name: `${finalName}.${getFileExtension(fileUrl)}`,
                url: ddgProxy(fileUrl),
                onload: onload,
                onerror: function (rrr) {
                    downloadedSet.delete(fileUrl); // upon failure, remove the url from the list to give it another chance.
                    console.error('Download failed:', fileUrl, rrr);
                }
            });
        }
        downloadedSet.delete(fileUrl); // upon failure, remove the url from the list to give it another chance.
        console.error('Download failed:', finalName, fileUrl, rr);
    }
}

/**
 * @deprecated
 * @param inputUrls
 * @param directory
 * @param maxDlLimit
 */
function downloadBatch(inputUrls, directory, maxDlLimit) { // download batch but with a max count limit
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
    if (!inputUrls) throw 'mainImage input URLs null!';

    console.log('Image batch received:', inputUrls);
    const batchName = `${cleanFileName(cleanGibberish(document.title), true)}/`;
    zipImages(inputUrls, `${directory} ${batchName}`);
}


function tryDecodeURIComponent(str) {
    try {
        return decodeURIComponent(str);
    } catch (e) {
        return str;
    }
}
function nameFile(fileUrl) {
    if (Config.NAME_FILES_BY_NUMBER === true) return (` ${fileNumber++}`);

    let fileName = 'untitled';
    try {
        fileName = clearUrlGibberish(tryDecodeURIComponent(fileUrl).split('/').pop())
            .split('.')[0];
    } catch (e) {
        console.error('Failed to name file', fileUrl, e);
    }
    fileName = cleanFileName(new RegExp(`[${invalidNameCharacters}]`).test(fileName) ? (`${document.title} - `) : fileName);
    return fileName;
}
function getFileExtension(fileUrl) {
    const ext = clearUrlGibberish((String(fileUrl)).split(/[.]/).pop()) //the string after the last '.'
        .replace(/[^a-zA-Z0-9].+($|\?)/gi, '') // replace everything that is non-alpha, numeric nor a '.'
        .replace(/[^\w]/gi, '');
    return !ext ? 'oops' : ext;
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

/** creates an anchor, clicks it, then removes it
 * this is done because some actions cannot be done except in this way
 * @param {string} url
 * @param {string=} name
 * @param {string=} target
 */
function anchorClick(url, name, target = 'self') {
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
            const [fullMatch, mimeType1, mimeType2] = res.responseHeaders.match(/content-type: ([\w]+)\/([\w\-]+)/);
            const contentType = [mimeType1, mimeType2].join('/');
            if (/(<!DOCTYPE)|(<html)/.test(res.responseText) || !/image/i.test(mimeType1)) {
                console.error('Not image data!', res.responseText);
                return false;
            }
            requestAndZipFile(ddgProxy(fileUrl), fileName);
        } else { // if is a proxy url and it failed, just give up
            return true;
        }
    });
}
/**
 *
 * @param fileUrls  this should be an iterable containing objects, each containing the fileUrl and the desired fileName.
 *  if empty, will use images matching this selector by default: "img.img-big"
 *
 *   file.fileURL = file.fileURL || file.fileUrl || file.url || file.src || file.href;
 *   file.fileName = file.fileName || file.alt || file.title || nameFile(file.fileURL) || "Untitled image";
 * @param zipName
 * @param onBadResponse
 * @return {JSZip}
 */
function zipFiles(fileUrls, zipName = '', onBadResponse = () => null) {
    const zip = new JSZip();
    zip.zipName = (zipName ? zipName : document.title).replace(/\//g, ' ');
    zip.progressBar = setupProgressBar();


    const selector = `img.img-big`;
    const files = Array.from(fileUrls ? fileUrls : qa(selector)).map(file => {
        if (!file) return;
        if (file.slice && file.indexOf) { // if string
            file = {fileURL: file};
        }

        function getFirstProperty(o, properties) {
            if (!o) return null;
            for (const p of properties) {
                if (o.hasOwnProperty(p))
                    return o[p];
            }
        }

        file.fileURL = getFirstProperty(file, ['fileURL', 'fileUrl', 'url', 'src', 'href']);
        file.fileName = getFirstProperty(file, ['fileName', 'alt', 'title']) || nameFile(file.fileURL) || 'Untitled';
        return file;
    }).filter(file => !!file);
    zip.zipTotal = Array.from(files).length;

    window.addEventListener('beforeunload', zipBeforeUnload);
    console.log('zipping images:', files);

    for (const file of files)
        try {
            requestAndZipFile(file.fileURL, file.fileName);
        } catch (r) {
            console.error(r);
        }


    /**
     * Requests the image and adds it to the local zip
     * @param fileUrl
     * @param fileName
     * @param onBadResponse function(response): a function which is passed the response in both onload and onerror
     */
    function requestAndZipFile(fileUrl, fileName, onBadResponse) {
        var fileSize = 0;
        zip.loadedLast = 0;
        zip.activeZipThreads++;

        fileName = zip.getValidIteratedName(removeDoubleSpaces(fileName.replace(/\//g, ' ')));

        var xhr;

        xhr = GM_xmlhttpRequest({
            method: 'GET',
            url: fileUrl,
            responseType: 'arraybuffer',
            binary: true,
            onload: function (res) {
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

                if (typeof onBadResponse === 'function' && onBadResponse(res, fileUrl)) {
                    zip.current++;
                    return;
                }
                // you'll get a match like this:    ["content-type: image/png", "image", "png"]
                const [fullMatch, mimeType1, mimeType2] = res.responseHeaders.match(/content-type: ([\w]+)\/([\w\-]+)/);
                const contentType = [mimeType1, mimeType2].join('/');
                const blob = new Blob([res.response], {type: contentType});
                const fileExtension = mimeTypes.hasOwnProperty(contentType) && mimeTypes[contentType] ?
                    mimeTypes[contentType].extensions[0] :
                    mimeType2;

                console.debug('contentType:', contentType);
                zip.file(`${fileName.trim()}_${zip.current + 1}.${fileExtension}`, blob);
                console.log('Added file to zip:', fileName, fileUrl);
                zip.responseBlobs.add(blob);
                zip.current++;

                // if finished, stop
                if (zip.current < zip.zipTotal || zip.zipTotal <= 0) {
                    return;
                }

                // Completed!
                if (zip.current >= zip.zipTotal - 1) {
                    console.log('Generating ZIP...\nFile count:', Object.keys(zip.files).length);
                    zip.zipTotal = -1;
                    if (zip.progressBar)
                        zip.progressBar.destroy();
                    zip.genZip();
                }
                zip.activeZipThreads--;
            },
            onreadystatechange: function (res) {
                console.debug('Request state changed to: ' + res.readyState);
                if (res.readyState === 4) {
                    console.debug('ret.readyState === 4');
                }
            },
            onerror: function (res) {
                if (typeof onBadResponse === 'function' && onBadResponse(res, fileUrl)) {
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
            onprogress: function (res) {

                // FIXME: fix abort condition, when should it abort?
                const abortCondition = zip.files.hasOwnProperty(fileName) || zip.current < zip.zipTotal || zip.zipTotal <= 0;
                if (abortCondition && false) {
                    if (xhr.abort) {
                        xhr.abort();
                        console.log('GM_xmlhttpRequest ABORTED zip!!!!!');
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

                    if (false) {
                        console.debug(
                            'loadedSoFar:', res.loaded,
                            '\njustLoaded:', loadedSoFar - zip.loadedLast,
                            '\nfileprogress:', loadedSoFar / res.total
                        );
                    }

                    const progressText = `Files in ZIP: (${Object.keys(zip.files).length} / ${zip.zipTotal}) Active threads: ${zip.activeZipThreads}     (${zip.totalLoaded} / ${zip.totalSize})`;
                    if (typeof progressBar !== 'undefined') {
                        progressBar.set(totalProgress);
                        progressBar.setText(progressText);
                    } else {
                        var progressbarContainer;
                        if ((progressbarContainer = q('#progressbar-cotnainer'))) {
                            progressbarContainer.innerText = progressText;
                        }
                    }

                    zip.loadedLast = loadedSoFar;
                }
            }
        });
        return xhr;
    }

    // give access to the zip variable by adding it to the global object
    console.log(
        `zip object reference, To access, use:    window.zips[${unsafeWindow.zips.length}]\n`, zip
    );
    unsafeWindow.zips.push(zip);

    return zip;
}


function setupProgressBar() {
    const pbHeader = createElement(`<header id="progressbar-container"/>`);
    if (!q('#progressbar-container')) {
        document.body.firstElementChild.before(pbHeader);
    }

    // noinspection JSUnresolvedVariable
    if (typeof (ProgressBar) == 'undefined') {
        console.warn('ProgressBar is not defined.');
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
    const progressbarText = q('.progressbar-text');
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
                '\nresponseText: ', res.responseText ,
                '\nreadyState: ', res.readyState ,
                '\nresponseHeaders: ', res.responseHeaders ,
                '\nstatus: ', res.status ,
                '\nstatusText: ', res.statusText ,
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
