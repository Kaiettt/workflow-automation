import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage, triggerService } from '../services/trigger.service';
import { credentialKeys } from './useCredentials';

interface CallbackMessage {
  type?: unknown;
  status?: unknown;
  credentialId?: unknown;
  message?: unknown;
}

// Connects an OAuth2 credential in a pop-up. The callback page posts
// { type: 'oauth2-callback', status, credentialId | message } and closes.
export function useOAuth2Popup(onConnected?: (credentialId: string) => void) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waitingFor = useRef<string | null>(null);

  useEffect(() => {
    const handle = (event: MessageEvent<CallbackMessage>) => {
      if (event.data?.type !== 'oauth2-callback' || !waitingFor.current) return;
      waitingFor.current = null;
      setPending(false);
      if (event.data.status === 'success' && typeof event.data.credentialId === 'string') {
        setError(null);
        void queryClient.invalidateQueries({ queryKey: credentialKeys.all });
        void queryClient.invalidateQueries({ queryKey: ['node-options'] });
        onConnected?.(event.data.credentialId);
      } else {
        setError(typeof event.data.message === 'string' ? event.data.message : 'Sign-in failed');
      }
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [onConnected, queryClient]);

  const connect = useCallback(async (credentialId: string) => {
    setError(null);
    setPending(true);
    waitingFor.current = credentialId;
    // Opened before the request so pop-up blockers allow it.
    const popup = window.open('', 'oauth2', 'width=600,height=700');
    try {
      const url = await triggerService.oauth2Url(credentialId);
      if (popup) popup.location.href = url;
      else window.open(url, 'oauth2', 'width=600,height=700');
      // Closing the pop-up without finishing must not leave the button waiting.
      const watch = window.setInterval(() => {
        if (!popup || popup.closed) {
          window.clearInterval(watch);
          setPending(false);
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
