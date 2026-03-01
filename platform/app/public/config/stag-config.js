/** @type {AppTypes.Config} - DiagnoShare staging environment */

/** DICOMWeb API base URL – update this to change all WADO/QIDO roots for staging */
var DICOMWEB_BASE_URL = 'https://stag-ohif-proxy.diagnoshare.com/ohif';

/** Base URL for OHIF patient info API (fetch-patient-info). Uses same origin as DICOMWeb when not set. */
var PATIENT_INFO_API_BASE_URL = DICOMWEB_BASE_URL;

window.config = {
  name: 'config/stag-config.js',
  /** Base URL for patient info API: GET {patientInfoApiBaseUrl}/fetch-patient-info?studyInstanceUID=... */
  patientInfoApiBaseUrl: PATIENT_INFO_API_BASE_URL,
  routerBasename: '/',
  whiteLabeling: {
    createLogoComponentFn: function (React, props) {
      var publicUrl = typeof window !== 'undefined' && window.PUBLIC_URL ? window.PUBLIC_URL : '';
      var logoSrc = publicUrl + 'assets/diango-share.png';
      return React.createElement(
        'div',
        { className: 'flex flex-col items-start justify-center', style: { minWidth: '120px' } },
        React.createElement('img', {
          src: logoSrc,
          alt: 'DiagnoShare',
          className: 'h-8 w-auto object-contain',
          onError: function (e) {
            e.target.style.display = 'none';
            var next = e.target.nextElementSibling;
            if (next) next.style.display = 'flex';
          },
        }),
        React.createElement('div', {
          className: 'flex flex-col text-white text-left',
          style: { display: 'none', fontSize: '11px', lineHeight: '1.2' },
        }, [
          React.createElement('span', { key: '1', className: 'font-semibold' }, 'DiagnoShare'),
          React.createElement('span', { key: '2', className: 'text-primary-light text-[10px]' }, 'Connecting Healthcare'),
        ])
      );
    },
  },
  extensions: [],
  modes: [],
  customizationService: {},
  showStudyList: true,
  hideStudyListTable: true,
  maxNumberOfWebWorkers: 3,
  showWarningMessageForCrossOrigin: true,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  experimentalStudyBrowserSort: false,
  strictZSpacingForVolumeViewport: true,
  groupEnabledModesFirst: true,
  allowMultiSelectExport: false,
  maxNumRequests: {
    interaction: 100,
    thumbnail: 75,
    prefetch: 25,
  },
  showErrorDetails: 'always',
  investigationalUseDialog: { option: 'never' },
  getAuthorizationHeader: function () {
    var token =
      (typeof window !== 'undefined' && window.sessionStorage && window.sessionStorage.getItem('diagnotoken')) ||
      (typeof window !== 'undefined' && window.__DIAGNOSHARE_TOKEN__) ||
      null;
    return token ? { Authorization: 'Bearer ' + token } : {};
  },
  defaultDataSourceName: 'ohif',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'ohif',
      configuration: {
        friendlyName: 'AWS S3 Static wado server',
        name: 'aws',
        wadoUriRoot: DICOMWEB_BASE_URL,
        qidoRoot: DICOMWEB_BASE_URL,
        wadoRoot: DICOMWEB_BASE_URL,
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
        omitQuotationForMultipartRequest: true,
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'ohif2',
      configuration: {
        friendlyName: 'AWS S3 Static wado secondary server',
        name: 'aws',
        wadoUriRoot: DICOMWEB_BASE_URL,
        qidoRoot: DICOMWEB_BASE_URL,
        wadoRoot: DICOMWEB_BASE_URL,
        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
        omitQuotationForMultipartRequest: true,
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomwebproxy',
      sourceName: 'dicomwebproxy',
      configuration: {
        friendlyName: 'dicomweb delegating proxy',
        name: 'dicomwebproxy',
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomjson',
      sourceName: 'dicomjson',
      configuration: {
        friendlyName: 'dicom json',
        name: 'json',
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomlocal',
      sourceName: 'dicomlocal',
      configuration: {
        friendlyName: 'dicom local',
      },
    },
  ],
  httpErrorHandler: function (error) {
    console.warn(error.status);
    console.warn('Staging: check data source or network.');
  },
};
