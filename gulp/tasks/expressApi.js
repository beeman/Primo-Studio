const express = require('../../node_modules/express');
const httpProxy= require('http-proxy');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const storage = require('node-persist');
const npmi= require('npmi');
const buildCustomJs= require('./buildCustomJs');
const buildCustomCss= require('./buildCustomCss');
const customJs= require('./buildCustomJs').customJs;
const appCss= require('./build-scss').appCss;
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'))
const rimrafAsync = Promise.promisify(require('rimraf'));
const configG = require('../config');
const utils= require('./utils/utils');
const gulp = require('gulp');
const rename= require('gulp-rename');
const zip = require('gulp-zip');
const fstream = require('fstream');
const streamifier = require('streamifier');
const unzip = require('unzipper');
const streamToPromise = require('./streamToPromise');
const ncp = require('ncp').ncp;
const dirTree = require('directory-tree');
const customCss= require('./buildCustomCss').customCss;
const path = require('path');
const primoProxy = require('../primoProxy');
const _url = require("url");
const http = require('http');
const https = require('https');
const extractor = require('font-blast/lib/glyph-extractor');
const svg2js = require('svgo/lib/svgo/svg2js');
const svg2jsAsync = Promise.promisify(svg2js);
const js2svg = require('svgo/lib/svgo/js2svg');


module.exports = router;


let proxy = httpProxy.createProxyServer({changeOrigin: true});
proxy.on('error', function (err, req, res) {
    utils.sendErrorResponse(res, err);
});

router.post('/feature', function (req, res) {
    let cookies = utils.parseCookies(req);
    let urlForProxy = cookies['urlForProxy'];
    if(!process.cwd().includes("Primo-Studio")) {
        process.chdir("Primo-Studio");
    }
    let userId= utils.getUserId(req);

    storage.getItem(userId).then((userManifest)=>{
        let npmId= req.body.data.id;
        let npmVersion= req.body.data.version;
        let hookName= req.body.data.hook;
        let featureConfig = req.body.data.featureConfig;
        console.log('installing add-on: ' + npmId + ' version: ' + npmVersion + ' on hook: ' + hookName);
        npmi({path: 'primo-explore/custom/' + userId, name: npmId, version: npmVersion, forceInstall: true}, (err, result)=>{
            if (err){
                console.log('failed to install feature:');
                utils.sendErrorResponse(res, err);
            }
            else{
                let hookFeatureList= userManifest[hookName]? userManifest[hookName] : [];
                hookFeatureList.push(npmId);
                let promiseArr= [];
                console.log('features config: ' + featureConfig);
                if (featureConfig){
                    promiseArr.push(buildCustomJs.buildFeatureConfigJsFile(utils.getUserCustomDir(userId), npmId, featureConfig));
                }
                promiseArr.push(buildCustomJs.buildCustomHookJsFile(utils.getUserCustomDir(userId), hookName, hookFeatureList));
                Promise.all(promiseArr).then(()=>{
                    utils.wrapFilesWithAutoGeneratedHeader(['primo-explore/custom/' + userId + '/node_modules/' + npmId +'/**/*.js']).then(()=>{
                        let appCssPromise = appCss(userId, urlForProxy);
                        let buildCustomJsPromise = buildCustomJs.customJs(userId).then(()=>{
                            userManifest[hookName] = hookFeatureList;
                            storage.setItem(userId, userManifest);
                        }, (err)=>{
                            console.log('failed to build custom js: ' + err);
                        });
                        Promise.all([appCssPromise, buildCustomJsPromise]).then(()=>{
                            let response = {status: '200'};
                            res.send(response);
                        }, (err)=>{
                            utils.sendErrorResponse(res, err);
                        });
                    });
                }, (err)=>{
                    console.log('failed to build custom hook js file');
                    utils.sendErrorResponse(res, err);
                });
            }
        });
    });
});

