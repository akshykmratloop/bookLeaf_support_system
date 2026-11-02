import {
  VOICE_SOCKET_PROTOCOL,
  VOICE_TICKET_PROTOCOL_PREFIX,
  type VoiceClientMessage,
} from '@bookleaf/shared';

/** The ticket rides as a subprotocol beside `bookleaf.v1`: never in the URL, so never logged. */
export const socketProtocols = (ticket?: string): string[] =>
  ticket
    ? [VOICE_SOCKET_PROTOCOL, `${VOICE_TICKET_PROTOCOL_PREFIX}${ticket}`]
    : [VOICE_SOCKET_PROTOCOL];

/** Sends a control message (hangup, mute) when the socket is open; otherwise there is no call. */
export function sendControl(ws: WebSocket | null, message: VoiceClientMessage): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}
