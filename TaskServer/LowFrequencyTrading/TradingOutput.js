exports.newTradingOutput = function newTradingOutput(bot, logger, tradingEngineModule, UTILITIES, FILE_STORAGE) {
    /*
    This module will load if necesary all the data outputs so that they can be appended with new
    records if needed. After running the simulation, it will save all the data outputs.
    */
    const MODULE_NAME = 'Trading Bot'

    let thisObject = {
        initialize: initialize,
        finalize: finalize,
        start: start
    }

    let utilities = UTILITIES.newCloudUtilities(logger)
    let fileStorage = FILE_STORAGE.newFileStorage(logger)

    return thisObject

    function finalize() {
        thisObject = undefined
        utilities = undefined
        fileStorage = undefined
        commons = undefined
    }

    function initialize() {

    }

    async function start(chart, timeFrame, timeFrameLabel, tradingProcessDate) {
        try {

            if (timeFrame > global.dailyFilePeriods[0][0]) {
                bot.processingDailyFiles = false
            } else {
                bot.processingDailyFiles = true
            }

            /* Preparing everything for the Simulation */
            const TRADING_SIMULATION = require('./TradingSimulation.js')
            let tradingSimulation = TRADING_SIMULATION.newTradingSimulation(bot, logger, tradingEngineModule, UTILITIES)

            let outputDatasets = bot.processNode.referenceParent.processOutput.outputDatasets
            let outputDatasetsMap = new Map()

            if (bot.FIRST_EXECUTION === true && bot.RESUME === false) {
                await initializeOutputs()
            } else {
                await readFiles()
            }

            await tradingSimulation.runSimulation(
                chart,
                outputDatasetsMap,
                writeFiles
            )

            tradingSimulation.finalize()
            return

            async function initializeOutputs() {
                if (bot.processingDailyFiles) {
                    await initializeDailyFiles()
                } else {
                    await initializeMarketFiles()
                }
            }

            async function initializeDailyFiles() {
                for (let i = 0; i < outputDatasets.length; i++) {
                    let outputDatasetNode = outputDatasets[i]
                    let dataset = outputDatasetNode.referenceParent

                    if (dataset.config.type === 'Daily Files') {
                        outputDatasetsMap.set(dataset.parentNode.config.codeName, [])
                    }
                }
            }

            async function initializeMarketFiles() {
                for (let i = 0; i < outputDatasets.length; i++) {
                    let outputDatasetNode = outputDatasets[i]
                    let dataset = outputDatasetNode.referenceParent

                    if (dataset.config.type === 'Market Files') {
                        outputDatasetsMap.set(dataset.parentNode.config.codeName, [])
                    }
                }
            }

            async function readFiles() {
                /* 
                This bot have an output of files that it generates. At every call to the bot, it needs to read the previously generated
                files in order to later append more information after the execution is over. Here in this function we are going to
                read those output files and get them ready for appending content during the simulation.
                */
                if (bot.processingDailyFiles) {
                    await readDailyFiles()
                } else {
                    await readMarketFiles()
                }
            }

            async function readMarketFiles() {
                for (let i = 0; i < outputDatasets.length; i++) {
                    let outputDatasetNode = outputDatasets[i]
                    let dataset = outputDatasetNode.referenceParent

                    if (dataset.config.type === 'Market Files') {

                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + dataset.parentNode.config.codeName + '/' + dataset.config.codeName + '/' + timeFrameLabel

                        await readOutputFile(fileName, filePath, dataset.parentNode.config.codeName)
                    }
                }
            }

            async function readDailyFiles() {
                for (let i = 0; i < outputDatasets.length; i++) {
                    let outputDatasetNode = outputDatasets[i]
                    let dataset = outputDatasetNode.referenceParent

                    if (dataset.config.type === 'Daily Files') {

                        let dateForPath = tradingProcessDate.getUTCFullYear() + '/' + utilities.pad(tradingProcessDate.getUTCMonth() + 1, 2) + '/' + utilities.pad(tradingProcessDate.getUTCDate(), 2);
                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + dataset.parentNode.config.codeName + '/' + dataset.config.codeName + '/' + timeFrameLabel + "/" + dateForPath

                        await readOutputFile(fileName, filePath, dataset.parentNode.config.codeName)
                    }
                }
            }

            async function readOutputFile(fileName, filePath, productName) {
                filePath += '/' + fileName

                let response = await fileStorage.asyncGetTextFile(filePath, true)

                if (response.err.message === 'File does not exist.') {
                    outputDatasetsMap.set(productName, [])
                    return
                }
                if (response.err.result !== global.DEFAULT_OK_RESPONSE.result) {
                    throw(response.err)
                }
                outputDatasetsMap.set(productName, JSON.parse(response.text))          
            }

            async function writeFiles() {
                /*
                The output of files which were appended with information during the simulation execution, now needs to be saved.
                */
                if (bot.processingDailyFiles) {
                    await writeDailyFiles()
                } else {
                    await writeMarketFiles()
                }
            }

            async function writeMarketFiles() {
                for (let i = 0; i < outputDatasets.length; i++) {
                    let outputDatasetNode = outputDatasets[i]
                    let dataset = outputDatasetNode.referenceParent

                    if (dataset.config.type === 'Market Files') {

                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + dataset.parentNode.config.codeName + '/' + dataset.config.codeName + '/' + timeFrameLabel

                        await writeOutputFile(fileName, filePath, dataset.parentNode.config.codeName)
                    }
                }
            }

            async function writeDailyFiles() {
                for (let i = 0; i < outputDatasets.length; i++) {
                    let outputDatasetNode = outputDatasets[i]
                    let dataset = outputDatasetNode.referenceParent

                    if (dataset.config.type === 'Daily Files') {

                        let dateForPath = tradingProcessDate.getUTCFullYear() + '/' + utilities.pad(tradingProcessDate.getUTCMonth() + 1, 2) + '/' + utilities.pad(tradingProcessDate.getUTCDate(), 2);
                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + dataset.parentNode.config.codeName + '/' + dataset.config.codeName + '/' + timeFrameLabel + "/" + dateForPath

                        await writeOutputFile(fileName, filePath, dataset.parentNode.config.codeName)
                    }
                }
            }

            async function writeOutputFile(fileName, filePath, productName) {
                filePath += '/' + fileName
                let fileContent = JSON.stringify(outputDatasetsMap.get(productName))

                let response = await fileStorage.asyncCreateTextFile(filePath, fileContent)

                if (response.err.result !== global.DEFAULT_OK_RESPONSE.result) {
                    throw(response.err)
                }
            }

        } catch (err) {
            logger.write(MODULE_NAME, '[ERROR] start -> err = ' + err.stack)
            throw(global.DEFAULT_FAIL_RESPONSE)
        }
    }
}