router.get('/remove_feature', function (req, res) {
    let cookies = utils.parseCookies(req);
    let urlForProxy = cookies['urlForProxy'];
    let userId= utils.getUserId(req);
    storage.getItem(userId).then((userManifest)=>{
        let npmId= req.query.id;
        let hookName= req.query.hook;
        let hookFeatureList= userManifest[hookName]? userManifest[hookName] : [];
        let index = hookFeatureList.indexOf(npmId);
        if (index === -1){
            //for some reason we tried to remove a feature which wasn't installed. No need to do anything...
            res.send({status: '200'});
        }
        else{
            hookFeatureList.splice(index, 1); // remove the feature from the installed feature list
            let rimrafPromise = rimrafAsync(utils.getUserCustomDir(userId) + '/node_modules/' + npmId); //delete feature from node_module
            let buildCustomHookJsFilePromise = buildCustomJs.buildCustomHookJsFile(utils.getUserCustomDir(userId), hookName, hookFeatureList);
            Promise.all([rimrafPromise, buildCustomHookJsFilePromise]).then(()=>{
                let appCssPromise = appCss(userId, urlForProxy);
                let buildCustomJsPromise = buildCustomJs.customJs(userId).then(()=>{
                    userManifest[hookName] = hookFeatureList;
                    storage.setItem(userId, userManifest);
                }, (err)=>{
                    console.log('failed to build custom js: ' + err);
                });
                Promise.all([appCssPromise, buildCustomJsPromise]).then(()=>{
                    let response = {status: '200'};
                    res.send(response);
                }, (err)=>{
                    utils.sendErrorResponse(res, err);
                });
            }, (err)=>{
                console.log('failed to build custom hook js file');
                utils.sendErrorResponse(res, err);
            });
        }
    });
});

router.get('/restart',function(req,res){
    if(!process.cwd().includes("Primo-Studio")) {
        process.chdir("Primo-Studio");
    }
    let userId= utils.getUserId(req);
    // configG.setView(req.query.dirName);
    configG.setView(userId);

    gulp.start('custom-js');
    // gulp.start('setup_watchers');
});

router.get('/colors', function(req, res){
    let userId= utils.getUserId(req);
    let baseDir = utils.getUserCustomDir(userId);
    fs.readFile(baseDir+'/colors.json.txt', (err, data)=>{
        if(err){
            utils.sendErrorResponse(res, err);
        }
        else{
            res.send(data);
        }
    });
});

router.post('/colors', function (req, res) {
    let cookies = utils.parseCookies(req);
    let urlForProxy = cookies['urlForProxy'];
    let colors = req.body.data.colors;
    let conf = req.body.data.conf;
    let userId= utils.getUserId(req);
    // configG.setView(conf.dirName);
    configG.setView(userId);
    let baseDir = utils.getUserCustomDir(userId);
    process.argv = ["","", "","--view="+conf.dirName];

    fs.writeFileAsync(baseDir+'/colors.json.txt', JSON.stringify(colors), { encoding: 'utf-8' })
        .then(() => {
            console.log('finished writing colors.json.txt');
            appCss(userId, urlForProxy).then(()=>{
                console.log('finished app css');
                let response = {status:'200'};
                res.send(response);
            }, (err)=>{
                console.log('failed app css');
                utils.sendErrorResponse(res, err);
            });
        });
});

router.get('/icons', function(req, res){
    let userId= utils.getUserId(req);
    let baseDir = utils.getUserCustomDir(userId);
    let customUiPath = baseDir+'/img/custom-ui.svg';
    new Promise((resolve) => {
        if (fs.existsSync(customUiPath)) {
            fs.readFile(customUiPath, (err, data) => {
                if (err) {
                    utils.sendErrorResponse(res, err);
                }
                else {
                    resolve(data.toString('utf-8'));
                }
            });
        } else {
            fs.writeFile(customUiPath,
                "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"24\" height=\"5000\" viewBox=\"0 0 24 5000\">\n</svg>\n",
                {flag: 'wx'},
                (err) => {
                    if (err) {
                        utils.sendErrorResponse(res, err);
                    } else {
                        resolve();
                    }
            });
        }
    }).then(data => {
        res.send(data);
    });
});

