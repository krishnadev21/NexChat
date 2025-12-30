let presenceSocket = null;

export function initPresenceSocket(userId) {
    try {
        // Close existing socket if any
        if (presenceSocket) {
            presenceSocket.close();
        }
        
        presenceSocket = new WebSocket(
            `ws://127.0.0.1:8001/ws/presence/${userId}`
        );
        
        // Set up basic event handlers
        presenceSocket.onopen = () => {
            console.log("Presence WebSocket connected");
        };
        
        presenceSocket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
        
        presenceSocket.onclose = () => {
            console.log("WebSocket connection closed");
        };
        
    } catch (error) {
            console.error("Failed to create WebSocket:", error);
        return null;
    }
    
    return presenceSocket;
}

// Export socket for use elsewhere
export function getPresenceSocket() {
     return presenceSocket;
}