import { useState, useEffect, useCallback, useRef } from 'react';
import { utils, useSystem } from '@ohif/core';

const { formatPN, formatDate } = utils;

/** Response shape from /ohif/fetch-patient-info API */
interface FetchPatientInfoResponse {
  PatientMainDicomTags?: {
    PatientName?: string;
    PatientID?: string;
    PatientSex?: string;
    PatientBirthDate?: string;
  };
}

function getStudyInstanceUIDFromDisplaySets(displaySets: unknown[]): string | null {
  if (!displaySets?.length) {
    return null;
  }
  const first = displaySets[0] as {
    instances?: Array<{ StudyInstanceUID?: string }>;
    instance?: { StudyInstanceUID?: string };
    StudyInstanceUID?: string;
  };
  const instance = first?.instances?.[0] || first?.instance;
  return (
    instance?.StudyInstanceUID ?? (first as { StudyInstanceUID?: string }).StudyInstanceUID ?? null
  );
}

function usePatientInfo() {
  const { servicesManager } = useSystem();
  const { displaySetService } = servicesManager.services;

  const [patientInfo, setPatientInfo] = useState({
    PatientName: '',
    PatientID: '',
    PatientSex: '',
    PatientDOB: '',
  });
  const [isMixedPatients, setIsMixedPatients] = useState(false);

  // Track fetched studyInstanceUIDs to prevent duplicate API calls
  const fetchedStudyInstanceUIDs = useRef<Set<string>>(new Set());
  // Track in-flight requests to prevent concurrent duplicate calls
  const inFlightRequests = useRef<Map<string, Promise<boolean>>>(new Map());

  const checkMixedPatients = useCallback(
    (PatientID: string) => {
      const displaySets = displaySetService.getActiveDisplaySets();
      let mixed = false;
      displaySets.forEach(displaySet => {
        const instance = displaySet?.instances?.[0] || displaySet?.instance;
        if (!instance) {
          return;
        }
        if ((instance as { PatientID?: string }).PatientID !== PatientID) {
          mixed = true;
        }
      });
      setIsMixedPatients(mixed);
    },
    [displaySetService]
  );

  /** Set patient info from API response (PatientMainDicomTags). */
  const setPatientInfoFromApiResponse = useCallback(
    (data: FetchPatientInfoResponse) => {
      const tags = data?.PatientMainDicomTags;
      if (!tags) {
        return;
      }
      const birthDate = tags.PatientBirthDate ? formatDate(tags.PatientBirthDate) : '';
      setPatientInfo({
        PatientID: tags.PatientID ?? '',
        PatientName: tags.PatientName ? formatPN(tags.PatientName) : '',
        PatientSex: tags.PatientSex ?? '',
        PatientDOB: birthDate,
      });
      if (tags.PatientID) {
        checkMixedPatients(tags.PatientID);
      }
    },
    [checkMixedPatients]
  );

  /** Set patient info from display set instance (fallback). */
  const setPatientInfoFromDisplaySets = useCallback(
    (displaySets: Array<{ instances?: unknown[]; instance?: unknown }>) => {
      if (!displaySets?.length) {
        return;
      }
      const displaySet = displaySets[0];
      const instance = displaySet?.instances?.[0] || displaySet?.instance;
      if (!instance || typeof instance !== 'object') {
        return;
      }
      const inst = instance as Record<string, unknown>;
      setPatientInfo({
        PatientID: (inst.PatientID as string) ?? '',
        PatientName: inst.PatientName ? formatPN(inst.PatientName as string) : '',
        PatientSex: (inst.PatientSex as string) ?? '',
        PatientDOB: formatDate(inst.PatientBirthDate as string) ?? '',
      });
      checkMixedPatients((inst.PatientID as string) ?? '');
    },
    [checkMixedPatients]
  );

  const fetchAndSetPatientInfo = useCallback(
    async (studyInstanceUID: string) => {
      // If we've already fetched for this studyInstanceUID, skip the API call
      if (fetchedStudyInstanceUIDs.current.has(studyInstanceUID)) {
        return true;
      }

      // If there's already an in-flight request for this studyInstanceUID, return that promise
      const existingRequest = inFlightRequests.current.get(studyInstanceUID);
      if (existingRequest) {
        return existingRequest;
      }

      const config =
        typeof window !== 'undefined'
          ? (
              window as Window & {
                config?: {
                  patientInfoApiBaseUrl?: string;
                  getAuthorizationHeader?: () => Record<string, string>;
                };
              }
            ).config
          : undefined;
      const baseUrl = config?.patientInfoApiBaseUrl;
      if (!baseUrl) {
        return false;
      }
      const url = `${baseUrl.replace(/\/$/, '')}/fetch-patient-info?studyInstanceUID=${encodeURIComponent(studyInstanceUID)}`;
      const headers: Record<string, string> = config?.getAuthorizationHeader?.() ?? {};

      // Create the request promise and store it to prevent duplicate concurrent calls
      const requestPromise = (async () => {
        try {
          const res = await fetch(url, { headers });
          if (!res.ok) {
            inFlightRequests.current.delete(studyInstanceUID);
            return false;
          }
          const patientInfo = await res.json();
          const data: FetchPatientInfoResponse = patientInfo;
          setPatientInfoFromApiResponse(data);
          // Mark this studyInstanceUID as fetched
          fetchedStudyInstanceUIDs.current.add(studyInstanceUID);
          inFlightRequests.current.delete(studyInstanceUID);
          return true;
        } catch {
          inFlightRequests.current.delete(studyInstanceUID);
          return false;
        }
      })();

      // Store the in-flight request
      inFlightRequests.current.set(studyInstanceUID, requestPromise);
      return requestPromise;
    },
    [setPatientInfoFromApiResponse]
  );

  const updatePatientInfo = useCallback(
    (displaySets: Array<{ instances?: unknown[]; instance?: unknown }>) => {
      if (!displaySets?.length) {
        return;
      }
      const studyInstanceUID = getStudyInstanceUIDFromDisplaySets(displaySets);
      if (studyInstanceUID) {
        fetchAndSetPatientInfo(studyInstanceUID).then(ok => {
          if (!ok) {
            setPatientInfoFromDisplaySets(displaySets);
          }
        });
      } else {
        setPatientInfoFromDisplaySets(displaySets);
      }
    },
    [fetchAndSetPatientInfo, setPatientInfoFromDisplaySets]
  );

  useEffect(() => {
    const activeDisplaySets = displaySetService.getActiveDisplaySets();
    if (activeDisplaySets?.length) {
      updatePatientInfo(activeDisplaySets);
    }
    const subscription = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_ADDED,
      (props: { displaySetsAdded?: Array<{ instances?: unknown[]; instance?: unknown }> }) => {
        if (props?.displaySetsAdded?.length) {
          updatePatientInfo(props.displaySetsAdded);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [displaySetService, updatePatientInfo]);

  return { patientInfo, isMixedPatients };
}

export default usePatientInfo;
