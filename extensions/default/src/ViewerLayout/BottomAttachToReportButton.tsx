import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icons } from '@ohif/ui-next';
import { attachViewportImageToReport } from '../utils/saveViewportData';

function BottomAttachToReportButton({
  servicesManager,
}: {
  servicesManager: AppTypes.ServicesManager;
}) {
  const { t } = useTranslation();
  const [isAttaching, setIsAttaching] = useState(false);
  const hasReportToken =
    typeof window !== 'undefined' && !!window.sessionStorage?.getItem('reporttoken');

  const handleAttachToReport = async () => {
    try {
      setIsAttaching(true);
      await attachViewportImageToReport(servicesManager);
    } catch (error) {
      console.error('Failed to attach image to report:', error);
    } finally {
      setIsAttaching(false);
    }
  };

  if (!hasReportToken) {
    return null;
  }

  return (
    <div className="flex justify-center py-2">
      <Button
        variant="secondary"
        className="bg-primary-dark hover:bg-primary-dark/90 text-white shadow-md"
        onClick={handleAttachToReport}
        disabled={isAttaching}
        title={t('Buttons:Attach Image to Report') || 'Attach image to report'}
      >
        {isAttaching ? (
          <Icons.LoadingSpinner className="animate-spin h-5 w-5" />
        ) : (
          <Icons.Link className="h-5 w-5" />
        )}
        <span className="ml-2">{t('Buttons:Attach Image to Report') || 'Attach Image to Report'}</span>
      </Button>
    </div>
  );
}

export default BottomAttachToReportButton;