router.post('/icons', function (req, res) {
    let cookies = utils.parseCookies(req);
    let urlForProxy = cookies['urlForProxy'];
    let icons = req.body.data.icons;
    let conf = req.body.data.conf;
    let userId = utils.getUserId(req);
    let baseDir = utils.getUserCustomDir(userId);
    let customUiPath = baseDir+'/img/custom-ui.svg';

    fs.readFile(customUiPath, (err, data) => {
        if (err) {
            console.log('failed reading custom-ui.svg');
            utils.sendErrorResponse(res, err);
        }

        svg2js(data, (doc => {
            let root = doc.content[0];
            let svgs = root.content || [];

            // Create list of Promise which first making the svg to json object
            let iconPromises = Object.keys(icons).map(icon => {
                return new Promise((resolve, reject) => {
                    svg2js(icons[icon].path, svgJs => {
                        if (svgJs.error) {
                            reject(svgJs.error)
                        } else {
                            resolve([svgJs, icons[icon]]);
                        }
                    })
                })
                // then bind the relevant icon object to the promise
                    .bind(icons[icon])
                    // in case of error -> throw an error to the client
                    .catch(err => {
                        utils.sendErrorResponse(res, err);
                    });
            });

            // split the promises to two arrays, one for the changing mission and one for the creating mission
            let idsInSvgFile = svgs.map(cont => cont.attrs.id.value);
            let needToChangePromises = iconPromises.filter((iconPromise) => {
                return idsInSvgFile.indexOf(iconPromise._boundTo.id) !== -1;
            });
            let needToCreatePromises = iconPromises.filter((iconPromise) => {
                return idsInSvgFile.indexOf(iconPromise._boundTo.id) === -1;
            });

            // changing the relevant json objects
            let afterChangedPromise = Promise.each(needToChangePromises, (arr) => {
                let toChangeJs = arr[0];
                let icon = arr[1];
                let i = idsInSvgFile.indexOf(icon.id);

                doc.content[0].content[i].content = toChangeJs.content;
            });

            // creating the relevant json objects
            let createPromises = needToCreatePromises.map((toCreatePromise) => {
                return toCreatePromise.then(arr => {
                    let toCreateJs = arr[0];
                    let icon = arr[1];

                    toCreateJs.elem = 'svg';
                    toCreateJs.local = 'svg';
                    if (!toCreateJs.attrs) {
                        toCreateJs.attrs = {};
                    }

                    toCreateJs.attrs.id = {name: 'id', value: icon.id, prefix:"", local: "id"};
                    toCreateJs.attrs.viewBox = {name: 'viewBox', value: '0 0 24 24', prefix:"", local: "viewBox"};

                    return toCreateJs
                });
            });

            // push the elements to the document
            let afterCreatedPromise = Promise.each(createPromises, toAddContent => {
                if (!doc.content[0].content) {
                    doc.content[0].content = [];
                }
                toAddContent.parentNode = root;
                doc.content[0].content.push(toAddContent);
            });

            Promise.all([afterCreatedPromise, afterChangedPromise]).then(() => {
                let toWrite = js2svg(doc);
                fs.writeFileSync(customUiPath, toWrite.data);

                let response = {status:'200'};
                res.send(response);
            });
        }));
    });
});

router.post('/optimize-svg', function (req, res) {
    extractor(req.body.data, undefined, characterSvg => {
        res.send(characterSvg)
    });
});

let imagesUpload= upload.fields([
    {name: 'library-logo', maxCount:1},
    {name: 'favicon', maxCount:1},
    {name: 'resource-icons' , maxCount:10},
    {name: 'custom-ui', maxCount:1}
]);
router.post('/images', imagesUpload, (req, res)=>{
    let userId= utils.getUserId(req);
    let baseDir = utils.getUserCustomDir(userId);
    let data = req.files;
    console.log(data);
    let fileWritePromises=[];
    for (let key in data){
        for (let fileObject of data[key]){
            let fileName='';
            if (key === 'resource-icons'){
                fileName = fileObject.originalname;
            }
            else{
                fileName= fileObject.fieldname + '.' + fileObject.originalname.split('.')[1];
            }
            let filePath= baseDir + '/img/' + fileName;
            console.log(filePath);
            fileWritePromises.push(
                fs.writeFileAsync(filePath, Buffer.from(fileObject.buffer))
            )
        }
    }
    Promise.all(fileWritePromises).then(()=>{
        let response = {status:'200'};
        res.send(response);
    })
});

router.delete('/images', (req, res)=>{
    let userId= utils.getUserId(req);
    let baseDir = utils.getUserCustomDir(userId);
    let imageDir = baseDir + '/img';
    let deleteImagesPromises = [];
    fs.readdir(imageDir, (err, files)=>{
        if (err) {
            console.log('failed deleting images from ' + userId);
            utils.sendErrorResponse(res, err);
        }
        for (const file of files) {
            deleteImagesPromises.push(
                fs.unlinkAsync(path.join(imageDir, file))
            );
        }
        Promise.all(deleteImagesPromises).then(()=> {
            let response = {status: '200'};
            res.send(response);
        }, (err)=>{
            console.log('failed deleting images from ' + userId);
            utils.sendErrorResponse(res, err);
        });
    });
});

