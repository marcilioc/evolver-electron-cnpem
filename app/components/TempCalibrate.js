// @flow
import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Redirect } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import LinearProgress from '@material-ui/core/LinearProgress';
import {FaPlay, FaArrowLeft, FaArrowRight, FaStop, FaCheck, FaPen } from 'react-icons/fa';
import CircularProgress from '@material-ui/core/CircularProgress';
import { ipcRenderer } from 'electron';
import TempCalGUI from './calibrationInputs/CalGUI';
import TempcalInput from './calibrationInputs/CalInputs';
import routes from '../constants/routes.json';
import TextKeyboard from './calibrationInputs/TextKeyboard';
import ModalAlert from './calibrationInputs/ModalAlert';
import VialArrayGraph from './graphing/VialArrayGraph';

// const http = require('https');
// const path = require('path');
// const fs = require('fs');
// const { ipcRenderer } = require('electron');
const { remote } = require('electron');
const Store = require('electron-store');

const { app } = remote;
const store = new Store(); // runningTempCal

const styles = {
  cardTempCalGUI: {
    width: 570,
    height: 800,
    backgroundColor: 'transparent',
    margin: '0px 0px 0px 500px',
    position: 'absolute',
  },
  progressBar: {
    flexGrow: 1,
    margin: '27px 0px 0px 0px',
    height: 8,
  },
  colorPrimary: {
    backgroundColor: 'white',
  },
  bar: {
    backgroundColor: '#f58245',
  },
  circleProgressColor: {
    color: '#f58245',
  },
  circle: {
    strokeWidth: '4px',
  }
};

function generateVialLabel (response, oldTempStream, roomTempAvg) {
  const tempStream = Array(16).fill('...');
  const deltaTempStream = Array(16).fill('...');
  const valueInputs = Array(16).fill('...')
  for (let i = 0; i < response.data.temp.length; i++) {
    //  To Not show value during RT reading
    // if (roomTempAvg.length !== 0){
      tempStream[i] = response.data.temp[i]
      deltaTempStream[i] = tempStream[i] - oldTempStream[i];
      if (isNaN(deltaTempStream[i])){
        deltaTempStream[i] = "0";
      }
      valueInputs[i] = `${tempStream[i]} (${deltaTempStream[i]<0 ? "" : "+"}${deltaTempStream[i]})`;
    // }
  }

  return [tempStream, valueInputs]
}

function calculateVialProgress (currentTemp, previousLockedTemp, targetTemp){
  const percentCompleted = [];
  for (let i = 0; i < currentTemp.length; i++) {
    percentCompleted[i] = Math.round(5 + (95 *Math.abs(((currentTemp[i] - previousLockedTemp[i])/(targetTemp[i] - previousLockedTemp[i])))));
  }
  return percentCompleted;
}


