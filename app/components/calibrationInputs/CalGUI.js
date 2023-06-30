import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import VialItem from './VialItem';
import VialOutline from './VialOutline';

function zipValues(odState, vialOpacities, generalOpacity, valueInputs, vialLabels) {
  const vialOpacitiesNew = [];
  const generalOpacityNew = [];
  const valueInputsNew = [];
  const vialLabelsNew = [];

  let i;
  for (i = 0; i < odState.length; i++) {
    valueInputsNew[i] = valueInputs[odState[i]];
    vialOpacitiesNew[i] = vialOpacities[odState[i]];
    vialLabelsNew[i] = vialLabels[odState[i]];

    if (isNaN(valueInputsNew[i]) && (typeof valueInputsNew[i] !== 'string')) {
      generalOpacityNew[i] = 0;
    }
    else{
      generalOpacityNew[i] = generalOpacity[odState[i]];
    }
  }

  const zippedSamples = odState.map((x, i) => [x, vialOpacitiesNew[i], generalOpacityNew[i], valueInputsNew[i], vialLabelsNew[i]]);
  return zippedSamples;
}
// generalOpacity = newState.map((x, i) => x[2])

function unzipValues(zippedArray) {
  const odState = zippedArray.map((x, i) => x[0])
  const vialOpacities = zippedArray.map((x, i) => x[1])
  const generalOpacity = zippedArray.map((x, i) => x[2])
  const valueInputs = zippedArray.map((x, i) => x[3])
  const vialLabels = zippedArray.map((x, i) => x[4])

  const vialOpacitiesNew = []
  const generalOpacityNew = []
  const valueInputsNew = []
  const vialLabelsNew = []

  let i;
  for (i = 0; i < odState.length; i++) {
    vialOpacitiesNew[odState[i]] = vialOpacities[i]
    generalOpacityNew[odState[i]] = generalOpacity[i]
    valueInputsNew[odState[i]] = valueInputs[i]
    vialLabelsNew[odState[i]] = vialLabels[i]
  }

  return [ odState, vialOpacitiesNew, generalOpacityNew, valueInputsNew, vialLabelsNew];
}

export default class ODcalGUI extends Component<Props> {
  constructor(props) {
    super(props);
    this.state = {
      odState: [12,13,14,15,8,9,10,11,4,5,6,7,0,1,2,3],
      vialOpacities: this.props.vialOpacities,
      generalOpacity: this.props.generalOpacity,
      valueInputs: this.props.valueInputs,
      vialLabels: this.props.vialLabels,
      zipped: [],
      readProgress: this.props.readProgress,
    };
  }

  componentDidUpdate(prevProps) {
    if ((this.props.generalOpacity !== prevProps.generalOpacity) || this.props.vialOpacities !== prevProps.vialOpacities || this.props.valueInputs !== prevProps.valueInputs || this.props.vialLabels !== prevProps.vialLabels) {
      const zippedSamples = zipValues(this.state.odState, this.props.vialOpacities, this.props.generalOpacity, this.props.valueInputs, this.props.vialLabels)
      console.log(zippedSamples)
      this.setState({
        generalOpacity: this.props.generalOpacity,
        vialOpacities: this.props.vialOpacities,
        valueInputs: this.props.valueInputs,
        vialLabels: this.props.vialLabels,
        zipped: zippedSamples,
      })
    }
    if (this.props.readProgress !== prevProps.readProgress) {
      this.setState({ readProgress: this.props.readProgress})
    }
  }

  handleBack = (event) => {
    const zippedSamples = zipValues(this.state.odState, this.state.vialOpacities, this.state.generalOpacity, this.state.valueInputs, this.state.vialLabels)
    const newState = []
    newState[7] = zippedSamples[0]
    newState[0] = zippedSamples[1]
    newState[1] = zippedSamples[2]
    newState[2] = zippedSamples[3]
    newState[11] = zippedSamples[4]
    newState[4] = zippedSamples[5]
    newState[5] = zippedSamples[6]
    newState[6] = zippedSamples[7]
    newState[15] = zippedSamples[8]
    newState[8] = zippedSamples[9]
    newState[9] = zippedSamples[10]
    newState[10] = zippedSamples[11]
    newState[3] = zippedSamples[12]
    newState[12] = zippedSamples[13]
    newState[13] = zippedSamples[14]
    newState[14] = zippedSamples[15]

    const unzipped = unzipValues(newState)
    const odState = unzipped[0]
    const vialOpacities = unzipped[1]
    const generalOpacity = unzipped[2]
    const valueInputs = unzipped[3]
    const vialLabels = unzipped[4]

    this.setState({
      zipped: newState,
      odState,
      vialOpacities,
      generalOpacity,
      valueInputs,
      vialLabels,
    });
  }

  handleAdvance = (event) => {
    const zippedSamples = zipValues(this.state.odState, this.state.vialOpacities, this.state.generalOpacity, this.state.valueInputs, this.state.vialLabels)
    const newState = []
    newState[0] = zippedSamples[7]
    newState[1] = zippedSamples[0]
    newState[2] = zippedSamples[1]
    newState[3] = zippedSamples[2]
    newState[4] = zippedSamples[11]
    newState[5] = zippedSamples[4]
    newState[6] = zippedSamples[5]
    newState[7] = zippedSamples[6]
    newState[8] = zippedSamples[15]
    newState[9] = zippedSamples[8]
    newState[10] = zippedSamples[9]
    newState[11] = zippedSamples[10]
    newState[12] = zippedSamples[3]
    newState[13] = zippedSamples[12]
    newState[14] = zippedSamples[13]
    newState[15] = zippedSamples[14]

    const unzipped = unzipValues(newState)
    const odState = unzipped[0]
    const vialOpacities = unzipped[1]
    const generalOpacity = unzipped[2]
    const valueInputs = unzipped[3]
    const vialLabels = unzipped[4]

    this.setState({
      zipped: newState,
      odState,
      vialOpacities,
      generalOpacity,
      valueInputs,
      vialLabels,
    });
  }

  render() {
    const { odState } = this.state;
    let outputs;
    if (this.props.displayGraphs) {
        outputs = <div />
    }
    else {
        outputs = <div>
        <VialItem currentValue={this.state.zipped} />
        <VialOutline readProgress={this.state.readProgress} />
      </div>
    }

    return(
            <div>{outputs}</div>
    );
  }
}
