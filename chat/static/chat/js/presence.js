let presenceSocket = null;
let currentUserId = null;
const listeners = new Set();
let heartbeatInterval = null;
let clientId = null;

export function initPresenceSocket(userId) {
    if (presenceSocket && currentUserId === userId && clientId) {
        return presenceSocket;
    }

    // Close old socket if exists
    if (presenceSocket) {
        presenceSocket.close();
        presenceSocket = null;
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    currentUserId = userId;
    
    // Generate or reuse client ID
    if (!clientId) {
        clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Store in sessionStorage for persistence across page reloads
        sessionStorage.setItem('presence_client_id', clientId);
    } else {
        clientId = sessionStorage.getItem('presence_client_id') || clientId;
    }

    const wsUrl = `ws://127.0.0.1:8001/ws/presence/${userId}`;
    console.log(`Connecting presence socket for user ${userId}, client ${clientId} at ${Date.now()}`);
    
    presenceSocket = new WebSocket(wsUrl);

    presenceSocket.onopen = () => {
        console.log(`Presence socket connected for user ${userId}`);
        
        // Send connection metadata
        presenceSocket.send(JSON.stringify({
            type: 'connection_metadata',
            client_id: clientId,
            timestamp: Date.now()
        }));
        
        // Start heartbeat
        heartbeatInterval = setInterval(() => {
            if (presenceSocket && presenceSocket.readyState === WebSocket.OPEN) {
                presenceSocket.send(JSON.stringify({
                    type: 'heartbeat',
                    client_id: clientId,
                    timestamp: Date.now()
                }));
            }
        }, 25000); // Every 25 seconds
    };

    presenceSocket.onmessage = (event) => {
        let data;
        try {
            data = JSON.parse(event.data);
            console.log('Presence update received:', data, Date.now());
        } catch (e) {
            console.error('Failed to parse presence update:', e)
            return;
        }
        listeners.forEach(cb => cb(data));
    };

    presenceSocket.onclose = () => {
        console.log(`Presence socket closed for user ${userId}`);
        presenceSocket = null;
        currentUserId = null;
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    };

    presenceSocket.onerror = (error) => {
        console.error('Presence socket error:', error);
    };

    // // Handle page visibility changes
    // document.addEventListener('visibilitychange', () => {
    //     if (presenceSocket && presenceSocket.readyState === WebSocket.OPEN) {
    //         presenceSocket.send(JSON.stringify({
    //             type: 'visibility_change',
    //             is_visible: !document.hidden,
    //             client_id: clientId,
    //             timestamp: Date.now()
    //         }));
    //     }
    // });

    // // Handle page unload
    // window.addEventListener('beforeunload', () => {
    //     if (presenceSocket && presenceSocket.readyState === WebSocket.OPEN) {
    //         // Send quick unload notification
    //         try {
    //             presenceSocket.send(JSON.stringify({
    //                 type: 'visibility_change',
    //                 is_visible: false,
    //                 client_id: clientId,
    //                 timestamp: Date.now()
    //             }));
    //         } catch (e) {
    //             // Ignore errors during unload
    //         }
    //     }
    // });

    return presenceSocket;
}

export function onPresenceUpdate(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

export function getClientId() {
    return clientId;
}