class TempCal extends React.Component {
  constructor(props) {
    super(props);
    this.keyboard = React.createRef();
    this.state = {
      currentStep: 1,
      disableForward: false,
      disableBackward: true,
      progressCompleted: 0,
      vialOpacities: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      enteredValues: Array(16).fill(''),
      generalOpacity: Array(16).fill(1),
      tempInputsFloat: [],
      readProgress: 0,
      vialProgress: Array(16).fill(0),
      initialZipped: [],
      inputsEntered: true,
      vialLabels: ['S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12','S13','S14','S15','S16'],
      vialData: [],
      currentPowerLevel: [4095,4095,4095,4095,4095,4095,4095,4095,4095,4095,4095,4095,4095,4095,4095,4095],
      tempRawDelta: 500,
      timesRead: 3,
      valueInputs: [],
      tempStream: [],
      deltaTempRange: [0, 1000], // Slope around 0.02 C per a.u.
      deltaTempSteps: 3,
      equilibrateState: true,
      roomTempAvg: [],
      buttonAdvanceText: '',
      buttonBackText: '',
      buttonMeasureText: 'RT',
      slopeEstimate: .02,
      previousLockedTemp: [],
      experimentName:'',
      readsFinished: 0,
      alertOpen: false,
      alertQuestion: 'Running calibration...',
      alertAnswers: ['Retry', 'Exit'],
      exiting: false,
      resumeOpen: false,
      resumeQuestion: 'Start new calibration or resume?',
      resumeAnswers: ['New', 'Resume'],
      keyboardPrompt: "Enter File Name or press ESC to autogenerate.",
      displayGras: false,
      displayCalibration: true,
      calibration: null,
    };

    // if (!fs.existsSync(path.join(app.getPath('userData'), 'calibration'))) {
    //     fs.mkdirSync(path.join(app.getPath('userData'), 'calibration'));
    //     const calibrationsFile = fs.createWriteStream(path.join(app.getPath('userData'), 'calibration', 'calibrate.py'));
    //     const calibrationScriptRequest = http.get("https://raw.githubusercontent.com/FYNCH-BIO/dpu/rc/calibration/calibrate.py", (response) => {response.pipe(calibrationsFile)});
    // }

    ipcRenderer.on('calibration-finished', (event, calibrationName) => {this.props.socket.emit('getcalibration', {name: calibrationName})});
    // this.props.socket.on('calibrationfinished', (e, calibrationName) => {
    //   console.log('Calibration finished');
    //   this.props.socket.emit('getcalibration', { name: calibrationName });
    //   console.log('Calibration configs received');
    // });

    this.props.socket.on('calibration', (response) => {
      this.setState({
        displayGraphs: true,
        displayCalibration: true,
        alertOpen: false,
        calibration: response
      });
    });

    this.props.socket.on('broadcast', (response) => {
      console.log('broadcast received');
      const newVialData = this.state.vialData;
      const returnedTemps = generateVialLabel(response, this.state.tempStream, this.state.roomTempAvg);
      const tempStream = returnedTemps[0];
      const valueInputs = returnedTemps[1];

      let percentVialProgress = [];
      if (this.state.currentStep > 1) {
        percentVialProgress = calculateVialProgress(tempStream, this.state.previousLockedTemp, this.state.currentPowerLevel);
      }

      this.setState({
        tempStream,
        valueInputs,
        vialProgress: percentVialProgress
      });

      // If stop was pressed or user still moving vials around, don't want to continue
      if (this.state.readProgress === 0) return;
      this.progress();

      for (let i = 0; i < response.data.temp.length; i++) {
        if (newVialData[newVialData.length - 1].temp.length <= i) {
          newVialData[newVialData.length - 1].temp.push([]);
        }
        newVialData[newVialData.length - 1].temp[i].push(parseInt(response.data.temp[i], 10));
      }
      this.setState(
        {
          tempStream,
          valueInputs,
          vialData: newVialData,
          equilibrateState: true
        },
        // Runs when collected enough measurements
        () => {
          const tempArray = this.state.vialData[newVialData.length - 1].temp;
          if (tempArray[0].length === this.state.timesRead) {
            const { roomTempAvg } = this.state;
            if (this.state.currentStep === 1) {
              for (let i = 0; i < tempArray.length; i++) {
                const average = (array) => array.reduce((a, b) => a + b) / array.length;
                roomTempAvg[i] = Math.round(average(tempArray[i]));
              }
            }
            this.handleUnlockBtns();
            console.log(this.state.vialData);
            const readsFinished = this.state.vialData.length;
            this.setState(
              {
                progressCompleted: (100 * (this.state.vialData.length / this.state.deltaTempSteps)),
                readsFinished,
                readProgress: 0,
                roomTempAvg,
                vialProgress: Array(16).fill(0)
              },
              () => store.set('runningTempCal', this.state)
            );
          }
	      }
      );
    });

    this.props.socket.on('calibrationrawcallback', (response) => {
      if (response === 'success'){
        store.delete('runningTempCal');
        // const calibrationData = {
        //   experimentName: this.state.experimentName,
        //   hostname: this.props.io.opts.hostname,
        //   fit: 'linear',
        //   fitName: this.state.experimentName,
        //   params: 'temp'
        // };
        console.log('Started calibration');
        ipcRenderer.send('start-calibration', this.state.experimentName, '127.0.0.1', 'linear', this.state.experimentName, 'temp');
        // this.props.socket.emit('startcalibration', calibrationData);
      }
    });
  }

