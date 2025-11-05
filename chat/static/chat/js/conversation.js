document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const chatForm = document.getElementById("chat-form");
    const messagesContainer = document.getElementById("messages-container");
    const messageInput = document.getElementById("body");
    const typingIndicator = document.getElementById(`typing-indicator`);

    // Configuration Data
    const chatData = document.getElementById("chat-container").dataset;
    const userId = chatData.userId;
    const recipientAvatar = chatData.recipientAvatar;
    const recipientId = chatData.recipientId;
    const userAvatar = chatData.userAvatar;

    // Auto-scroll function
    const scrollToBottom = () => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    // Initial scroll to bottom when page loads
    scrollToBottom();

    // Web Socket Connection
    const chatSocket = new WebSocket(
        // `ws://${window.location.host}/ws/socket-server/${recipientId}`
        `ws://127.0.0.1:8001/ws/chat/${userId}/${recipientId}`
    );

    // Results: "5:45 pm", "11:30 am", "12:15 pm"
    function formatTime(timestamp) {
        return new Date(timestamp)
        .toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        })
        .toLowerCase();
    }

    let typingTimeout;

    function sendTypingStatus(isTyping) {
        chatSocket.send(JSON.stringify({
        type: "typing",
        is_typing: isTyping
        }));
    }

    // Detect when user is typing
    messageInput.addEventListener("input", () => {
        sendTypingStatus(true);

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
        sendTypingStatus(false);
        }, 1000); // stop typing if idle for 1.5s
    });

    // Past the chatForm function
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const messageInput = document.getElementById("body");
        const messageBody = messageInput.value.trim();

        if (!messageBody || !recipientId) return;

        try {
        chatSocket.send(JSON.stringify({ 
            type: "chat",
            message: messageBody
        }));
        messageInput.value = "";
        } catch (error) {
        console.error("Error:", error);
        // Show error notification
        showNotification(
            error.message || "Failed to send message",
            "bg-red-500"
        );
        }

        // Helper function to show notifications
        function showNotification(message, bgColor = "bg-blue-500") {
        const notification = document.createElement("div");
        notification.className = `fixed bottom-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg transition-opacity duration-300`;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = "0";
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        }
    });

    chatSocket.onmessage = (e) => {
        // Parse the received message
        const data = JSON.parse(e.data);

        if (data.type === "chat") {

        // Check if the message was sent by the current user
        const isCurrentUser = Number(userId) === Number(data.sender_id);

        // Optimistic UI update helpers
        const tempId = Date.now();
        const displayTime = formatTime(tempId);

        messagesContainer.innerHTML += `
            <div class="flex gap-2 mb-3 ${isCurrentUser ? "flex-row-reverse" : "justify-start"}" id="temp-${tempId}">
            <!-- Avatar -->
            <img
                src="${isCurrentUser ? userAvatar : recipientAvatar}" id="temp-${tempId}"
                alt="{{ message.sender.username }}"
                class="w-10 h-10 rounded-full object-cover flex-shrink-0"
                onerror="this.src='/static/images/default-avatar.jpg'"
            />

            <!-- Message Bubble -->
            <div class="max-w-[65%] rounded-br-[30px] rounded-bl-[30px] p-3
                ${isCurrentUser ? "rounded-tl-[30px] bg-[#005C4B]" : "rounded-tr-[30px] bg-[#202C33]"}">
                <p class="text-[#E9EDEF]">${data.message}</p>
                <p class="text-xs text-[#8696A0] text-right mt-1">${formatTime(tempId)}
                    ${isCurrentUser ? '<span class="ml-1">✓</span>' : "" } <!-- Only show check for own messages -->
                </p>
            </div>
            </div>
            `;

        // Scroll after new message is added
        scrollToBottom();
        }

        if (data.type === "typing") {
        // Ignore if the current user is the one typing
        if (Number(data.user_id) === Number(userId)) return;

        // const userId = data.user_id;
        const isTyping = data.is_typing;

        if (typingIndicator) {
            typingIndicator.style.transition = 'opacity 0.2s ease-in-out';
            
            if (isTyping) {
            // Fade in "typing..."
            typingIndicator.textContent = "typing...";
            typingIndicator.style.opacity = '1';
            } else {
            // Fade out → Update → Fade in
            typingIndicator.style.opacity = '0';
            
            setTimeout(() => {
                typingIndicator.textContent = "online";
                typingIndicator.style.opacity = '1';
            }, 200);
            }
        }
        }
    };

    // Focus input when chat is opened
    if (document.getElementById("body")) {
        document.getElementById("body").focus();
    }
});
