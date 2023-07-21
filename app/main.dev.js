/* eslint global-require: 0, flowtype-errors/show-errors: 0 */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 *
 * @flow
 */

// IPC communication so background windows can talk to the renderer
import { ipcMain, app, BrowserWindow } from 'electron';

let mainWindow = null;
const path = require('path');
const ps = require('ps-node');
const Store = require('electron-store');
const { dialog } = require('electron');
const { PythonShell } = require('python-shell');

const store = new Store({
  defaults: {
    running_expts: [],
    first_visit: null
  }
});

const exptMap = {};
const isWin = process.platform === "win32";

// Get array of running experiments from exptMap. Store path and pid information only
function storeRunningExpts() {
  const runningExpts = Object.keys(exptMap).reduce((obj, x) => {
    const data = {
      path: x,
      pid: exptMap[x].childProcess.pid
    };
    obj.push(data);
    return obj;
  }, []);
  console.log('updating electron store');
  store.set('running_expts', runningExpts);
  console.log(store.get('running_expts'));
};

// Handle startup of a python shell instance to run the DPU
function startPythonExpt(exptDir, flag) {
  const scriptName = path.join(exptDir, 'eVOLVER.py');
  let pythonPath = path.join(store.get('dpu-env'), 'bin', 'python3');
  if (isWin) pythonPath = path.join(store.get('dpu-env'), 'Scripts', 'python');
  const options = {
    mode: 'text',
    pythonPath,
    args: flag
  };
  const pyShell = new PythonShell(scriptName, options);
  pyShell.on('message', (message) => console.log(message));
  exptMap[exptDir] = pyShell;
  const { pid } = pyShell.childProcess;
  pyShell.on('close', () => {
    console.log(`eVOLVER script with PID ${pid} closed.`);
    delete exptMap[exptDir];
    storeRunningExpts();
    mainWindow.webContents.send('running-expts',Object.keys(exptMap));
  });
  storeRunningExpts();
  mainWindow.webContents.send('running-expts',Object.keys(exptMap));
}

function startPythonCalibration(calibrationName, ip, fitType, fitName, params) {
  const scriptName = 'D:\\Git\\evolver-electron-cnpem\\calibration\\calibrate.py';
  console.log(scriptName);
  let pythonPath = '/usr/bin/python3';
  if (isWin) pythonPath = path.resolve('C:\\Users\\caio.santos\\AppData\\Local\\Programs\\Python\\Python311\\python.exe');
  const options = {
    mode: 'text',
    pythonPath,
    args: ['--always-yes',
            '--no-graph',
            '-a', ip,
            '-n', calibrationName,
            '-f', fitName,
            '-t', fitType,
            '-p', params]
  };
  const pyShell = new PythonShell(scriptName, options)

  pyShell.on('close', () => {
    console.log(`Calibration finished for ${calibrationName}`);
    mainWindow.webContents.send('calibration-finished', calibrationName);
  });
}

// Handle killing and relaunching experiments not connected to application
function killExpts(relaunch) {
  const runningExptsCopy = []
  for (let i = 0; i < store.get('running_expts').length; i++) {
    runningExptsCopy.push(store.get('running_expts')[i]);
  }
  store.set('running_expts', []);

  for (let i = 0; i < runningExptsCopy.length; i++) {
    ps.lookup({pid: runningExptsCopy[i].pid}, (err, resultList) => {
      if (err) throw new Error(err);
      if (resultList.length === 0) return;
      const exptProcess = resultList[0];

      for (let j = 0; j < exptProcess.arguments.length; j++) {
        if (exptProcess.arguments[j].includes('eVOLVER.py')) {
          ps.kill(exptProcess.pid, (er) => {
            if (er) {
              throw new Error(er);
            } else {
              console.log('Process %s has been killed!', exptProcess.pid);
            }
          });
          break;
        }
      }
    });
    if (relaunch) {
      console.log("Relaunching")
      startPythonExpt(runningExptsCopy[i].path, '--always-yes');
    }
  }
}

ipcMain.on('start-script', (arg) => {
    console.log(arg);
  startPythonExpt(arg, '--always-yes');
});

ipcMain.on('stop-script', (arg) => {
   exptMap[arg].send('stop-script');
   // Wait 3 seconds for the commands to be sent to stop the pumps before killing the process
   setTimeout(() => {
       exptMap[arg].childProcess.kill();
       delete exptMap[arg];
       storeRunningExpts();
       mainWindow.webContents.send('running-expts',Object.keys(exptMap));}, 3000);

});

ipcMain.on('start-calibration', (experimentName, ip, fitType, fitName, params) => {
  console.log('Sent calibration request');
  startPythonCalibration(experimentName, ip, fitType, fitName, params);
});

ipcMain.on('running-expts', () => {
  mainWindow.webContents.send('running-expts',Object.keys(exptMap));
});

ipcMain.on('active-ip', (arg) => {
  mainWindow.webContents.send('get-ip', arg);
});

ipcMain.on('kill-expts', (arg) => {
  killExpts(arg.relaunch);
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')();
  const p = path.join(__dirname, '..', 'app', 'node_modules');
  require('module').globalPaths.push(p);
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return Promise.all(
    extensions.map(name => installer.default(installer[name], forceDownload))
  ).catch(err => console.log(err));
};

function createWindow () {
  let position = [];
  if (mainWindow) {
    position = mainWindow.getPosition();
  } else {
    position = [0,0];
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1110,
    height: 666,
    backgroundColor: '#F7F7F7',
    minWidth: 1110,
    minHeight: 666,
    resizable: false,
    x: position[0]+20,
    y: position[1]+20,
    webPreferences: {
      nodeIntegration: true
    }
  });

  if (process.env.START_FULLSCREEN) mainWindow.setFullScreen(true);
  mainWindow.setMenu(null);
  mainWindow.loadFile(`${__dirname}/app.html`);

  // Uncomment to view dev tools on startup.
  // mainWindow.webContents.openDevTools();

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('close', (e) => {
    let choice;
    if (store.get('running_expts').length > 0) {
      const runningExpts = [];
      let message = '';
      let detail = '';

      for (let i = 0; i < store.get('running_expts').length; i++) {
        const temp = store.get('running_expts')[i].path;
        runningExpts.push(temp.split('/').pop())
      }
      message = 'The following running experiments have been detected and will persist if the application is closed. Would you still like to close the application?';
      detail = runningExpts.join('\n');

      choice = dialog.showMessageBox(this,
        {
          type: 'question',
          buttons: ['Yes', 'No'],
          title: 'Confirm',
          message,
          detail
      });
    };
    if(choice === 1) e.preventDefault();
  });
}

// Add event listeners
app.on('window-all-closed', () => {
  app.quit();
});

app.on('ready', async () => {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true'){
    await installExtensions();
  };
  store.set('first_visit', null);
  createWindow ();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  };
});

/*
 * setAboutPanelOptions() only available for macOS
 * app.setAboutPanelOptions({
 *   copyright: "Copyright © 2019 Fynch Biosciences Inc."
 * });
 */
