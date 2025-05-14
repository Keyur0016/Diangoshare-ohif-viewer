import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import LegacyButton from '../LegacyButton';
import Icon from '../Icon';
import Typography from '../Typography';
import InputGroup from '../InputGroup';
import DiangoShareLogo from '../../assets/icons/diango-share.png';

// Placeholder component while StudyListFilter is hidden
const StudyListFilter = () => {
  return (
    <div>
      <div style={{
        display: "flex",
        textAlign: "center",
        justifyContent: "center",
        height: "calc(100vh - 135px)",
        width: "60%",
        marginLeft: "auto",
        marginRight: "auto"
      }}>
        <img
          style={{
            marginTop: "auto",
            marginBottom: "auto",
          }}
          src={DiangoShareLogo}
          alt="Diango Share Logo"
        />
      </div>
    </div>
  )
};

export default StudyListFilter;
