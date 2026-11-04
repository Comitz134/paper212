import { controlLocalEngine, getLocalSnapshot, resetLocalEngine } from './local/engine';
import type { Settings, Snapshot } from './types';

export class ApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function fetchSnapshot(_settings?: Pick<Settings, 'mode'>, _timeoutMs = 15_000): Promise<Snapshot> {
  try {
    return await getLocalSnapshot();
  } catch (error) {
    throw new ApiError((error as Error)?.message || 'The on-device paper engine could not start.');
  }
}

export async function sendAction(
  _settings: Pick<Settings, 'mode'> | undefined,
  action: 'run' | 'pause' | 'resume'
): Promise<Snapshot> {
  try {
    return await controlLocalEngine(action);
  } catch (error) {
    throw new ApiError((error as Error)?.message || 'The on-device paper engine did not accept the action.');
  }
}

export async function resetPaperAccount(): Promise<Snapshot> {
  try {
    return await resetLocalEngine();
  } catch (error) {
    throw new ApiError((error as Error)?.message || 'The paper account could not be reset.');
  }
}
