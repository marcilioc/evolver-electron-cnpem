// @flow
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import {FaArrowLeft} from 'react-icons/fa';
import routes from '../constants/routes.json';
import data from './sample-data'
import VialSelector from './VialSelector';
import ButtonCards from './setupButtons/ButtonCards';
import SetupLog from './setupButtons/SetupLog';

const Store = require('electron-store');

const store = new Store();

export default class Setup extends Component<Props> {
  constructor(props) {
      super(props);
      this.child = React.createRef();
      this.state = {
            selectedItems: [],
            arduinoMessage: "",
            rawVialData: data,
            vialData: data,
            tempCalFiles: [],
            odCalFiles: [],
            pumpCalFiles: [],
            activeTempCal: 'Retreiving...',
            activeODCal: 'Retreiving...',
            activePumpCal: 'Retreiving...',
            tempCal: {},
            odCal: {},
            command: {},
            showRawTemp: false,
            showRawOD: false,
            strain: ["FL100", "FL100", "FL100", "FL100", "FL100", "FL100", "FL100", "FL100", "FL100", "FL100", "FL100", "FL100", "FL100", "FL100", "FL100", "FL100"]
        };
      this.control = Array.from(new Array(32).keys()).map(item => item**2);

      // Request calibration parameters from server
      this.props.socket.emit('getactivecal', {});
      this.props.socket.emit('getfitnames', {});

      // Receive data from eVOLVER
      this.props.socket.on('broadcast', (response) => {
        console.log('Broadcast received');
        this.handleRawData(this.handleIncoming(response.data), this.state.showRawOD, this.state.showRawTemp);
      });

      // Receive calibration parameters from server
      this.props.socket.on('fitnames', (response) => {
        const odCalFiles = [];
        const tempCalFiles = [];
        const pumpCalFiles = [];
        for (let i = 0; i < response.length; i++) {
            if (response[i].calibrationType === "od") {
              odCalFiles.push(response[i].name);
            }
            else if (response[i].calibrationType === "temperature") {
              tempCalFiles.push(response[i].name);
            }
            else if (response[i].calibrationType === "pump") {
              pumpCalFiles.push(response[i].name);
            }
        }
        this.setState({odCalFiles, tempCalFiles, pumpCalFiles});
      });

      this.props.socket.on('activecalibrations', (response) => {
        console.log(response[0].fits[0]);
        console.log(response[1].fits[0]);
        console.log(response[2].fits[0]);
        const activePumpCal = response[0].fits[0];
        const activeTempCal = response[1].fits[0];
        const activeODCal = response[2].fits[0];

        // Is there the need of sending more than one fit per time?
        // for (let i = 0; i < response.length; i++) {
        //   for (let j = 0; j < response[i].fits.length; j++) {
        //     if (response[i].fits[j].active) {
        //       if (response[i].calibrationType === 'od') {
        //         activeODCal = response[i].fits[j];
        //       }
        //       else if (response[i].calibrationType === 'temperature') {
        //         activeTempCal = response[i].fits[j];
        //       }
        //       else if (response[i].calibrationType === 'pump') {
        //         activePumpCal = response[i].fits[j];
        //       }
        //     }
        //   }
        // }
        this.setState({odCal: activeODCal, tempCal: activeTempCal, activeODCal: activeODCal.name, activeTempCal: activeTempCal.name, activePumpCal: activePumpCal.name});
        store.set('activeODCal', activeODCal.name);
        store.set('activeTempCal', activeTempCal.name);
        store.set('activePumpCal', activePumpCal.name);
      });
    }

  componentDidMount() {
    console.log(this.props.socket);
    this.props.logger.info('Routed to Setup Page.');
    let initialData = this.state.rawVialData;
    initialData = this.handleRawToCal(initialData);
    initialData = this.formatVialSelectStrings(initialData, 'od');
    initialData = this.formatVialSelectStrings(initialData, 'temp');
    this.setState({
      vialData: initialData,
        activeODCal: store.get('activeODCal'),
        activeTempCal: store.get('activeTempCal'),
        activePumpCal: store.get('activePumpCal')
      });
  };

