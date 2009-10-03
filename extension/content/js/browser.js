(function(window) {
   const MP_URL = "chrome://memprof/content/memory-profiler.html";

   window.gMemoryProfiler = {
     open: function open() {
       var tab = window.gBrowser.addTab(MP_URL);
       window.gBrowser.selectedTab = tab;
     }
   };
 })(window);