router.get('/single_file', (req, res)=>{
    let userId= utils.getUserId(req);
    let userCustomDir= utils.getUserCustomDir(userId);
    let filePath = req.query.path.replace(/[\/\\]/g, path.sep);
    let readableStream = gulp.src([userCustomDir+filePath], {base: './primo-explore/custom'});
    let buffer;
    readableStream.on('data', (data)=>{
        buffer= data;
    });
    readableStream.on('end',()=>{
        res.type('html');
        res.end(buffer._contents, 'binary');
    });
});

router.get('/package', (req, res)=>{
    let userId= utils.getUserId(req);
    let vid= req.cookies['viewForProxy'];
    let ve = req.cookies['ve'];
    vid = 'true' === ve ? vid.replace(':', '-') : vid;
    let userCustomDir= utils.getUserCustomDir(userId);
    storage.getItem(userId).then((userManifest)=>{
        fs.writeFileSync(userCustomDir + '/features.json.txt', JSON.stringify(userManifest));
        let readableStream = gulp.src(['./primo-explore/custom/'+userId,'./primo-explore/custom/'+userId+'/html/**',
            userCustomDir+'/img/**',userCustomDir+'/css/custom1.css',
            userCustomDir+'/js/custom.js', userCustomDir + '/features.json.txt',
            userCustomDir + '/colors.json.txt', userCustomDir + '/.',
            userCustomDir + '/node_modules/**/*.js', userCustomDir + '/node_modules/**/*.css'], {base: './primo-explore/custom'})
            .pipe(rename((file)=>{
                file.basename= file.basename.replace(userId, vid);
                file.dirname = file.dirname.replace(userId, vid);
            }))
            .pipe(zip(vid+'.zip', {buffer: true}));
        let buffer;
        readableStream.on('data', (data)=>{
            buffer= data;
        });
        readableStream.on('end',()=>{
            res.type('zip');
            res.end(buffer._contents, 'binary');
        });
    });
});

