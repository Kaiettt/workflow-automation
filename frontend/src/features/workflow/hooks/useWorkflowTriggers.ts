import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, triggerService } from '../services/trigger.service';
import type {
  ActivationState,
  NodeOption,
  NodeWebhook,
  TestListen,
} from '../types/trigger.types';

export const triggerKeys = {
  activation: (workflowId: string) => ['workflow-activation', workflowId] as const,
  webhooks: (workflowId: string) => ['workflow-webhooks', workflowId] as const,
  options: (nodeKey: string, property: string, credentialId: string | undefined) =>
    ['node-options', nodeKey, property, credentialId ?? ''] as const,
};

export function useActivation(workflowId: string | undefined) {
  return useQuery<ActivationState>({
    queryKey: triggerKeys.activation(workflowId ?? ''),
    queryFn: () => triggerService.activation(workflowId as string),
    enabled: !!workflowId,
  });
}

export function useSetActive(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation<ActivationState, Error, boolean>({
    mutationFn: (active) => triggerService.setActive(workflowId, active),
    onSuccess: (state) => {
      queryClient.setQueryData(triggerKeys.activation(workflowId), state);
    },
  });
}

// URLs of the draft's trigger nodes. With `waitForNodeId` the query checks
// again until that node has a URL (a new node appears once the draft saves).
export function useNodeWebhooks(workflowId: string | undefined, waitForNodeId?: string) {
  return useQuery<NodeWebhook[]>({
    queryKey: triggerKeys.webhooks(workflowId ?? ''),
    queryFn: () => triggerService.webhooks(workflowId as string),
    enabled: !!workflowId,
    refetchInterval: (query) =>
      waitForNodeId && !triggerService.findForNode(query.state.data, waitForNodeId)?.url
        ? 2000
        : false,
  });
}

export function useNodeOptions(
  nodeKey: string,
  property: string,
  credentialId: string | undefined,
  needsCredential: boolean,
) {
  return useQuery<NodeOption[], Error>({
    queryKey: triggerKeys.options(nodeKey, property, credentialId),
    queryFn: async () => {
      try {
        return await triggerService.loadOptions(nodeKey, property, credentialId);
      } catch (error) {
        throw new Error(errorMessage(error, 'Options could not be loaded'), { cause: error });
      }
    },
    enabled: !needsCredential || !!credentialId,
    retry: false,
  });
}

const POLL_MS = 2000;

// "Listen for test event": starts a listen, polls until an event arrives or
// it expires, and stops it when the panel goes away.
export function useTestListen(workflowId: string, nodeId: string) {
  const [listen, setListen] = useState<TestListen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const active = useRef<string | null>(null);

  useEffect(() => {
    if (!listen || listen.status !== 'waiting') return;
    const timer = window.setInterval(() => {
      triggerService
        .testListen(listen.listenId)
        .then((next) => {
          if (active.current === next.listenId) setListen(next);
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [listen]);

  // Leaving the node (or the page) stops a listen still waiting.
  useEffect(
    () => () => {
      if (active.current) void triggerService.stopTestListen(active.current).catch(() => undefined);
    },
    [workflowId, nodeId],
  );

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      const started = await triggerService.startTestListen(workflowId, nodeId);
      active.current = started.listenId;
      setListen(started);
    } catch (cause) {
      setError(errorMessage(cause, 'Could not start listening'));
    } finally {
      setStarting(false);
    }
  }, [workflowId, nodeId]);

  const stop = useCallback(async () => {
    const listenId = active.current;
    active.current = null;
    setListen(null);
    if (listenId) await triggerService.stopTestListen(listenId).catch(() => undefined);
  }, []);

  return { listen, error, starting, start, stop };
}
