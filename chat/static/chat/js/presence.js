let presenceSocket = null;
const listeners = new Set();

export function initPresenceSocket(userId) {
    if (presenceSocket) return presenceSocket;

    presenceSocket = new WebSocket(
        `ws://127.0.0.1:8001/ws/presence/${userId}`
    );

    presenceSocket.onopen = () => {
        console.log("Presence WebSocket connected");
    };

    presenceSocket.onerror = (error) => {
        console.error("Presence WebSocket error:", error);
    };

    presenceSocket.onclose = () => {
        console.log("Presence WebSocket closed");
        presenceSocket = null;
    };

    // ✅ CENTRAL DISPATCHER
    presenceSocket.onmessage = (event) => {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch {
            return;
        }

        console.log(listeners);
        
        listeners.forEach(cb => cb(data));
    };

    return presenceSocket;
}

// ✅ Subscribe safely
export function onPresenceUpdate(callback) {
    listeners.add(callback);
    console.log(listeners);

    // Optional cleanup
    return () => listeners.delete(callback);
}