let packageUpload= upload.fields([
    {name: 'package', maxCount:1}
]);
router.post('/package', packageUpload,  (req, res)=>{
    console.log('started package post!');
    let userId= utils.getUserId(req);
    let fileObject = req.files.package[0];
    let packagePath = './primo-explore/uploadedPackages/' + userId;
    let writeStream = fstream.Writer({
        path: packagePath,
        type: 'Directory'
    });
    let readStream = streamifier.createReadStream(Buffer.from(fileObject.buffer));
    let zipStream = readStream
        .pipe(unzip.Parse())
        .pipe(writeStream);
    streamToPromise(zipStream).then(()=>{
        console.log('unziped package');
        let directories = utils.getDirectories(packagePath);
        if (directories.length !== 1){
            utils.sendErrorResponse(res, 'malformed package structure');
            return console.error('malformed package');
        }
        let dirName= /[^\\|/]*$/.exec(directories[0])[0];
        fs.readFile(packagePath + '/' + dirName + '/features.json.txt', 'utf8', (err, data)=>{
            if (err){
                console.log('error reading file features.json.txt: ' + err);
            }
            let userManifest=data? JSON.parse(data) : {};
            console.log('user manifest read from features.json.txt: ' + JSON.stringify(userManifest));

            let cssHandlerPromise = new Promise((resolveCssHandlerPromise, rejectCssHandlerPromise) => {
                let customCssPath = packagePath + '/' + dirName + '/css/custom1.css';
                if (fs.existsSync(customCssPath)) {
                    fs.renameSync(customCssPath, packagePath + '/' + dirName + '/css/customUploadedPackage.css');
                    resolveCssHandlerPromise();
                } else {
                    resolveCssHandlerPromise();
                }
            });

            let javaScriptHandlerPromise = new Promise((resolveJavaScriptHandlerPromise, rejectJavaScriptHandlerPromise)=>{
                let customJsPath = packagePath + '/' + dirName + '/js/custom.js';
                if (fs.existsSync(customJsPath)) {
                    fs.renameSync(customJsPath, packagePath + '/' + dirName + '/js/customUploadedPackage.js');
                    fs.readFile(packagePath + '/' + dirName + '/js/customUploadedPackage.js', 'utf8', (err,data)=> {
                        data = utils.unwrapJs(data); //during concatenation we wrap code with function so we need to unwrap before we concatenate

                        //remove all code generated by custom.js.tmpl
                        data = data.replace(/\/\/Auto generated code by primo app store DO NOT DELETE!!! -START-[\S\s]*?\/\/Auto generated code by primo app store DO NOT DELETE!!! -END-/g, '');

                        //we rename components placed directly on hooks. We do this so that we can place several features on one hook without conflicts
                        let manuallyAddedComponentsManifest = {};
                        data = utils.fixManuallyAddedComponents(data ,manuallyAddedComponentsManifest);
                        console.log('manually added components: ' + JSON.stringify(manuallyAddedComponentsManifest));

                        let customModuleDefinitionLineRegex = /[^\n\r]*app[\s]*?=[\s]*?angular.module\([\S\s]*?\);?/;
                        let customModuleDefinitionLine = data.match(customModuleDefinitionLineRegex);
                        data = data.replace(customModuleDefinitionLineRegex, ''); //delete the module line from the js since we are moving it to custom.module.js
                        let customModuleFileWritePromise = new Promise((resolve, reject) => {
                            if (customModuleDefinitionLine) {
                                fs.writeFile(packagePath + '/' + dirName + '/js/custom.module.js', customModuleDefinitionLine[0], 'utf8', (err) => {
                                    if (err) {
                                        reject();
                                        return console.error('failed to create custom.module.js: ' + err);
                                    }
                                    else {
                                        resolve();
                                    }
                                })
                            }
                            else {
                                resolve();
                            }
                        });

                        userManifest = utils.combineObjectsWithArrayValues(userManifest, manuallyAddedComponentsManifest); //combine both manifests

                        let hookPromiseArr = [];
                        for (let hook in userManifest) {
                            let npmInstallPromiseArr = [];
                            let hookFeaturesList = userManifest[hook];
                            let manuallyAddedComponentsForHook = manuallyAddedComponentsManifest[hook] || [];
                            if (hookFeaturesList.length > 0) {
                                hookPromiseArr.push(new Promise((resolve, reject) => {

                                    Promise.all(npmInstallPromiseArr).then(() => {

                                        buildCustomJs.buildCustomHookJsFile(packagePath + '/' + dirName, hook, hookFeaturesList).then(() => {
                                            resolve();
                                        }, (err) => {
                                            reject(err);
                                            utils.sendErrorResponse(res, err);
                                            return console.error('failed to build hook js file for: ' + hook)
                                        });
                                    }, (err) => {
                                        reject(err);
                                        utils.sendErrorResponse(res, err);
                                        return console.error('failed to npm install feature for hook: ' + hook);
                                    });
                                }));
                            }
                        }

                        console.log('writing new data to customUploadedPackage.js');
                        fs.writeFile(packagePath + '/' + dirName + '/js/customUploadedPackage.js', data, 'utf8', (err) => {
                            if (err) {
                                return console.log(err);
                            }
                            Promise.all(hookPromiseArr.concat(customModuleFileWritePromise)).then(() => {
                                resolveJavaScriptHandlerPromise();
                            }, (err) => {
                                rejectJavaScriptHandlerPromise()
                            });
                        });
                    });
                }

                else{
                    resolveJavaScriptHandlerPromise();
                }
            });

            Promise.all([cssHandlerPromise, javaScriptHandlerPromise]).then(() => {
                new Promise((resolve, reject) => {
                    ncp(packagePath + '/' + dirName, utils.getUserCustomDir(userId), {filter: utils.uploadedPackageFileFilter}, function (err) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve();
                        }
                    });
                }).then(() => {
                    storage.setItem(userId, userManifest);
                    console.log('uploaded package successfully!');
                    let response = {status: '200'};
                    res.send(response);
                }, (err) => {
                    utils.sendErrorResponse(res, 'internal error');
                    return console.error('failed to copy uploaded package: ' + err.data);
                }).finally(() => {
                    rimrafAsync(packagePath); //delete uploaded package once copy is finished
                });
            }, (err) => {
                rimrafAsync(packagePath); //delete uploaded package
                utils.sendErrorResponse(res, 'internal error');
                return console.error('failed to upload package');
            });
        });
    });

});

