import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import LegacyButton from '../LegacyButton';
import LegacyButtonGroup from '../LegacyButtonGroup';
import Typography from '../Typography';
import Select from '../Select';

const StudyListPagination = ({ onChangePage, currentPage, perPage, onChangePerPage }) => {
  const { t } = useTranslation('StudyList');

  const navigateToPage = page => {
    const toPage = page < 1 ? 1 : page;
    onChangePage(toPage);
  };

  const ranges = [
    { value: '25', label: '25' },
    { value: '50', label: '50' },
    { value: '100', label: '100' },
  ];
  const [selectedRange, setSelectedRange] = useState(ranges.find(r => r.value === perPage));
  const onSelectedRange = selectedRange => {
    setSelectedRange(selectedRange);
    onChangePerPage(selectedRange.value);
  };

  return (
    <div className="bg-black py-10">
      
    </div>
  );
};

StudyListPagination.propTypes = {
  onChangePage: PropTypes.func.isRequired,
  currentPage: PropTypes.number.isRequired,
  perPage: PropTypes.number.isRequired,
  onChangePerPage: PropTypes.func.isRequired,
};

export default StudyListPagination;
