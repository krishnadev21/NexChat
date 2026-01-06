let presenceSocket = null;
let currentUserId = null;
const listeners = new Set();

export function initPresenceSocket(userId) {
    // 🔥 IMPORTANT FIX
    if (presenceSocket && currentUserId === userId) {
        return presenceSocket;
    }

    // If user changes, close old socket
    if (presenceSocket) {
        presenceSocket.close();
        presenceSocket = null;
    }

    currentUserId = userId;

    console.log(`---------------------------------------------------------------------------${currentUserId}`);
    presenceSocket = new WebSocket(
        `ws://127.0.0.1:8001/ws/presence/${userId}`
    );

    presenceSocket.onmessage = (event) => {
        let data;
        try {
            data = JSON.parse(event.data);
            console.log(data);
        } catch {
            return;
        }
        listeners.forEach(cb => cb(data));
    };

    presenceSocket.onclose = () => {
        presenceSocket = null;
        currentUserId = null;
    };

    return presenceSocket;
}

export function onPresenceUpdate(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
