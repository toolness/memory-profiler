const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

function getBinaryComponent() {
  try {
    var factory = Cc["@labs.mozilla.com/jetpackdi;1"]
                 .createInstance(Ci.nsIJetpack);
    return factory.get();
  } catch (e) {
    return null;
  }
}

function log(message, isInstant) {
  var elem = $("<p></p>");
  if (!isInstant)
    elem.hide();
  elem.text(message);
  $("#output").append(elem);
  if (!isInstant)
    elem.slideDown();
}

function addTableEntries(table, infos, addRow) {
  infos.slice(0, ENTRIES_TO_SHOW).forEach(addRow);

  if (infos.length > ENTRIES_TO_SHOW) {
    var more = $('<button>more...</button>');
    function showMore() {
      more.remove();
      infos.slice(ENTRIES_TO_SHOW).forEach(addRow);
    }
    more.click(showMore);
  }

  $(table).after(more);
  $(table).parent().fadeIn();
}

var MAX_SHAPE_NAME_LEN = 80;
var ENTRIES_TO_SHOW = 10;

function analyzeResult(result) {
  var worker = new Worker('js/memory-profiler.worker.js');
  worker.onmessage = function(event) {
    var data = JSON.parse(event.data);

    var objInfos = [{name: name, count: data.shapes[name]}
                    for (name in data.shapes)];
    objInfos.sort(function(b, a) {
      return a.count - b.count;
    });

    function addObjInfoRow(info) {
      var row = $("<tr></tr>");
      var name = $("<td></td>");
      if (info.name.length > MAX_SHAPE_NAME_LEN)
        info.name = info.name.slice(0, MAX_SHAPE_NAME_LEN) + "\u2026";
      info.name = info.name.replace(/,/g, "/");
      if (!info.name)
        info.name = "(no properties)";
      else
        if (info.name.charAt(info.name.length-1) == "/")
          info.name = info.name.slice(0, info.name.length-1);
      name.text(info.name);
      name.addClass("object-name");
      row.append(name);
      var count = $("<td></td>");
      count.text(info.count);
      row.append(count);
      $("#objtable").append(row);
    }

    addTableEntries($("#objtable"), objInfos, addObjInfoRow);

    var funcInfos = [info for each (info in data.functions)];
    funcInfos.sort(function(b, a) {
      return a.rating - b.rating;
    });

    function addFuncInfoRow(info) {
      var row = $("<tr></tr>");
      var name = $("<td></td>");
      name.text(info.name + "()");
      name.addClass("object-name");
      name.addClass("clickable");
      name.get(0).info = info;
      name.click(
        function() {
          window.openDialog(
            "chrome://global/content/viewSource.xul",
            "_blank", "all,dialog=no",
            this.info.filename, null, null, this.info.lineStart
          );
        });
      row.append(name);

      function addCell(content) {
        var cell = $("<td></td>");
        row.append(cell.text(content));
      }

      addCell(info.instances);
      addCell(info.referents);
      addCell(info.isGlobal);
      addCell(info.protoCount);

      $("#functable").append(row);
    }

    addTableEntries($("#functable"), funcInfos, addFuncInfoRow);

    //log("Raw window data: " + JSON.stringify(data.windows));
    if (data.rejectedTypes.length) {
      //log("Rejected types: " + data.rejectedTypes.join(", "));
    }
    log("Done. To profile again, please reload this page.");
  };
  worker.onerror = function(error) {
    log("An error occurred: " + error.message);
  };
  worker.postMessage(result);
}

function htmlCollectionToArray(coll) {
  var array = [];
  for (var i = 0; i < coll.length; i++)
    array.push(coll[i]);
  return array;
}

function getIframes(document) {
  return htmlCollectionToArray(document.getElementsByTagName("iframe"));
}

function recursivelyGetIframes(document) {
  var iframes = [];
  var subframes = getIframes(document);
  subframes.forEach(
    function(iframe) {
      iframes.push(iframe.contentWindow.wrappedJSObject);
      var children = recursivelyGetIframes(iframe.contentDocument);
      iframes = iframes.concat(children);
    });
  return iframes;
}

var EXTENSION_ID = "memory-profiler@labs.mozilla.com";

function doProfiling(browserInfo) {
  var extMgr = Cc["@mozilla.org/extensions/manager;1"]
               .getService(Components.interfaces.nsIExtensionManager);
  var loc = extMgr.getInstallLocation(EXTENSION_ID);
  var file = loc.getItemLocation(EXTENSION_ID);
  file.append('content');
  file.append('js');
  file.append('memory-profiler.profiler.js');
  var code = FileIO.read(file, 'utf-8');
  var filename = FileIO.path(file);

  var windowsToProfile = [];
  var browser = browserInfo.browser;
  var iframes = recursivelyGetIframes(browser.contentDocument);
  windowsToProfile = [browser.contentWindow.wrappedJSObject];
  windowsToProfile = windowsToProfile.concat(iframes);

  var start = new Date();
  var binary = getBinaryComponent();
  if (!binary) {
    log("Required binary component not found! One may not be available " +
        "for your OS and Firefox version.");
    return;
  }
  var result = binary.profileMemory(code, filename, 1,
                                    windowsToProfile);
  var totalTime = (new Date()) - start;
  //log(totalTime + " ms were spent in memory profiling.");

  result = JSON.parse(result);
  if (result.success) {
    log("Analyzing profiling data now, please wait.");
    //log("named objects: " + JSON.stringify(result.data.namedObjects));
    window.setTimeout(function() {
      analyzeResult(JSON.stringify(result.data));
    }, 0);
  } else {
    log("An error occurred while profiling.");
    log(result.traceback);
    log(result.error);
  }
}

function makeProfilerFor(browserInfo) {
  return function() {
    Components.utils.forceGC();
    $("#form").remove();
    log("Profiling \u201c" + browserInfo.name + "\u201d. Please wait.", true);
    window.setTimeout(function() { doProfiling(browserInfo); }, 0);
  };
}

var MAX_TAB_NAME_LEN = 60;

function getBrowserInfos() {
  var windows = [];
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
    .getService(Ci.nsIWindowMediator);
  var enumerator = wm.getEnumerator("navigator:browser");
  while(enumerator.hasMoreElements()) {
    var win = enumerator.getNext();
    if (win.gBrowser) {
      var browser = win.gBrowser;
      for (var i = 0; i < browser.browsers.length; i++) {
        var page = browser.browsers[i];
        var name = page.contentTitle || page.currentURI.spec;
        if (name.length > MAX_TAB_NAME_LEN)
          name = name.slice(0, MAX_TAB_NAME_LEN) + "\u2026";
        windows.push({browser: page,
                      name: name,
                      href: page.contentWindow.location.href});
      }
    }
  }
  return windows;
}

function onReady() {
  var browsers = getBrowserInfos();
  browsers.forEach(
    function(info) {
      var item = $("<li></li>");
      item.text(info.name);
      item.click(makeProfilerFor(info));
      item.addClass("clickable");
      $("#tab-list").append(item);
    });
}

$(window).ready(onReady);
