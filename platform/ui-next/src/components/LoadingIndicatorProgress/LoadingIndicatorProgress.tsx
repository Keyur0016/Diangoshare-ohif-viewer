import React, { useState } from 'react';
import classNames from 'classnames';

import ProgressLoadingBar from '../ProgressLoadingBar';
import { Icons } from '../Icons';

const getDiagnoShareLogoSrc = () =>
  typeof window !== 'undefined' && (window as any).PUBLIC_URL
    ? `${(window as any).PUBLIC_URL}assets/diango-share.png`
    : '';

/**
 *  A React component that renders a loading indicator.
 * Shows DiagnoShare logo during load; if progress is provided, shows a progress bar.
 * Optionally a textBlock can be provided to display a message.
 */
function LoadingIndicatorProgress({ className, textBlock, progress }) {
  const [logoSrc] = useState(getDiagnoShareLogoSrc());
  const [logoError, setLogoError] = useState(false);

  return (
    <div
      className={classNames(
        'absolute top-0 left-0 z-50 flex flex-col items-center justify-center space-y-5',
        className
      )}
    >
      {logoSrc && !logoError ? (
        <img
          src={logoSrc}
          alt="DiagnoShare"
          className="h-16 w-auto object-contain"
          onError={() => setLogoError(true)}
        />
      ) : (
        <Icons.LoadingOHIFMark className="h-12 w-12 text-white" />
      )}
      <div className="w-48">
        <ProgressLoadingBar progress={progress} />
      </div>
      {textBlock}
    </div>
  );
}

export default LoadingIndicatorProgress;