router.get('/file-tree', function(req, res) {
    let userId = utils.getUserId(req);
    let baseDir = utils.getUserCustomDir(userId);
    let filename = path.resolve(baseDir).replace(/[\/\\]/g, path.sep);
    if (filename.indexOf(baseDir.replace(/\//g, path.sep)) === -1 && filename.indexOf(baseDir.replace(/\\/g, path.sep)) === -1) {
        utils.sendErrorResponse(res, new Error('File path is not available for you'));
        return;
    }
    let tree = dirTree(baseDir, {exclude: /package-lock.json/, extensions: /\.(js|css|ts|html|htm|svg)/});
    res.send(tree);
});

router.post('/code', function (req, res) {
    let userId= utils.getUserId(req);
    let baseDir = utils.getUserCustomDir(userId);
    let file_path = req.body.file_path.replace(/[\/\\]/g, path.sep);
    let filename = path.join(baseDir, file_path);
    if (filename.indexOf(baseDir.replace(/\//g, path.sep)) === -1 && filename.indexOf(baseDir.replace(/\\/g, path.sep)) === -1) {
        utils.sendErrorResponse(res, new Error('File path is not available for you'));
        return;
    }
    new Promise((resolve) => {
        fs.exists(filename, exists => {
            if (exists) {
                resolve();
            } else {
                if (!fs.existsSync(path.dirname(filename))) {
                    fs.mkdirSync(path.dirname(filename));
                }
                fs.writeFile(filename, "", {flag: 'wx'}, (err) => {
                    if (err) {
                        utils.sendErrorResponse(res, err);
                    } else {
                        resolve();
                    }
                });
            }
        });
    }).then(()=> {
        fs.readFile(baseDir + file_path, (err, data)=>{
            if(err){
                utils.sendErrorResponse(res, err);
            }
            else{
                res.send(Buffer.from(data).toString());
            }
        });
    });
});

router.put('/code', function (req, res) {
    let readOnlyRegex = /.*custom(?:1|\.module)?\.(?:css|js)/;
    let userId= utils.getUserId(req);
    let baseDir = utils.getUserCustomDir(userId);
    let promises = [];
    for (let code of req.body.data.code) {
        let file_path = code.file_path.replace(/[\/\\]/g, path.sep);;
        let data = code.data;
        let filename = path.join(baseDir, file_path);
        if (filename.indexOf(baseDir.replace(/\//g, path.sep)) === -1 && filename.indexOf(baseDir.replace(/\\/g, path.sep)) === -1) {
            utils.sendErrorResponse(res, new Error('File path is not available for you'));
            return;
        }
        if (readOnlyRegex.test(filename)) {
            continue;
        }
        promises.push(fs.writeFileAsync(baseDir + file_path, data));
    }
    promises.push(customCss(userId), customJs(userId));
    Promise.all(promises).then(() =>  {
        let response = {status:'200'};
        res.send(response);
    }, (err) => {
        utils.sendErrorResponse(res, err);
    });
});

router.get('/start', function (req, res) {
    if(!process.cwd().includes("Primo-Studio")) {
        process.chdir("Primo-Studio");
    }
    let confObj = {
        "view":req.query.view,
        "url": req.query.url
    };
    let userId= utils.getUserId(req);
    userId = userId && userId !== '' ? userId :  utils.createNewUserId();
    console.log('started with user ID: ' + userId);

    configG.setView(userId);

    //create a directory from MOCK
    let readStream = fs.createReadStream('templatePackage/VIEW_CODE' + (req.query.ve === 'true'? '_VE' : '') + '.zip');
    /*writeStream2 = fstream.Writer({
     path: path.resolve(__dirname, '../../primo-explore/custom/' + n),
     type: 'Directory'
     });*/
    let writeOptions = fstream.Writer({
        path: path.resolve(__dirname, '../../tmp'),
        type: 'Directory'
    });
    let p1 = rimrafAsync('../../tmp')
        .then(
            () => {
                let zipStream = readStream
                    .pipe(unzip.Extract(writeOptions));
                return streamToPromise(zipStream)
            });
    //let p2 = rimrafAsync("primo-explore-devenv/primo-explore/custom/" + n);
    Promise.join(p1).then(() => {
        return fs.rename("./tmp/VIEW_CODE", "primo-explore/custom/" + userId, ()=>{
            fs.rename("primo-explore/custom/" + userId + '/colors.json', "primo-explore/custom/" + userId + '/colors.json.txt', () => { //change colors.json file to colors.json.txt since BO doesn't accept .json files
                buildCustomJs.customJs(userId);
                buildCustomCss.customCss(userId);
            });
        });
    });

    storage.getItem(userId).then((userFeaturesManifest)=>{
        let userInstalledFeaturesList = [];
        if (!userFeaturesManifest){
            console.log('set new user features manifest');
            storage.setItem(userId, {});
        }
        else{
            console.log('found features manifest for existing user');
            userInstalledFeaturesList= utils.getUserInstalledFeaturesList(userFeaturesManifest);
        }

        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({status:'200',dirName:userId, installedFeatures: userInstalledFeaturesList}));
    });

});

router.get('/signed-params', (req, res) => {
    let directoryPath = './tests-params';
    let filename = utils.getUserTestsPath(req) + '.json';
    let params = {};
    if (fs.existsSync(path.join(directoryPath, filename))) {
        params = fs.readFileSync(path.join(directoryPath, filename));
    }

    res.status(200);
    res.send(params);
});

router.delete('/signed-params', (req, res) => {
    let directoryPath = './tests-params';
    let filename = utils.getUserTestsPath(req) + '.json';
    if (fs.existsSync(path.join(directoryPath, filename))) {
        fs.unlinkSync(path.join(directoryPath, filename));
    }

    res.sendStatus(200);
});

router.put('/tests-sign-up', (req, res) => {
    let params = {};
    let cookies = utils.parseCookies(req);

    params["baseUrl"] = cookies['urlForProxy'];
    params["vid"] = cookies['viewForProxy'];
    params["isVe"] = cookies['ve'];
    params["suites"] = req.body;

    let directoryPath = './tests-params';
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath);
    }
    let filename = utils.getUserTestsPath(req) + '.json';
    fs.writeFileSync(path.join(directoryPath, filename), JSON.stringify(params));

    res.sendStatus(200);
});

router.get('/test-params', (req, res) => {
    utils.trustedTravisIp(req).then(trusted => {
        if (trusted) {
            let readableStream = gulp.src(['./tests-params/*'])
                .pipe(rename((file) => {
                    file.basename = file.basename.replace('tess-params', 'params');
                    file.dirname = file.dirname.replace('tess-params', 'params');
                }))
                .pipe(zip('params.zip', {buffer: true}));
            let buffer;
            readableStream.on('data', (data) => {
                buffer = data;
            });
            readableStream.on('end', () => {
                res.type('zip');
                res.end(buffer._contents, 'binary');
            });
        } else {
            utils.sendErrorResponse(res, new Error('The request is not available from IP: ' + req.ip));
        }
    }, err => {
        utils.sendErrorResponse(res, err);
    });
});

router.post('/test-response', (req, res) => {
    utils.trustedTravisIp(req).then(trusted => {
        if (trusted) {
            let directoryPath = './tests-results';
            if (!fs.existsSync(directoryPath)) {
                fs.mkdirSync(directoryPath);
            }
            let filename = utils.getUserTestsPath(req) + '.json';
            fs.writeFileSync(path.join(directoryPath, filename), JSON.stringify(req.body));

            res.sendStatus(200);
        } else {
            utils.sendErrorResponse(res, new Error('The request is not available from IP: ' + req.ip));
        }
    }, err => {
        utils.sendErrorResponse(res, err);
    });
});

router.get('/test-results', (req, res) => {
    let directoryPath = './tests-results';
    let filename = utils.getUserTestsPath(req) + '.json';
    let resultsObj = {};
    if (fs.existsSync(path.join(directoryPath, filename))) {
        let results = fs.readFileSync(path.join(directoryPath, filename), "utf-8");
        let stat = fs.statSync(path.join(directoryPath, filename));
        resultsObj["results"] = JSON.parse(results);
        resultsObj["last-modified"] = stat.mtime;
    }

    res.status(200);
    res.send(resultsObj);
});

router.all('*',function(req, res, next){
    let appName = 'primo-explore';
    let cookies = utils.parseCookies(req);
    let urlForProxy = cookies['urlForProxy'];
    let viewForProxy = cookies['viewForProxy'];
    let ve = cookies['ve'];
    let confPath = (ve === 'true') ? '/primaws/rest/pub/configuration' : '/primo_library/libweb/webservices/rest/v1/configuration';
    let confAsJsPath = (ve === 'true') ? '/discovery/config_' : '/primo-explore/config_';
    let appPrefix = (ve === 'true') ? 'discovery' : 'primo-explore';
    let fixConfiguration = function (res, res1, isConfByFile) {
        let dirForProxy = utils.getUserId(req);
        let body = '';

        res1.setEncoding('utf8');

        res1.on("data", function (chunk) {
            body = body + chunk;
        });

        res1.on("end", function () {

            let vid = dirForProxy || configG.view() || '';
            let customizationProxy = primoProxy.getCustimazationObject(vid, appName, (ve === 'true'));

            if (isConfByFile) {
                res.end('');

            } else {
                try {
                    let newBodyObject = JSON.parse(body);

                    let useCentral = cookies['useCentral'] && cookies['useCentral'] === 'true';
                    if (useCentral) {
                        customizationProxy.centralJs = newBodyObject.customization.centralJs;
                        customizationProxy.centralCss = newBodyObject.customization.centralCss;
                        customizationProxy.centralSvg = newBodyObject.customization.centralSvg;
                    }

                    newBodyObject.customization = customizationProxy;
                    let newBody = JSON.stringify(newBodyObject);

                    res.body = newBody;

                    /*console.log('newBody: ' newBody);*/
                    res.end(newBody);
                } catch (e) {
                    res.end('');
                }
            }

        });
    };
    if (req.url.startsWith(confAsJsPath) || req.url.startsWith(confPath)) {
        let isConfByFile = false;
        if (req.url.startsWith(confAsJsPath)) {
            isConfByFile = true;
        }
        let proxyUrl = urlForProxy || configG.PROXY_SERVER;
        let base = proxyUrl.replace('http:\/\/', '').replace('https:\/\/', '');
        let method = proxyUrl.split('://')[0];
        let parts = base.split(':');
        let hostname = parts[0];
        let port = parts[1];


        let options = {
            hostname: hostname,
            port: port,
            path: req.url,
            method: 'GET',
            headers: {
                'X-From-ExL-API-Gateway': '1',
                'User-Agent': ''
            }
        };
        let requestObject = http;
        if (method === 'https') {
            requestObject = https;
        }
        let req2 = requestObject.request(options, (res1) => {
            fixConfiguration(res, res1, isConfByFile);
        });

        req2.on('error', (e) => {
            _next(req, res, urlForProxy, viewForProxy);
        });

        req2.write('');
        req2.end();

    }
    else {
        _next(req, res, urlForProxy, viewForProxy,appPrefix);
    }
});

function _next(req, res, targetUrl, vid, appPrefix){

    console.log('vid=' + vid);
    console.log('url=' + targetUrl);
    let path = _url.parse(req.url).pathname;


    let proxyUrl = targetUrl || configG.PROXY_SERVER;
    let fixedurl = proxyUrl+req.url;
    let protocol = proxyUrl.split(':')[0];
    let base = proxyUrl.replace('http:\/\/','').replace('https:\/\/','');
    let method = proxyUrl.split('://')[0];
    let parts = base.split(':');
    let hostname = parts[0];
    let port = parts[1];
    let userId = utils.getUserId(req);

    console.log('this is the current path: ' + path);
    if(path.indexOf('/'+appPrefix+'/custom/'+userId) > -1) {
        console.log('req url=' + _url.parse(req.url));
        let fixedPath = path.replace('/discovery/', '/primo-explore/');
        let filePath= process.cwd() + fixedPath;
        console.log(filePath);
        let filestream= fs.createReadStream(filePath);
        filestream.on('error', (err)=>{
            utils.sendErrorResponse(res, err);
        });
        filestream.pipe(res);
        return;
    }

    //fixes bug where bodyParser interferes with post requests in http proxy
    req.removeAllListeners('data');
    req.removeAllListeners('end');
    process.nextTick(function () {
        if(req.body) {
            if (path === '/primaws/suprimaLogin') {
                var postStr = "";
                for (var key in req.body) {
                    postStr = postStr + encodeURIComponent(key) + "=" + encodeURIComponent(req.body[key]) + "&";
                }
                postStr = postStr.substr(0, postStr.length - 1);
                req.headers['Content-Length'] = Buffer.byteLength(postStr);
                req.emit('data', postStr);
            } else {
                req.emit('data', JSON.stringify(req.body));
            }
        }
        req.emit('end');
    });
    proxy.web(req, res, { target: targetUrl });
}