  componentWillUnmount() {
    this.props.socket.removeAllListeners('activecalibrationod');
    this.props.socket.removeAllListeners('activecalibrationtemp');
    this.props.socket.removeAllListeners('calibrationod');
    this.props.socket.removeAllListeners('calibrationtemp');
    this.props.socket.removeAllListeners('odfittedfilenames');
    this.props.socket.removeAllListeners('tempfittedfilenames');
    this.props.socket.removeAllListeners('broadcast');
  }

  // Parse the broadcast response from eVOLVER
  handleIncoming = (response) => {
    const responseData = JSON.parse(JSON.stringify(response));
    const rawData = [ ...Array(16) ];
    for(let i = 0; i < this.state.vialData.length; i++) {
      rawData[i] = {};
      rawData[i].vial = this.state.vialData[i].vial;
      rawData[i].selected = this.state.vialData[i].selected;

      if (responseData.od_135) {
        rawData[i].od_135 = responseData.od_135[i];
      }
      if (responseData.od_90) {
        rawData[i].od_90 = responseData.od_90[i];
      }
      if (responseData.temp) {
        rawData[i].temp = responseData.temp[i];
      }
    }
    return rawData;
  }

  handleRawData = (rawData, showRawOD, showRawTemp) => {
    console.log(rawData)
    let newVialData = this.handleRawToCal(rawData, showRawOD, showRawTemp);
    if (!showRawOD && (this.state.odCal.length !== 0)){
      newVialData = this.formatVialSelectStrings(newVialData, 'od');
    }
    if (!showRawTemp && (this.state.tempCal.length !== 0)){
      newVialData = this.formatVialSelectStrings(newVialData, 'temp');
    }
    this.setState({vialData: newVialData, rawVialData: rawData});
  }

  formatVialSelectStrings = (vialData, parameter) => {
    const newData = JSON.parse(JSON.stringify(vialData));
    for(let i = 0; i < newData.length; i++) {
      if (parameter === 'od'){
        newData[i].od = `OD: ${newData[i].od}`;
      }
      if (parameter === 'temp'){
        newData[i].temp = `${newData[i].temp}\u00b0C`;
      }
    }
    return newData
  }

  handleRawToCal = (response, showRawOD, showRawTemp) => {
    const newVialData = JSON.parse(JSON.stringify(response));
    for(let i = 0; i < newVialData.length; i++) {
      try {
        if ((!showRawOD) && (this.state.odCal.length !== 0)) {
          if (this.state.odCal.type === 'sigmoid') {
            const sigmoidValue = parseInt(newVialData[i][this.state.odCal.params[0]], 10);
            const sigmoidCal = this.state.odCal.coefficients[i];

            newVialData[i].od = this.sigmoidRawToCal(sigmoidValue, sigmoidCal).toFixed(3);
          } else if (this.state.odCal.type === '3d') {
            const multiDimValue1 = parseInt(newVialData[i][this.state.odCal.params[0]], 10);
            const multiDimValue2 = parseInt(newVialData[i][this.state.odCal.params[1]], 10);
            const multiDimCal = this.state.odCal.coefficients[i];

            newVialData[i].od = this.multidimRawToCal(multiDimValue1, multiDimValue2, multiDimCal).toFixed(3);
          }
        } else if (this.state.odCal.length === 0) {
          newVialData[i].od = '--';
        } else {
          newVialData[i].od = newVialData[i][this.state.odCal.params[0]];
        }
      } catch(err) {
        console.log(err);
      }
      try {
        if ((!showRawTemp) && (this.state.tempCal.length !== 0)){
          const linearValue = newVialData[i].temp;
          const linearCal = this.state.tempCal.coefficients[i];

          newVialData[i].temp = this.linearRawToCal(linearValue, linearCal).toFixed(2);
        } else if (this.state.tempCal.length === 0) {
          newVialData[i].temp = '--'
        } else {
          newVialData[i].temp = newVialData[i].temp;
        }
      } catch(err) {
        console.log(err);
      }
    }
    return newVialData
  };

  getBinaryString = vials => {
      let binaryInteger = 0;
      for (let i = 0; i < vials.length; i++) {
          binaryInteger += this.control[vials[i]];
      }
      return binaryInteger.toString(2);
  };

  onSelectVials = (selectedVials) => {
    this.setState({selectedItems: selectedVials});
  };

