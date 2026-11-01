import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage, triggerService } from '../services/trigger.service';
import { credentialKeys } from './useCredentials';

interface CallbackMessage {
  type?: unknown;
  status?: unknown;
  state?: unknown;
  code?: unknown;
  message?: unknown;
}

interface Waiting {
  state: string;
  origin: string;
}

// Connects an OAuth2 credential in a pop-up. The callback page posts
// { type: 'oauth2-callback', status, state, code | message } and closes; this
// window then completes the sign-in with its own login, so the tokens can only
// land in a credential of the user who started it.
export function useOAuth2Popup(onConnected?: (credentialId: string) => void) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waitingFor = useRef<Waiting | null>(null);

  useEffect(() => {
    const handle = (event: MessageEvent<CallbackMessage>) => {
      const waiting = waitingFor.current;
      // Only the callback page of the sign-in this window started.
      if (
        !waiting ||
        event.origin !== waiting.origin ||
        event.data?.type !== 'oauth2-callback' ||
        event.data.state !== waiting.state
      ) {
        return;
      }
      waitingFor.current = null;
      const { status, code, message } = event.data;
      if (status !== 'success' || typeof code !== 'string') {
        setPending(false);
        setError(typeof message === 'string' ? message : 'Sign-in failed');
        return;
      }
      triggerService
        .oauth2Complete(waiting.state, code)
        .then((credentialId) => {
          setError(null);
          void queryClient.invalidateQueries({ queryKey: credentialKeys.all });
          void queryClient.invalidateQueries({ queryKey: ['node-options'] });
          onConnected?.(credentialId);
        })
        .catch((cause: unknown) => {
          setError(errorMessage(cause, 'Connecting the account failed'));
        })
        .finally(() => setPending(false));
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [onConnected, queryClient]);

  const connect = useCallback(async (credentialId: string) => {
    setError(null);
    setPending(true);
    waitingFor.current = null;
    // Opened before the request so pop-up blockers allow it.
    const popup = window.open('', 'oauth2', 'width=600,height=700');
    try {
      const started = await triggerService.oauth2Start(credentialId);
      waitingFor.current = { state: started.state, origin: started.callbackOrigin };
      if (popup) popup.location.href = started.url;
      else window.open(started.url, 'oauth2', 'width=600,height=700');
      // Closing the pop-up without finishing must not leave the button waiting.
      const watch = window.setInterval(() => {
        if (!popup || popup.closed) {
          window.clearInterval(watch);
          // Still waiting for the callback: the user gave up.
          if (waitingFor.current?.state === started.state) setPending(false);
        }
      }, 500);
    } catch (cause) {
      popup?.close();
      waitingFor.current = null;
      setPending(false);
      setError(errorMessage(cause, 'Sign-in could not start'));
    }
  }, []);

  return { connect, pending, error };
}