  componentDidMount() {
    this.props.logger.info('Routed to Temperature Calibration Page.');
    if (store.has('runningTempCal')){
      this.setState({ resumeOpen: true });
    } else {
      this.keyboard.current.onOpenModal();
    }

    const deltaTempSetting = (this.state.deltaTempRange[1] - this.state.deltaTempRange[0])/(this.state.deltaTempSteps-1);
    const buttonAdvanceText = `+${Math.round(deltaTempSetting * this.state.slopeEstimate)}\u00b0C`;
    const buttonBackText = `-${Math.round(deltaTempSetting * this.state.slopeEstimate)}\u00b0C`;
    this.setState({
      vialOpacities: Array(16).fill(0),
      generalOpacity: Array(16).fill(1),
      valueInputs: Array(16).fill('...'),
      buttonAdvanceText,
      buttonBackText,
    });
  };

  componentWillUnmount() {
    this.props.socket.removeAllListeners('broadcast');
    this.props.socket.removeAllListeners('calibrationrawcallback');
    this.setState({readProgress: 0});
  }

  startRead = () => {
    const evolverValue = Array(16).fill("NaN");

    for (let i = 0; i < this.state.currentPowerLevel.length; i++) {
      evolverValue[i] = this.state.currentPowerLevel[i];
    }

    this.props.socket.emit("command", {param: "temp", value: evolverValue, immediate: true});
    if (this.state.equilibrateState) {
      this.handleLockBtns();

      let percentVialProgress = [];
      if (this.state.currentStep > 1) {
        percentVialProgress = calculateVialProgress(this.state.tempStream, this.state.tempStream, this.state.currentPowerLevel);
      }
      this.setState({
        equilibrateState: false,
        inputsEntered: false,
        previousLockedTemp: this.state.tempStream,
        vialProgress: percentVialProgress
      });
    } else {
      this.setState({readProgress: this.state.readProgress + .01, inputsEntered: true});
      const newVialData = this.state.vialData;

      // remove existing data for particular layout
      for (let i = 0; i < newVialData.length; i++) {
        if (this.state.currentStep === this.state.vialData[i].step) {
          newVialData.splice(i, 1);
          break;
        }
      }
      newVialData.push({
        temp:[],
        step: this.state.currentStep,
        powerLevel:this.state.currentPowerLevel,
        enteredValues:this.state.enteredValues,
      });
      this.setState({vialData:newVialData});
      this.props.socket.emit('data', {
        config:
        {
          od:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
          temp:['NaN','NaN','NaN','NaN','NaN','NaN','NaN','NaN','NaN','NaN','NaN','NaN','NaN','NaN','NaN','NaN']
        }
      });
    }
  }

  stopRead = () => {
    this.setState({readProgress: 0, equilibrateState: true})
    this.handleUnlockBtns();
  }

  progress = () => {
     let { readProgress } = this.state;
     readProgress += (100/this.state.timesRead);
     this.setState({readProgress});
   };

  handleBack = () => {
    let disableForward;
    let disableBackward;
    const currentStep = this.state.currentStep - 1;
    const deltaTempSetting = (currentStep - 1) * (this.state.deltaTempRange[1] - this.state.deltaTempRange[0])/(this.state.deltaTempSteps-1);
    const newTempSet = this.state.roomTempAvg.map(a => a - deltaTempSetting);
    let buttonMeasureText = '';
    if (currentStep - 1 === 0){
      buttonMeasureText = 'RT';
    }
    else{
      buttonMeasureText = `RT + ${Math.round(deltaTempSetting * this.state.slopeEstimate)}\u00b0C`;
    }

    if (this.state.currentStep === this.state.deltaTempSteps){
      disableForward = false;
    }
    if (this.state.currentStep === 2){
      disableBackward = true;
    }
    this.handleRecordedData(currentStep);
    this.setState({
      disableForward,
      disableBackward,
      currentStep,
      currentPowerLevel: newTempSet,
      buttonMeasureText
    });
  };

