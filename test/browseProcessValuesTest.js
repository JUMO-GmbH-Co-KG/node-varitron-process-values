import * as td from 'testdouble';
import { expect } from 'chai';
import { assert } from 'chai';

describe('getList function', async function () {
    beforeEach(async function () {
        //replace individual in every test
        this.systemInformationManager = await td.replaceEsm('../src/systemInformationManager.js');
        this.providerHandler = await td.replaceEsm('../src/providerHandler.js');

        this.subject = await import('../src/browseProcessValues.js');
    });

    afterEach(function () {
        td.reset(); // Reset test doubles after each test
    });

    it('should resolve with provider list', async function () {
        const mockProcessData = {
            type: 'TreeNode',
            value: {
                SomeThing: {
                    offsetSharedMemory: 0,
                    readOnly: false,
                    type: 'Boolean',
                    labelText: 'SomeThing',
                },
            },
        };

        // individual replacement
        td.when(this.systemInformationManager.getRegisteredProvidersList('us_EN', 'ProcessData')).thenResolve([{ moduleName: 'Module1', objectName: 'Object1' }]);
        td.when(this.systemInformationManager.getListOfInstances('Module1', 'Object1', 'us_EN')).thenResolve([{ moduleName: 'Module1', instanceName: 'Instance1', objectName: 'Object1' }]);
        td.when(this.providerHandler.getProcessDataDescription('Module1', 'Instance1', 'Object1', 'us_EN')).thenResolve(mockProcessData);

        const result = await this.subject.getList();

        // Testing the function
        expect(result).to.deep.equal([{
            moduleName: 'Module1',
            objectName: 'Object1',
            instances: [
                {
                    name: 'Instance1',
                    values: {
                        SomeThing: {
                            name: 'SomeThing',
                            readOnly: false,
                            selector: 'ProcessData#Module1#Object1#Instance1#SomeThing',
                            type: 'Boolean',
                            unit: '',
                        }
                    },
                },
            ],
        }]);
    });

    it('should use the cache, when calling two times', async function () {
        const mockProcessData = {
            type: 'TreeNode',
            value: {
                SomeThing: {
                    offsetSharedMemory: 0,
                    readOnly: false,
                    type: 'Boolean',
                    labelText: 'SomeThing',
                },
            },
        };

        const expected = [{
            moduleName: 'Module1',
            objectName: 'Object1',
            instances: [
                {
                    name: 'Instance1',
                    values: {
                        SomeThing: {
                            name: 'SomeThing',
                            readOnly: false,
                            selector: 'ProcessData#Module1#Object1#Instance1#SomeThing',
                            type: 'Boolean',
                            unit: '',
                        }
                    },
                },
            ],
        }];

        // individual replacement
        td.when(this.systemInformationManager.getRegisteredProvidersList('us_EN', 'ProcessData')).thenResolve([{ moduleName: 'Module1', objectName: 'Object1' }]);
        td.when(this.systemInformationManager.getListOfInstances('Module1', 'Object1', 'us_EN')).thenResolve([{ moduleName: 'Module1', instanceName: 'Instance1', objectName: 'Object1' }]);
        td.when(this.providerHandler.getProcessDataDescription('Module1', 'Instance1', 'Object1', 'us_EN')).thenResolve(mockProcessData);

        const result1 = await this.subject.getList();

        // Testing the function
        expect(result1).to.deep.equal(expected);

        // when using the cache the second time, the systemInformationManager should not be called again
        td.when(this.systemInformationManager.getRegisteredProvidersList('us_EN', 'ProcessData')).thenDo(() => { assert.fail('systemInformationManager.getRegisteredProvidersList should not be called again'); });
        td.when(this.systemInformationManager.getListOfInstances('Module1', 'Object1', 'us_EN')).thenDo(() => { assert.fail('systemInformationManager.getListOfInstances should not be called again'); });
        td.when(this.providerHandler.getProcessDataDescription('Module1', 'Instance1', 'Object1', 'us_EN')).thenDo(() => { assert.fail('providerHandler.getProcessDataDescription should not be called again'); });

        const result2 = await this.subject.getList();
        expect(result2).to.deep.equal(expected);
    });

    it('should resolve with real test data', async function () {
        // Mocking the necessary functions from systemInformationManager
        const mockProvidersList = [
            {
                closeMode: 'Manual',
                hide: false,
                iconName: 'Curves',
                labelTextId: 'DataBaseManagement/ProcessData',
                moduleName: 'DataBaseManagement',
                objectName: 'ProcessData',
                selectionType: 'Selection',
            },
        ];
        const mockInstances = [
            {
                closeMode: 'Manual',
                dataModel: '',
                hasDependency: false,
                hide: false,
                iconName: '',
                instanceName: 'DatabaseManagement',
                label: 'Database management',
                labelShort: 'Database management',
                labelTextId: 'DataBaseManagement/DatabaseManagement',
                lastModified: '',
                moduleName: 'DataBaseManagement',
                objectName: 'ProcessData',
                selectionType: 'Selection',
                selectorTypeList: [
                    'DigitalSelector',
                ],
                uiJob: 'guiJobOpenConfiguration',
            },
        ];
        const mockProcessData = {
            configurationVersion: '1.e93e2530c1003bfa484210bb34ca5816',
            cpveVersion: '419.7.0.0.31',
            displayPosition: 0,
            doubleBuffer: false,
            hasDependency: false,
            iconName: '',
            key: 'DataBaseManagementDatabaseManagementa278d',
            labelText: 'Database management',
            labelTextId: 'DataBaseManagement/DatabaseManagement',
            lastModified: '',
            modifiedBy: '',
            schemeVersion: 1,
            selectorTypeList: [
                'DigitalSelector',
            ],
            sizeOfSharedMemory: 4,
            type: 'TreeNode',
            value: {
                MemoryAlarm: {
                    displayPosition: 0,
                    labelText: 'Memory alarm',
                    labelTextId: 'DataBaseManagement/MemoryAlarmProcess',
                    offsetSharedMemory: 0,
                    readOnly: false,
                    relativeOffsetMetadata: 4,
                    selectorTypeListEndpoint: [
                        'DigitalSelector',
                    ],
                    sizeMetadata: 0,
                    sizeValue: 4,
                    type: 'Boolean',
                    measurementRangeAttributes: [
                        {
                            unitText: {
                                POSIX: '%',
                            },
                        },
                    ],
                },
            },
        };

        // Stubbing the necessary functions
        td.when(this.systemInformationManager.getRegisteredProvidersList('us_EN', 'ProcessData')).thenResolve(mockProvidersList);
        td.when(this.systemInformationManager.getListOfInstances('DataBaseManagement', 'ProcessData', 'us_EN')).thenResolve(mockInstances);
        td.when(this.providerHandler.getProcessDataDescription('DataBaseManagement', 'DatabaseManagement', 'ProcessData', 'us_EN')).thenResolve(mockProcessData);

        // Call the function being tested
        const result = await this.subject.getList();

        // Assertions
        expect(result).to.be.an('array');
        expect(result).to.deep.equal([
            {
                moduleName: 'DataBaseManagement',
                objectName: 'ProcessData',
                instances: [
                    {
                        name: 'DatabaseManagement',
                        values: {
                            MemoryAlarm: {
                                name: 'Memory alarm',
                                readOnly: false,
                                selector: 'ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm',
                                type: 'Boolean',
                                unit: '%',
                            },
                        },
                    },
                ],
            },
        ]);
    });

    it('should resolve with empty result when instanceName is empty', async function () {
        // Mocking the necessary functions from systemInformationManager
        const mockProvidersList = [
            {
                closeMode: 'Manual',
                hide: false,
                iconName: 'Curves',
                labelTextId: 'DataBaseManagement/ProcessData',
                moduleName: 'DataBaseManagement',
                objectName: 'ProcessData',
                selectionType: 'Selection',
            },
        ];
        const mockInstances = [
            {
                closeMode: 'Manual',
                dataModel: '',
                hasDependency: false,
                hide: false,
                iconName: '',
                instanceName: '',
                label: 'Database management',
                labelShort: 'Database management',
                labelTextId: 'DataBaseManagement/DatabaseManagement',
                lastModified: '',
                moduleName: 'DataBaseManagement',
                objectName: 'ProcessData',
                selectionType: 'Selection',
                selectorTypeList: [
                    'DigitalSelector',
                ],
                uiJob: 'guiJobOpenConfiguration',
            },
        ];

        // Stubbing the necessary functions
        td.when(this.systemInformationManager.getRegisteredProvidersList('us_EN', 'ProcessData')).thenResolve(mockProvidersList);
        td.when(this.systemInformationManager.getListOfInstances('DataBaseManagement', 'ProcessData', 'us_EN')).thenResolve(mockInstances);

        // Call the function being tested
        const result = await this.subject.getList();

        // Assertions
        expect(result).to.be.an('array');
        expect(result).to.deep.equal([]);
    });

    it('should resolve with empty data when browsing blacklisted instances', async function () {
        const mockProvidersList = [
            {
                closeMode: 'Manual',
                hide: false,
                iconName: 'Curves',
                labelTextId: 'DataBaseManagement/ProcessData',
                moduleName: 'DataBaseManagement',
                objectName: 'ProcessData',
                selectionType: 'Selection',
            },
        ];
        const mockInstancesWithBlacklistedStructure = [
            {
                dataSourceType: 'JsonData',
                hide: true,
                iconName: '',
                instanceName: 'RealTimeThread01',
                label: '',
                labelShort: '',
                labelTextId: '',
                notInDeviceExportedArchive: false,
                rights: [
                ],
                schemeVersion: 1,
                selectionType: 'Node',
                skipMenuLevel: false,
                substructure: [
                    {
                        closeMode: 'Manual',
                        dataModel: '',
                        hasDependency: false,
                        hide: false,
                        iconName: '',
                        instanceName: 'RealTimeThread01/ThreadData',
                        label: 'Thread data',
                        labelShort: 'Thread data',
                        labelTextId: 'RealTimeScheduler/ThreadData',
                        lastModified: '',
                        moduleName: 'RealTimeScheduler',
                        objectName: 'ProcessData',
                        selectionType: 'Selection',
                        uiJob: 'guiJobOpenConfiguration',
                    },
                ],
            }];
        const mockProcessData = {
            type: 'TreeNode',
            value: {
                SomeThing: {
                    offsetSharedMemory: 0,
                    readOnly: false,
                    type: 'Boolean',
                },
            },
        };
        // Stubbing the necessary functions
        td.when(this.systemInformationManager.getRegisteredProvidersList('us_EN', 'ProcessData')).thenResolve(mockProvidersList);
        td.when(this.systemInformationManager.getListOfInstances('DataBaseManagement', 'ProcessData', 'us_EN')).thenResolve(mockInstancesWithBlacklistedStructure);
        td.when(this.providerHandler.getProcessDataDescription('RealTimeScheduler', 'RealTimeThread01/ThreadData', 'ProcessData', 'us_EN')).thenResolve(mockProcessData);

        // Call the function being tested
        const result = await this.subject.getList();

        // Assertions
        expect(result).to.be.an('array');
        expect(result).to.deep.equal([]);
    });

    it('should resolve with real test data including a substructure', async function () {
        const mockProvidersList = [
            {
                closeMode: 'Manual',
                hide: false,
                iconName: 'Curves',
                labelTextId: 'EtherCatGateway/ProcessData',
                moduleName: 'EtherCatGateway',
                objectName: 'ProcessData',
                selectionType: 'Selection',
            },
        ];
        const mockInstancesWithSubstructure = [{
            dataSourceType: 'JsonData',
            hide: true,
            iconName: 'Controller',
            instanceName: '705010',
            label: '4x controller',
            labelShort: '4x controller',
            labelTextId: 'EtherCatGateway/705010',
            notInDeviceExportedArchive: false,
            rights: [
            ],
            schemeVersion: 1,
            selectionType: 'Node',
            selectorTypeList: [
                '705010/AnalogInput',
                '705010/DigitalInput',
            ],
            skipMenuLevel: false,
            substructure: [
                {
                    closeMode: 'Manual',
                    dataModel: '',
                    hasDependency: false,
                    hide: false,
                    iconName: '',
                    instanceName: '705010/BinaryXelector',
                    label: 'Digital signals',
                    labelShort: 'Digital signals',
                    labelTextId: 'EtherCatGateway/BinarySelector',
                    lastModified: '',
                    moduleName: 'EtherCatGateway',
                    objectName: 'ProcessData',
                    selectionType: 'Selection',
                    selectorTypeList: [
                        '705010/DigitalInput',
                    ],
                    uiJob: 'guiJobOpenConfiguration',
                },
                {
                    closeMode: 'Manual',
                    dataModel: '',
                    hasDependency: false,
                    hide: false,
                    iconName: '',
                    instanceName: '705010/AnalogSelector',
                    label: 'Analog signals',
                    labelShort: 'Analog signals',
                    labelTextId: 'EtherCatGateway/AnalogSelector',
                    lastModified: '',
                    moduleName: 'EtherCatGateway',
                    objectName: 'ProcessData',
                    selectionType: 'Selection',
                    selectorTypeList: [
                        '705010/AnalogInput',
                    ],
                    uiJob: 'guiJobOpenConfiguration',
                },
            ],
        }];
        const mockProcessData = {
            type: 'TreeNode',
            value: {
                SomeThing: {
                    offsetSharedMemory: 0,
                    readOnly: false,
                    type: 'Boolean',
                    labelText: 'SomeThing',
                },
            },
        };
        // Stubbing the necessary functions
        td.when(this.systemInformationManager.getRegisteredProvidersList('us_EN', 'ProcessData')).thenResolve(mockProvidersList);
        td.when(this.systemInformationManager.getListOfInstances('EtherCatGateway', 'ProcessData', 'us_EN')).thenResolve(mockInstancesWithSubstructure);
        td.when(this.providerHandler.getProcessDataDescription('EtherCatGateway', '705010/BinaryXelector', 'ProcessData', 'us_EN')).thenResolve(mockProcessData);

        // Call the function being tested
        const result = await this.subject.getList();

        // Assertions
        expect(result).to.be.an('array');
        expect(result).to.deep.equal([
            {
                moduleName: 'EtherCatGateway',
                objectName: 'ProcessData',
                instances: [
                    {
                        name: '705010/BinaryXelector',
                        values: {
                            SomeThing: {
                                name: 'SomeThing',
                                selector: 'ProcessData#EtherCatGateway#ProcessData#705010/BinaryXelector#SomeThing',
                                type: 'Boolean',
                                readOnly: false,
                                unit: '',
                            },
                        },
                    },
                ],
            },
        ]);
    });

    it('should reject with error when unable to getRegisteredProvidersList', async function () {
        td.when(this.systemInformationManager.getRegisteredProvidersList('us_EN', 'ProcessData')).thenReject('some error');
        td.when(this.systemInformationManager.getListOfInstances('Module1', 'Object1', 'us_EN')).thenResolve([{ moduleName: 'Module1', instanceName: 'Instance1', objectName: 'Object1' }]);
        td.when(this.providerHandler.getProcessDataDescription('Module1', 'Instance1', 'Object1', 'us_EN')).thenResolve({ someData: 'description' });

        // expect, that this.subject.getList rejects with error
        try {
            await this.subject.getList();
            assert.fail('Expected an error to be thrown');
        } catch (error) {
            assert.include(error.message, 'some error', 'Error message should match');
        }
    });

    it('should reject with error when unable to getListOfInstances', async function () {
        td.when(this.systemInformationManager.getRegisteredProvidersList('us_EN', 'ProcessData')).thenResolve([{ moduleName: 'Module1', objectName: 'Object1' }]);
        td.when(this.systemInformationManager.getListOfInstances('Module1', 'Object1', 'us_EN')).thenReject('some error');
        td.when(this.providerHandler.getProcessDataDescription('Module1', 'Instance1', 'Object1', 'us_EN')).thenResolve({ someData: 'description' });

        try {
            await this.subject.getList();
            assert.fail('Expected an error to be thrown');
        } catch (error) {
            assert.include(error.message, 'some error', 'Error message should match');
        }
    });

    it('should reject with error when unable to getProcessDataDescription', async function () {
        td.when(this.systemInformationManager.getRegisteredProvidersList('us_EN', 'ProcessData')).thenResolve([{ moduleName: 'Module1', objectName: 'Object1' }]);
        td.when(this.systemInformationManager.getListOfInstances('Module1', 'Object1', 'us_EN')).thenResolve([{ moduleName: 'Module1', instanceName: 'Instance1', objectName: 'Object1' }]);
        td.when(this.providerHandler.getProcessDataDescription('Module1', 'Instance1', 'Object1', 'us_EN')).thenReject('some error');

        try {
            await this.subject.getList();
            assert.fail('Expected an error to be thrown');
        } catch (error) {
            assert.include(error.message, 'some error', 'Error message should match');
        }
    });
});

describe('findInstance function', async function () {
    afterEach(function () {
        td.reset(); // Reset test doubles after each test
    });
});