  onSelectNewCal = (parameter, filenames) => {
    if (parameter === 'od'){
      this.props.socket.emit("setactivecal", {'calibration_names': filenames});
      this.setState({showRawOD: false});
      this.handleRawData(this.state.rawVialData, false, this.state.showRawTemp)
    }
    if (parameter === 'temp'){
      this.props.socket.emit("setactivecal", {'calibration_names': filenames});
      this.setState({showRawTemp: false});
      this.handleRawData(this.state.rawVialData, this.state.showRawOD, false)
    }
    if (parameter === 'pump') {
      this.props.socket.emit("setactivecal", {'calibration_names': filenames});
    }
    if (parameter === 'rawod'){
      this.setState({showRawOD: !this.state.showRawOD});
      this.handleRawData(this.state.rawVialData, !this.state.showRawOD, this.state.showRawTemp)
    }
    if (parameter === 'rawtemp'){
      this.setState({showRawTemp: !this.state.showRawTemp});
      this.handleRawData(this.state.rawVialData, this.state.showRawOD, !this.state.showRawTemp)
    }
  }

  onSubmitButton = (evolverComponent, value) => {
    const vials = this.state.selectedItems.map(item => item.props.vial);
    let evolverMessage = {};
    evolverMessage = Array(16).fill("NaN");
    if (evolverComponent === "pump") {
      evolverMessage = Array(48).fill("--");
      for (let i = 0; i < 48; i++) {
        if (value.in1) {
          evolverMessage[vials[i]] = value.time;
        }
        if (value.efflux) {
          evolverMessage[vials[i] + 16] = value.time;
        }
        if (value.in2) {
          evolverMessage[vials[i] + 32] = value.time;
        }
      }
    }
    else {
      for (let i = 0; i < vials.length; i++) {
        if (evolverComponent === "temp") {
          console.log(this.state.tempCal);
          evolverMessage[vials[i]] = this.linearCalToRaw(value, this.state.tempCal.coefficients[vials[i]]).toFixed(0);
        } else {
          evolverMessage[vials[i]] = value;
        }
      }
    }

    this.setState({arduinoMessage: `Set "${evolverComponent}" to ${value} Vials: ${vials}`});
    console.log({param: evolverComponent, value: evolverMessage, immediate: true})
    this.props.socket.emit("command", {param: evolverComponent, value: evolverMessage, immediate: true});
    this.setState({command: {param: evolverComponent, value: evolverMessage}});
  };

  sigmoidRawToCal = (value, cal) => (cal[2] - ((Math.log10((cal[1] - cal[0]) / (value - cal[0]) - 1)) / cal[3]));

  multidimRawToCal = (value1, value2, cal) => cal[0] + cal[1] * value1 + cal[2] * value2 + cal[3] * value1 * value1 + cal[4] * value1 * value2 + cal[5] * value2 * value2

  linearRawToCal = (value, cal) => (value * cal[0]) + cal[1];

  linearCalToRaw = (value, cal) => (value - cal[1])/cal[0];

  render() {
    return (
      <div>
        <div className="col-8.5 centered">
            <div className="row centered">
              <div className="buttons-dashboard ">
                <Link className="backCalibrateBtn" id="experiments" to={{pathname:routes.HOME, socket: this.props.socket, logger:this.props.logger}}><FaArrowLeft/></Link>
                <h3 className="dashboardTitles"> Experiment Setup Dashboard </h3>
                <ButtonCards
                  arduinoMessage={this.state.arduinoMessage}
                  onSubmitButton={this.onSubmitButton}
                  activeTempCal={this.state.activeTempCal}
                  activeODCal={this.state.activeODCal}
                  activePumpCal={this.state.activePumpCal}
                  tempCalFiles= {this.state.tempCalFiles}
                  odCalFiles={this.state.odCalFiles}
                  pumpCalFiles={this.state.pumpCalFiles}
                  showRawTemp= {this.state.showRawTemp}
                  showRawOD= {this.state.showRawOD}
                  onSelectNewCal = {this.onSelectNewCal}
                   />
              </div>
              <SetupLog
                socket={this.props.socket}
                ref={this.child}
                command={this.state.command}
                activeTempCal={this.state.activeTempCal}
                activeODCal={this.state.activeODCal}
                activePumpCal={this.state.activePumpCal}/>
              <div>
                <VialSelector
                  items={this.state.vialData}
                  vialSelectionFinish={this.onSelectVials}/>
              </div>
            </div>
        </div>
      </div>
    )
  }
}