  handleAdvance = () => {
    let disableForward;
    let disableBackward;
    const currentStep = this.state.currentStep + 1;
    const deltaTempSetting = (currentStep - 1) * (this.state.deltaTempRange[1] - this.state.deltaTempRange[0])/(this.state.deltaTempSteps-1);
    const newTempSet = this.state.roomTempAvg.map(a => a - deltaTempSetting);
    let buttonMeasureText = '';
    if (currentStep - 1 === 0){
      buttonMeasureText = 'RT'
    }
    else{
      buttonMeasureText = `RT + ${Math.round(deltaTempSetting * this.state.slopeEstimate)}\u00b0C`;
    }

    if (this.state.currentStep === 1){
     disableBackward = false;
    }
    if (this.state.currentStep === (this.state.deltaTempSteps - 1)){
     disableForward = true;
    }
    this.handleRecordedData(currentStep);
    this.setState({
     disableForward,
     disableBackward,
     currentStep,
     currentPowerLevel: newTempSet,
     buttonMeasureText
     });
  };

  handleLockBtns = () => {
    const disableForward = true;
    const disableBackward = true;

    this.setState({
      disableForward,
      disableBackward,
      });
  };

  handleUnlockBtns = () => {
    let disableForward = false;
    let disableBackward = false;

    if (this.state.currentStep === 1){
      disableBackward = true;
      disableForward = false;
    }
    if (this.state.currentStep === (this.state.deltaTempSteps)){
      disableBackward = false;
      disableForward = true;
    }
    this.setState({
      disableForward,
      disableBackward,
      });
  };

  handleRecordedData = (currentStep) => {
    let displayedData = Array(16).fill('');
    const { vialData } = this.state;
    for (let i = 0; i < vialData.length; i++) {
        if (currentStep === this.state.vialData[i].step) {
            displayedData = this.state.vialData[i].enteredValues;
            break;
        }
    }
    this.setState({enteredValues: displayedData})
  }

  handleTempInput = (tempValues) => {
    this.setState({enteredValues: tempValues});
  }

  handleKeyboardInput = (input) => {
    let exptName;
    if (input === ''){
      const exptDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
      exptName = `Temp-${exptDate}`;
    } else {
      exptName = input;
    }
    this.setState({experimentName: exptName});
  }

  handleFinishExpt = () => {
    this.setState({alertOpen: true})
    const d = new Date();
    const currentTime = d.getTime();
    const enteredValuesStructured = [];
    const vialDataStructured = [];

    // TODO: Change data structure so that we don't have to do this transformation. Would require other code restructure
    // Data should be saved vial -> step -> data format, not step -> vial -> data as it is here.
    for(let i = 0; i < this.state.vialData.length; i++) {
      for(let j = 0; j < this.state.vialData[i].enteredValues.length; j++) {
        if(!enteredValuesStructured[j]) {
          enteredValuesStructured.push([]);
          vialDataStructured.push(new Array(3).fill([]));
        }
        enteredValuesStructured[j].push(parseFloat(this.state.vialData[i].enteredValues[j]));
        vialDataStructured[j][i] = this.state.vialData[i].temp[j];
      }
    }
    const saveData = {
      name: this.state.experimentName,
      calibrationType: "temperature",
      timeCollected: currentTime,
      measuredData: enteredValuesStructured,
      fits: [], raw: [{param: 'temp', vialData: vialDataStructured}]
    }
    this.props.socket.emit('setrawcalibration', saveData);
    console.log('raw sent');
  }

  handleKeyboardModal = () => {
    this.keyboard.current.onOpenModal();
  }

  onAlertAnswer = (answer) => {
    if (answer === 'Retry'){
      this.handleFinishExpt();
    }
    if (answer === 'Exit'){
      store.delete('runningTempCal');
      this.setState({exiting: true});
    }
  }

