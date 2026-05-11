import type { Participant } from "../../../models/types";
import { imuStop, type NativeImuStopResult } from "../../../services/sensors/nativeImu";
import { resolveSessionNumberForLocalSave } from "../../../services/tests/localSessionNumber";
import type { SupportedTestType } from "../../../services/tests/uploadTestJson";

type SaveToCacheFn = (
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber: number
) => Promise<{ uri: string }>;

export type FinalizeImuCaptureResult = {
  result: NativeImuStopResult;
  uri: string;
  sessionNumber: number;
  cloudSessionResolved: boolean;
};

async function persistImuResultToCache(args: {
  participant: Participant;
  testType: SupportedTestType;
  nativeResult: NativeImuStopResult;
  saveToCache: SaveToCacheFn;
  emptySamplesMessage: string;
}): Promise<FinalizeImuCaptureResult> {
  if (!args.nativeResult?.samples?.length) {
    throw new Error(args.emptySamplesMessage);
  }

  const { sessionNumber, fromCloud } = await resolveSessionNumberForLocalSave(
    String(args.participant.id),
    args.testType
  );
  const saved = await args.saveToCache(args.nativeResult, args.participant, sessionNumber);

  return {
    result: args.nativeResult,
    uri: saved.uri,
    sessionNumber,
    cloudSessionResolved: fromCloud,
  };
}

export async function finalizeImuCaptureToCache(args: {
  participant: Participant;
  testType: SupportedTestType;
  saveToCache: SaveToCacheFn;
  emptySamplesMessage: string;
}): Promise<FinalizeImuCaptureResult> {
  const nativeResult = await imuStop();
  return persistImuResultToCache({ ...args, nativeResult });
}

export async function saveImuResultToCache(args: {
  participant: Participant;
  testType: SupportedTestType;
  result: NativeImuStopResult;
  saveToCache: SaveToCacheFn;
  emptySamplesMessage: string;
}): Promise<FinalizeImuCaptureResult> {
  return persistImuResultToCache({
    participant: args.participant,
    testType: args.testType,
    nativeResult: args.result,
    saveToCache: args.saveToCache,
    emptySamplesMessage: args.emptySamplesMessage,
  });
}
