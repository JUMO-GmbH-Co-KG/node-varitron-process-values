
module.exports = function (RED) {
    function browseProcessValues(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        const systemInformationManager = require('./systemInformationManager.js');
        let modules = [];
        let instances = [];
        let pvalues = [];

        async function getProviderList() {
            modules = [];
            instances = [];
            try {
                const processdata = await systemInformationManager.getRegisteredProvidersList('us_EN', 'ProcessData');
                for (let pdata of processdata) {
                    modules.push(pdata.moduleName);
                }
            } catch (e) {
                console.log('cant get RegisteredProviderList.' + e);
            }
            for (let mod of modules) {
                try {
                    const instance = await systemInformationManager.getListOfInstances(mod, 'us_EN');
                    instances.push(instance);
                } catch (e) {
                    console.log('cant get list of instances for: ' + e);
                }

            }
            for (let instance of instances) {
                try {
                    const moduleName = instance[0].moduleName;
                    const instanceName = instance[0].instanceName;
                    const value = await systemInformationManager.getProcessDataDescription(moduleName, instanceName, 'us_EN');
                    pvalues.push(value);
                } catch (e) {
                    console.log('cant get ProcessDescription for: ' + e);
                }
            }
            node.send({ payload: pvalues });

        }



        // Start fetching data when the node is deployed
        node.on("input", function () {
            getProviderList();
        });

        // Handle node cleanup
        node.on("close", function () {
            // Clean up any resources if needed
        });
    }
    RED.nodes.registerType("browse-process-values", browseProcessValues);
}
