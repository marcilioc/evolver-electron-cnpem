// @flow
import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { withStyles } from '@material-ui/core/styles';
import routes from '../constants/routes.json';

const styles = {};

class Template extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div />
    );
  }
}

export default withStyles(styles)(Template);
