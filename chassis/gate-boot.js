/* M1 data-bundle gate: the shared gate (work-setup/build/gate/gate.js) has run the data files, so the chassis only loads the page
 * code and starts. List this file last in the `app` array of gate.config.json. */
Hub.loadData = function () { return Promise.resolve(); };
Hub.boot();
