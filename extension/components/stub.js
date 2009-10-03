const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

// The bulk of this function was taken from:
//
// http://code.google.com/p/gears/source/browse/trunk/gears/base/firefox/static_files/components/stub.js

function NSGetModule() {
  return {
    registerSelf: function(compMgr, location, loaderStr, type) {
      var appInfo = Cc["@mozilla.org/xre/app-info;1"]
                    .getService(Ci.nsIXULAppInfo);
      var runtime = Cc["@mozilla.org/xre/app-info;1"]
                    .getService(Ci.nsIXULRuntime);

      var osDirName = runtime.OS + "_" + runtime.XPCOMABI;
      var platformVersion = appInfo.platformVersion.substring(0, 5);
      var libFile = location.parent.parent;
      libFile.append("lib");
      libFile.append(osDirName);
      libFile.append(platformVersion);

      if (!(libFile.exists() && libFile.isDirectory())) {
        Components.utils.reportError(
          ("Sorry, a required binary component for Jetpack isn't " +
           "currently available for your operating system (" + osDirName +
           ") and platform (Gecko " + platformVersion + ").")
        );
      } else {
        // Note: we register a directory instead of an individual file
        // because Gecko will only load components with a specific
        // file name pattern. We don't want this file to have to know
        // about that. Luckily, if you register a directory, Gecko
        // will look inside the directory for files to load.
        compMgr = compMgr.QueryInterface(Ci.nsIComponentRegistrar);
        compMgr.autoRegister(libFile);
      }
    }
  };
}
