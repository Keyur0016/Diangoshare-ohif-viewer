import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { metaData } from '@cornerstonejs/core';

import { SidePanel, ErrorBoundary, LoadingIndicatorProgress } from '@ohif/ui';
import { ServicesManager, HangingProtocolService, CommandsManager } from '@ohif/core';
import { useAppConfig } from '@state';
import ViewerHeader from './ViewerHeader';
import SidePanelWithServices from '../Components/SidePanelWithServices';

function ViewerLayout({
  // From Extension Module Params
  extensionManager,
  servicesManager,
  hotkeysManager,
  commandsManager,
  // From Modes
  viewports,
  ViewportGridComp,
  leftPanels = [],
  rightPanels = [],
  leftPanelDefaultClosed = false,
  rightPanelDefaultClosed = false,
}): React.FunctionComponent {
  const [appConfig] = useAppConfig();

  const { hangingProtocolService, uiNotificationService } = servicesManager.services;
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(appConfig.showLoadingIndicator);
  const [isAttachingImage, setIsAttachingImage] = useState(false);
  const [hasDiagnoToken, setHasDiagnoToken] = useState(false);

  // Check for diagnotoken in session storage
  useEffect(() => {
    const checkToken = () => {
      const token = sessionStorage.getItem('diagnotoken');
      setHasDiagnoToken(!!token);
    };

    // Check initially
    checkToken();

    // Listen for storage changes (in case token is added/removed)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'diagnotoken') {
        checkToken();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also check periodically in case token is set in same window
    const interval = setInterval(checkToken, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  /**
   * Set body classes (tailwindcss) that don't allow vertical
   * or horizontal overflow (no scrolling). Also guarantee window
   * is sized to our viewport.
   */
  useEffect(() => {
    document.body.classList.add('bg-black');
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('bg-black');
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  const getComponent = id => {
    const entry = extensionManager.getModuleEntry(id);

    if (!entry) {
      throw new Error(
        `${id} is not valid for an extension module. Please verify your configuration or ensure that the extension is properly registered. It's also possible that your mode is utilizing a module from an extension that hasn't been included in its dependencies (add the extension to the "extensionDependencies" array in your mode's index.js file)`
      );
    }

    let content;
    if (entry && entry.component) {
      content = entry.component;
    } else {
      throw new Error(
        `No component found from extension ${id}. Check the reference string to the extension in your Mode configuration`
      );
    }

    return { entry, content };
  };

  const getPanelData = id => {
    const { content, entry } = getComponent(id);

    return {
      id: entry.id,
      iconName: entry.iconName,
      iconLabel: entry.iconLabel,
      label: entry.label,
      name: entry.name,
      content,
    };
  };

  useEffect(() => {
    const { unsubscribe } = hangingProtocolService.subscribe(
      HangingProtocolService.EVENTS.PROTOCOL_CHANGED,

      // Todo: right now to set the loading indicator to false, we need to wait for the
      // hangingProtocolService to finish applying the viewport matching to each viewport,
      // however, this might not be the only approach to set the loading indicator to false. we need to explore this further.
      () => {
        setShowLoadingIndicator(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [hangingProtocolService]);

  const getViewportComponentData = viewportComponent => {
    const { entry } = getComponent(viewportComponent.namespace);

    return {
      component: entry.component,
      displaySetsToDisplay: viewportComponent.displaySetsToDisplay,
    };
  };

  const leftPanelComponents = leftPanels.map(getPanelData);
  const rightPanelComponents = rightPanels.map(getPanelData);
  const viewportComponents = viewports.map(getViewportComponentData);

  return (
    <div>
      <ViewerHeader
        hotkeysManager={hotkeysManager}
        extensionManager={extensionManager}
        servicesManager={servicesManager}
      />
      <div
        className="relative flex w-full flex-row flex-nowrap items-stretch overflow-hidden bg-black"
        style={{ height: 'calc(100vh - 52px' }}
      >
        <React.Fragment>
          {showLoadingIndicator && <LoadingIndicatorProgress className="h-full w-full bg-black" />}
          {/* LEFT SIDEPANELS */}
          {leftPanelComponents.length ? (
            <ErrorBoundary context="Left Panel">
              <SidePanelWithServices
                side="left"
                activeTabIndex={leftPanelDefaultClosed ? null : 0}
                tabs={leftPanelComponents}
                servicesManager={servicesManager}
              />
            </ErrorBoundary>
          ) : null}
          {/* TOOLBAR + GRID */}
          <div className="flex h-full flex-1 flex-col dicom-image-viewer-main-div">
            <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden bg-black">
              <ErrorBoundary context="Grid">
                <ViewportGridComp
                  servicesManager={servicesManager}
                  viewportComponents={viewportComponents}
                  commandsManager={commandsManager}
                />
              </ErrorBoundary>
              {/* Attach Image in Report Button - Only show if diagnotoken exists */}
              {hasDiagnoToken && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                  <button
                    onClick={async () => {
                      if (isAttachingImage) {
                        return; // Prevent multiple clicks
                      }

                      try {
                        const config = (window as any).config;
                        if (!config || !config.attachImageInReport) {
                          uiNotificationService.show({
                            title: 'Error',
                            message: 'Attach image function not found in configuration',
                            type: 'error',
                            duration: 5000,
                          });
                          return;
                        }

                        setIsAttachingImage(true);

                        // Get current DICOM instance ID, study ID, and series ID
                        let instanceId = null;
                        let studyId = null;
                        let seriesId = null;

                        try {
                          const { viewportGridService } = servicesManager.services;
                          const activeViewportId = viewportGridService.getActiveViewportId();

                          if (!activeViewportId) {
                            throw new Error('No active viewport found');
                          }

                          const { cornerstoneViewportService } = servicesManager.services;
                          const viewport =
                            cornerstoneViewportService.getCornerstoneViewport(activeViewportId);

                          if (!viewport) {
                            throw new Error('Viewport not available');
                          }

                          const imageId = viewport.getCurrentImageId();
                          if (!imageId) {
                            throw new Error('No image loaded in viewport');
                          }

                          // Get SOPInstanceUID, StudyInstanceUID, and SeriesInstanceUID from imageId
                          const instance = metaData.get('instance', imageId);
                          if (instance) {
                            instanceId = instance.SOPInstanceUID || null;
                            studyId = instance.StudyInstanceUID || null;
                            seriesId = instance.SeriesInstanceUID || null;
                          }

                          // Validate that we have at least the instance ID
                          if (!instanceId) {
                            throw new Error('Could not retrieve DICOM instance information');
                          }

                          // Call the API
                          await config.attachImageInReport(instanceId, studyId, seriesId);

                          uiNotificationService.show({
                            title: 'Success',
                            message: 'Image attached to report successfully',
                            type: 'success',
                            duration: 5000,
                          });
                        } catch (err) {
                          console.error('Error getting DICOM IDs or attaching image:', err);
                          uiNotificationService.show({
                            title: 'Error',
                            message:
                              err.message ||
                              'Failed to attach image in report. Please try again.',
                            type: 'error',
                            duration: 7000,
                          });
                        } finally {
                          setIsAttachingImage(false);
                        }
                      } catch (error) {
                        console.error('Failed to attach image in report:', error);
                        uiNotificationService.show({
                          title: 'Error',
                          message:
                            error.message ||
                            'An unexpected error occurred while attaching image',
                          type: 'error',
                          duration: 7000,
                        });
                        setIsAttachingImage(false);
                      }
                    }}
                    disabled={isAttachingImage}
                    className={`attach-image-in-report-button px-3 py-1.5 text-white rounded-md shadow-lg transition-colors duration-200 text-sm font-medium ${
                      isAttachingImage
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isAttachingImage ? 'Attaching...' : 'Attach Image in Report'}
                  </button>
                </div>
              )}
            </div>
          </div>
          {rightPanelComponents.length ? (
            <ErrorBoundary context="Right Panel">
              <SidePanelWithServices
                side="right"
                activeTabIndex={rightPanelDefaultClosed ? null : 0}
                tabs={rightPanelComponents}
                servicesManager={servicesManager}
              />
            </ErrorBoundary>
          ) : null}
        </React.Fragment>
      </div>
    </div>
  );
}

ViewerLayout.propTypes = {
  // From extension module params
  extensionManager: PropTypes.shape({
    getModuleEntry: PropTypes.func.isRequired,
  }).isRequired,
  commandsManager: PropTypes.instanceOf(CommandsManager),
  servicesManager: PropTypes.instanceOf(ServicesManager),
  // From modes
  leftPanels: PropTypes.array,
  rightPanels: PropTypes.array,
  leftPanelDefaultClosed: PropTypes.bool.isRequired,
  rightPanelDefaultClosed: PropTypes.bool.isRequired,
  /** Responsible for rendering our grid of viewports; provided by consuming application */
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  viewports: PropTypes.array,
};

export default ViewerLayout;