  onResumeAnswer = (answer) => {
    if (answer === 'New'){
      this.keyboard.current.onOpenModal();
      store.delete('runningTempCal');
    }
    if (answer === 'Resume'){
      const previousState = store.get('runningTempCal');
      this.setState(previousState);
    }
    this.setState({resumeOpen:false})
  }

  handleGraph = () => {
    this.setState({displayGraphs: !this.state.displayGraphs});
  }

  render() {
    const { classes, theme } = this.props;
    const { currentStep } = this.state;

    let measureButton;
    let statusText;

    if ((this.state.vialData.length === 0) && (this.state.equilibrateState)) {
      statusText = <p className="statusText">
        Load vessels w/ 15 mL of room temp water.
      </p>
    }
    else if ((this.state.vialData.length === 0) && (!this.state.equilibrateState)) {
      statusText = <p className="statusText">
        Heaters turned off. Let equilibrate, then enter values.
      </p>
    }
    else if ((this.state.vialData.length !== 0) && (this.state.equilibrateState)) {
      statusText = <p className="statusText">
        {this.state.readsFinished}/{this.state.deltaTempSteps} Measurements Made
      </p>
    }
    else if ((this.state.vialData.length !== 0) && (!this.state.equilibrateState)) {
      statusText = <p className="statusText">
        Temperature set! Let equilibrate, then enter values.
      </p>
    }

    if (this.state.readProgress === 0) {
      measureButton =
      <button
        type="button"
        className="tempMeasureBtn"
        onClick = {this.startRead}>
        {this.state.buttonMeasureText} <FaPlay size={13}/>
      </button>;
      for (let i = 0; i < this.state.vialData.length; i++) {
        if ((this.state.currentStep === this.state.vialData[i].step) && (typeof(this.state.vialData[i].temp[0]) !== "undefined")) {
          if (this.state.vialData[i].temp[0].length === this.state.timesRead) {
            measureButton =
            <button
              type="button"
              className="tempMeasureBtn"
              onClick = {this.startRead}>
                {this.state.buttonMeasureText} <FaCheck size={13}/>
            </button>;
            break;
          }
        }
      }
    } else {
      measureButton =
      <button
        type="button"
        className="tempMeasureBtn"
        onClick= {this.stopRead}>
        <CircularProgress
          classes={{
            colorPrimary: classes.circleProgressColor,
            circle: classes.circle
            }}
          variant="static"
          value={this.state.readProgress}
          color="primary"
          size= {35}
        />
        <FaStop size={18} className = "readStopBtn"/>
      </button>;
      statusText = <p className="statusText">Collecting raw values from eVOLVER...</p>;
    }

    let btnRight;
    if (true && (this.state.currentStep === this.state.deltaTempSteps)) {
    // if ((this.state.progressCompleted >= 100) && (this.state.currentStep === this.state.deltaTempSteps)){
      btnRight =
        <button
          type="button"
          className="tempAdvanceBtn"
          onClick={this.handleFinishExpt}>
            <FaPen />
        </button>
    } else {
      btnRight = <button
        type="button"
        className="tempAdvanceBtn"
        disabled={this.state.disableForward}
        onClick={this.handleAdvance}>
        {this.state.buttonAdvanceText} <FaArrowRight size={13} />
      </button>
    }

    let progressButtons;
    if ((this.state.vialData.length === 0) && (this.state.equilibrateState)) {
      progressButtons = <div className="row">
        <button
          type="button"
          className="stepOneBtn"
          onClick={this.startRead}>
            Start Temperature Calibration <FaPlay size={17} />
        </button>
      </div>;
    } else {
      progressButtons = <div>
        <div className="row" style={{position: 'absolute'}}>
          <button
            type="button"
            className="tempBackBtn"
            disabled={this.state.disableBackward}
            onClick={this.handleBack}>
              {this.state.buttonBackText} <FaArrowLeft size={13} />
          </button>
          {measureButton}
          {btnRight}
        </div>
        <button type="button" className="odViewGraphBtn" onClick={this.handleGraph}>VIEW COLLECTED DATA</button>
      </div>
    }

    if (this.state.exiting) {
      return <Redirect push to={{pathname:routes.CALMENU, socket:this.props.socket, logger:this.props.logger}} />;
    }

    let graphs;
    let calInputs;
    let tempCalTitles = <div />;
    let linearProgress;
    let backArrow = <Link
      className="backHomeBtn"
      id="experiments"
      to={{pathname:routes.CALMENU, socket:this.props.socket , logger:this.props.logger}}>
        <FaArrowLeft/>
    </Link>;
    const calGraphic = <Card className={classes.cardTempCalGUI}>
      <TempCalGUI
        vialOpacities = {this.state.vialOpacities}
        displayGraphs = {this.state.displayGraphs}
        generalOpacity = {this.state.generalOpacity}
        valueInputs = {this.state.valueInputs}
        initialZipped = {this.state.initialZipped}
        readProgress = {this.state.vialProgress}
        vialLabels = {this.state.vialLabels}/>
      {linearProgress}
    </Card>

    if (this.state.displayGraphs) {
      linearProgress = <div />;
      graphs = <VialArrayGraph
        parameter = {this.state.parameter}
        exptDir = 'na'
        activePlot = 'ALL'
        ymax = {55}
        timePlotted = {this.state.timePlotted}
        downsample = {this.state.downsample}
        xaxisName = 'ADC VALUE'
        yaxisName = 'TEMPERATURE (C)'
        displayCalibration = {this.state.displayCalibration}
        dataType = {{type:'calibration', param: 'temp'}}
        passedData = {{
          vialData: this.state.vialData,
          enteredValuesFloat: this.state.enteredValues,
          calibration: this.state.calibration
      }}/>;
      calInputs = <div />;
      progressButtons = <div>
        <button
          type="button"
          className="odViewGraphBtnBack"
          onClick={this.handleGraph}>
            BACK
        </button>
      </div>;
      backArrow = <button
        type="button"
        className="backHomeBtn"
        style={{zIndex: '10', position: 'absolute', top: '-2px', left: '-35px'}}
        id="experiments"
        onClick={this.handleGraph}>
          <FaArrowLeft/>
      </button>
    } else {
      graphs = <div />;
      calInputs = <TempcalInput
        onChangeValue={this.handleTempInput}
        onInputsEntered = {this.state.inputsEntered}
        enteredValues = {this.state.enteredValues}/>;
      tempCalTitles = <button
        type="button"
        className="odCalTitles"
        onClick={this.handleKeyboardModal}>
          <h4 style={{fontWeight: 'bold', fontStyle: 'italic'}}>{this.state.experimentName}</h4>
      </button>;
      linearProgress = <div>
        <LinearProgress
          classes={{
            root: classes.progressBar,
            colorPrimary: classes.colorPrimary,
            bar: classes.bar,
          }}
          variant="determinate"
          value={this.state.progressCompleted}
        />
        {statusText}
      </div>;
    }
    return (
      <div>
        {backArrow}
        {calGraphic}
        {calInputs}
        {graphs}
        {progressButtons}
        {progressButtons}
        {tempCalTitles}

        <TextKeyboard
          ref={this.keyboard}
          onKeyboardInput={this.handleKeyboardInput}
          onFinishedExpt={this.handleFinishExpt}
          keyboardPrompt={this.state.keyboardPrompt}/>
        <ModalAlert
          alertOpen= {this.state.alertOpen}
          alertQuestion = {this.state.alertQuestion}
          alertAnswers = {this.state.alertAnswers}
          onAlertAnswer = {this.onAlertAnswer}/>
        <ModalAlert
          alertOpen= {this.state.resumeOpen}
          alertQuestion = {this.state.resumeQuestion}
          alertAnswers = {this.state.resumeAnswers}
          onAlertAnswer = {this.onResumeAnswer}/>
      </div>
    );
  }
}

export default withStyles(styles)(TempCal);
