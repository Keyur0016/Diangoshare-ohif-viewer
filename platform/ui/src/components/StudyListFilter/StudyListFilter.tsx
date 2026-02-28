import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import LegacyButton from '../LegacyButton';
import Typography from '../Typography';
import InputGroup from '../InputGroup';
import { Icons } from '@ohif/ui-next';

// DiagnoShare logo URL (public assets) - matches reference project configuration
const getDiagnoShareLogoUrl = () => {
  if (typeof window === 'undefined') return '';
  const base = (window as any).PUBLIC_URL || '';
  return `${base}assets/diango-share.png`;
};

/**
 * Study List filter section. Configured to match reference project:
 * shows DiagnoShare branding area at top, then filter row with title, study count, and filter inputs.
 */
const StudyListFilter = ({
  filtersMeta,
  filterValues,
  onChange,
  clearFilters,
  isFiltering,
  numOfStudies,
  onUploadClick,
  getDataSourceConfigurationComponent,
}) => {
  const { t } = useTranslation('StudyList');
  const { sortBy, sortDirection } = filterValues;
  const filterSorting = { sortBy, sortDirection };
  const setFilterSorting = sortingValues => {
    onChange({
      ...filterValues,
      ...sortingValues,
    });
  };
  const isSortingEnabled = numOfStudies > 0 && numOfStudies <= 100;

  return (
    <React.Fragment>
      {/* DiagnoShare branding area - matches reference project */}
      <div className="bg-black">
        <div
          className="flex items-center justify-center mx-auto py-6"
          style={{ width: '60%', minHeight: '120px' }}
        >
          <img
            src={getDiagnoShareLogoUrl()}
            alt="DiagnoShare"
            className="h-16 w-auto object-contain djangoshare-header-icon"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      </div>
      {/* Study List title, config, upload, count and filters - same as before */}
      <div>
        <div className="bg-black">
          <div className="container relative mx-auto flex flex-col pt-5">
            <div className="mb-5 flex flex-row justify-between">
              <div className="flex min-w-[1px] shrink flex-row items-center gap-6">
                <Typography variant="h6" className="text-white">
                  {t('StudyList')}
                </Typography>
                {getDataSourceConfigurationComponent && getDataSourceConfigurationComponent()}
                {onUploadClick && (
                  <div
                    className="text-primary-active flex cursor-pointer items-center gap-2 self-center text-lg font-semibold"
                    onClick={onUploadClick}
                  >
                    <Icons.Upload />
                    <span>{t('Upload')}</span>
                  </div>
                )}
              </div>
              <div className="flex h-[34px] flex-row items-center">
                {isFiltering && (
                  <LegacyButton
                    rounded="full"
                    variant="outlined"
                    color="primaryActive"
                    border="primaryActive"
                    className="mx-8"
                    startIcon={<Icons.Cancel />}
                    onClick={clearFilters}
                  >
                    {t('ClearFilters')}
                  </LegacyButton>
                )}

                <Typography variant="h6" className="mr-2" data-cy={'num-studies'}>
                  {numOfStudies > 100 ? '>100' : numOfStudies}
                </Typography>
                <Typography variant="h6" className="text-primary-light">
                  {`${t('Studies')} `}
                </Typography>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="sticky -top-1 z-10 mx-auto border-b-4 border-black">
        <div className="bg-primary-dark pt-3 pb-3">
          <InputGroup
            inputMeta={filtersMeta}
            values={filterValues}
            onValuesChange={onChange}
            sorting={filterSorting}
            onSortingChange={setFilterSorting}
            isSortingEnabled={isSortingEnabled}
          />
        </div>
        {numOfStudies > 100 && (
          <div className="container m-auto">
            <div className="bg-primary-main rounded-b py-1 text-center text-base">
              <p className="text-white">
                {t('Filter list to 100 studies or less to enable sorting')}
              </p>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
};

StudyListFilter.propTypes = {
  filtersMeta: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      displayName: PropTypes.string.isRequired,
      inputType: PropTypes.oneOf(['Text', 'MultiSelect', 'DateRange', 'None']).isRequired,
      isSortable: PropTypes.bool.isRequired,
      gridCol: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).isRequired,
      option: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string,
          label: PropTypes.string,
        })
      ),
    })
  ).isRequired,
  filterValues: PropTypes.object.isRequired,
  numOfStudies: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  clearFilters: PropTypes.func.isRequired,
  isFiltering: PropTypes.bool.isRequired,
  onUploadClick: PropTypes.func,
  getDataSourceConfigurationComponent: PropTypes.func,
};

export default StudyListFilter;
