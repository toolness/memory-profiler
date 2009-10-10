const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

var gSnapshots = [];

function getBinaryComponent() {
  try {
    var factory = Cc["@labs.mozilla.com/jetpackdi;1"]
                 .createInstance(Ci.nsIJetpack);
    return factory.get();
  } catch (e) {
    return null;
  }
}

function log(message, isInstant, elem) {
  if (!elem)
    elem = $("<p></p>");
  if (!isInstant)
    elem.hide();
  elem.text(message);
  $("#output").append(elem);
  if (!isInstant)
    elem.slideDown();
}

function logError(message) {
  log(message, false, $('<div class="error"></div>'));
}

function addTableEntries(table, infos, buildRow, onDone) {
  var cellsPerRow = $(table).find("th").length;

  function addRow(info) {
    var row = $("<tr></tr>");
    var args = [info];
    for (var i = 0; i < cellsPerRow; i++) {
      var cell = $("<td></td>");
      args.push(cell);
      row.append(cell);
    }
    buildRow.apply(row, args);
    $(table).append(row);
  }

  infos.slice(0, ENTRIES_TO_SHOW).forEach(addRow);

  if (infos.length > ENTRIES_TO_SHOW) {
    var more = $('<button>more\u2026</button>');
    function showMore() {
      more.remove();
      infos.slice(ENTRIES_TO_SHOW).forEach(addRow);
    }
    more.click(showMore);
  }

  $(table).after(more);
  $(table).parent().fadeIn(onDone);
}

var MAX_SHAPE_NAME_LEN = 80;
var ENTRIES_TO_SHOW = 10;

function makeViewSourceCallback(filename, lineNo) {
  return function viewSource() {
    window.openDialog("chrome://global/content/viewSource.xul",
                      "_blank", "all,dialog=no",
                      filename, null, null, lineNo);
  };
}

function makeShapeName(name) {
  if (name.length > MAX_SHAPE_NAME_LEN)
    name = name.slice(0, MAX_SHAPE_NAME_LEN) + "\u2026";
  name = name.replace(/,/g, "/");
  if (name && name.charAt(name.length-1) == "/")
    name = name.slice(0, name.length-1);
  if (!name)
    name = "(no properties)";
  return name;
}

function showReports(data, onDone) {
  var reports = $("#reports");

  reports = reports.clone();
  $(".report", reports).hide();
  reports.show();
  $("#output").append(reports);

  var winInfos = [info for each (info in data.windows)];
  winInfos.sort(function(b, a) { return a.referents - b.referents; });

  var windowNum = 1;
  function buildWinInfoRow(info, name, references, referents) {
    name.text(windowNum++);
    references.text(info.references);
    referents.text(info.referents);
  }

  addTableEntries($("#wintable", reports), winInfos, buildWinInfoRow);

  var ncInfos = [{name: name, instances: data.nativeClasses[name]}
                 for (name in data.nativeClasses)];
  ncInfos.sort(function(b, a) { return a.instances - b.instances; });

  function buildNcInfoRow(info, name, instances) {
    name.text(info.name);
    instances.text(info.instances);
  }

  addTableEntries($("#nctable", reports), ncInfos, buildNcInfoRow);

  var objInfos = [{name: name, count: data.shapes[name]}
                  for (name in data.shapes)];
  objInfos.sort(function(b, a) { return a.count - b.count; });

  function buildObjInfoRow(info, name, count) {
    name.text(makeShapeName(info.name));
    name.addClass("object-name");

    count.text(info.count);
  }

  addTableEntries($("#objtable", reports), objInfos, buildObjInfoRow);

  var funcInfos = [info for each (info in data.functions)];
  funcInfos.sort(function(b, a) { return a.rating - b.rating; });

  function buildFuncInfoRow(info, name, instances, referents, isGlobal,
                            protoCount) {
    name.text(info.name + "()");
    name.addClass("object-name");
    name.addClass("clickable");
    name.click(makeViewSourceCallback(info.filename, info.lineStart));
    instances.text(info.instances);
    referents.text(info.referents);
    isGlobal.text(info.isGlobal);
    protoCount.text(info.protoCount);
  }

  addTableEntries($("#functable", reports), funcInfos, buildFuncInfoRow,
                  onDone);
}

function updateSnapshots(data, startTime, name, onDone) {
  var entry = $("<li></li>");
  entry.addClass("clickable");
  entry.addClass("selected");
  var time = startTime.toTimeString().slice(0, 8);
  entry.text("Snapshot of \u201c" + name + "\u201d at " + time);
  entry.click(
    function() {
      $("#snapshot-list .selected").removeClass("selected");
      $(this).addClass("selected");
      $("#output").empty();
      showReports(data);
    });

  if (gSnapshots.length > 0)
    entry.hide();

  $("#snapshot-list .selected").removeClass("selected");
  $("#snapshot-list").append(entry);

  if (gSnapshots.length > 0)
    entry.fadeIn(onDone);
  else
    $("#snapshots").fadeIn(onDone);

  gSnapshots.push({startTime: startTime,
                   data: data});
}

function analyzeResult(result, startTime, name) {
  var worker = new Worker('js/memory-profiler.worker.js');
  worker.onmessage = function(event) {
    //log("Done.");
    var data = JSON.parse(event.data);
    updateSnapshots(data, startTime, name,
                    function() { showReports(data); });
  };
  worker.onerror = function(error) {
    logError("An error occurred: " + error.message);
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

  var startTime = new Date();
  var binary = getBinaryComponent();
  if (!binary) {
    logError("Required binary component not found! One may not be " +
             "available for your OS and Firefox version.");
    return;
  }
  var result = binary.profileMemory(code, filename, 1,
                                    windowsToProfile);
  var totalTime = (new Date()) - startTime;
  //log(totalTime + " ms were spent in memory profiling.");

  result = JSON.parse(result);
  if (result.success) {
    //log("Analyzing profiling data now, please wait.");
    //log("named objects: " + JSON.stringify(result.data.namedObjects));
    window.setTimeout(function() {
      analyzeResult(JSON.stringify(result.data), startTime,
                    browserInfo.name);
    }, 0);
  } else {
    logError("An error occurred while profiling.");
    logError(result.traceback);
    logError(result.error);
  }
}

function makeProfilerFor(browserInfo) {
  return function() {
    Components.utils.forceGC();
    $("#output").empty();
    //log("Profiling \u201c" + browserInfo.name + "\u201d. Please wait.",
    //    true);
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
