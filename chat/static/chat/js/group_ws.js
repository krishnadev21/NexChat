document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const chatForm = document.getElementById("chat-form");
    const messagesContainer = document.getElementById("messages-container");
    const messageInput = document.getElementById("body");
    const typingIndicator = document.getElementById(`typing-indicator`);

    // Configuration Data
    const chatData = document.getElementById("chat-container").dataset;
    const groupId = chatData.groupId;
    const userId = chatData.userId;
    const userAvatar = chatData.userAvatar;
    const participantIds = JSON.parse(chatData.participantIds).join(",");

    function renderStatus(status) {
        switch (status) {
            case "pending": return "⚠";
            case "sent": return "🗸";
            case "delivered": return "🗸🗸";
            case "read": return `<span class='blue'>🗸🗸</span>`;
            case "failed": return "❌";
            default: return "";
        }
    }

    // Auto-scroll function
    const scrollToBottom = () => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    // Initial scroll to bottom when page loads
    scrollToBottom();

    // Web Socket Connection
    const chatSocket = new WebSocket(
        `ws://127.0.0.1:8001/ws/group/${userId}/${groupId}/${participantIds}`
    );

    // In-memory map for pending messages
    const pending = {}; // temp_id -> DOM element or data

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

    function createTypingIndicator() {
        const wrapper = document.createElement("div");
        wrapper.id = "typing-indicator";
        wrapper.className = "flex w-full gap-2 mb-3 justify-start";

        wrapper.innerHTML = `
        <img
            src="/media/default.jpg"
            class="w-8 h-8 rounded-full object-cover"
        />

        <div class="bg-[#202C33] rounded-2xl px-4 py-2 flex items-center gap-1">
            <span class="text-sm text-[#8696A0] mr-1">typing</span>
            <span class="flex gap-1">
            <span class="w-1.5 h-1.5 bg-[#8696A0] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span class="w-1.5 h-1.5 bg-[#8696A0] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span class="w-1.5 h-1.5 bg-[#8696A0] rounded-full animate-bounce"></span>
            </span>
        </div>
        `;

        return wrapper;
    }
    
    let typingTimeout;

    function sendTypingStatus(isTyping) {
        chatSocket.send(
            JSON.stringify({
                type: "typing",
                is_typing: isTyping,
            })
        );
    }

    function showTypingIndicator() {
        if (document.getElementById("typing-indicator")) return;
        
        const indicator = createTypingIndicator();
        messagesContainer.appendChild(indicator);
        scrollToBottom();
    }

    function hideTypingIndicator() {
        const indicator = document.getElementById("typing-indicator");
        if (indicator) indicator.remove();
    } 
    
    // Detect when user is typing
    messageInput.addEventListener("input", () => {
        sendTypingStatus(true);

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            sendTypingStatus(false);
        }, 1000); // stop typing if idle for 1.5s
    });

    // Resend Fumctionality
    function resend(tempId, item) {
        item.updateStatus("sending");
        chatSocket.send(JSON.stringify({
            type: "chat",
            message: item.dom.querySelector("p").textContent,
            temp_id: tempId,
            sender_id: userId,
            is_retry: true // Add flag to identify retry messages
        }));
    }

    // Create message container with enhanced retry logic
    const createMessageElement = ({isCurrentUser, senderAvatar, message, tempId, status}) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex gap-2 mb-3 ${isCurrentUser ? "flex-row-reverse" : "justify-start"} ${status}`;
        messageDiv.id = `temp-${tempId}`;
        messageDiv.dataset.tempId = tempId;
        messageDiv.dataset.status = status;

        const timeDisplay = formatTime(Date.now());
        const statusSymbol = renderStatus(status) || renderStatus("pending");
        
        // Create time and status container
        const timeStatusContainer = document.createElement('div');
        timeStatusContainer.className = "flex items-center justify-end gap-2 mt-1";
        
        // Time element
        const timeElement = document.createElement('span');
        timeElement.className = "text-xs text-[#8696A0]";
        timeElement.textContent = timeDisplay;
        
        // Status indicator (only for current user)
        let statusElement = null;
        if (isCurrentUser) {
            statusElement = document.createElement('span');
            statusElement.className = "ml-1 font-bold text-md -tracking-[0.2em] status-indicator";
            statusElement.textContent = statusSymbol;
            if (status === 'delivered') {
                statusElement.classList.add('text-[#34B7F1]');
            }
        }
        
        messageDiv.innerHTML = `
        <!-- Avatar -->
        <img
            src="${senderAvatar}"
            alt="User avatar"
            class="w-10 h-10 rounded-full object-cover flex-shrink-0"
            onerror="this.src='/static/images/default-avatar.jpg'"
        />

        <!-- Message Bubble -->  
        <div class="max-w-[65%] rounded-br-[40px] rounded-bl-[40px] px-5 py-2
            ${isCurrentUser ? "rounded-tl-[40px] rounded-tr-[6px] bg-[#005C4B]" : "rounded-tr-[40px] rounded-tl-[6px] bg-[#202C33]"}">
            <p class="text-[#E9EDEF]">${message}</p>
        </div>
        `;
        
        // Append time and status container to message bubble
        const messageBubble = messageDiv.querySelector('div');
        messageBubble.appendChild(timeStatusContainer);
        timeStatusContainer.appendChild(timeElement);
        
        if (statusElement) {
            timeStatusContainer.appendChild(statusElement);
        }
        
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();

        // Create the helper object
        const messageObj = {
            element: messageDiv,
            dom: messageDiv, // Add dom property for compatibility with resend function
            updateStatus(newStatus) {
                const statusIndicator = messageDiv.querySelector('.status-indicator');
                if (statusIndicator) {
                    statusIndicator.textContent = renderStatus(newStatus) || newStatus;
                    // Update color based on status
                    if (newStatus === 'delivered') {
                        statusIndicator.classList.add('text-[#34B7F1]');
                    } else {
                        statusIndicator.classList.remove('text-[#34B7F1]');
                    }
                }
                messageDiv.dataset.status = newStatus;
                
                // Remove retry button if status is no longer failed
                if (newStatus !== 'failed') {
                    this.removeRetryButton();
                }
            },
            replaceWithConfirmed({ message_id, timestamp, message }) {
                messageDiv.dataset.messageId = message_id;
                messageDiv.querySelector("p").textContent = message;
                this.updateStatus("delivered");
            },
            showRetryButton() {
                // Don't add multiple retry buttons
                if (messageDiv.querySelector('.retry-button')) return;
                
                const retryBtn = document.createElement("button");
                retryBtn.className = "retry-button text-xs text-red-400 underline hover:text-red-300 transition-colors";
                retryBtn.textContent = "Retry";
                retryBtn.onclick = () => {
                    resend(tempId, messageObj);
                    this.removeRetryButton();
                };
                
                const timeContainer = messageDiv.querySelector('.flex.items-center');
                if (timeContainer) {
                    timeContainer.appendChild(retryBtn);
                }
            },
            removeRetryButton() {
                const retryBtn = messageDiv.querySelector('.retry-button');
                if (retryBtn) {
                    retryBtn.remove();
                }
            },
            getElementText() {
                return messageDiv.querySelector("p").textContent;
            }
        };
        
        // Store in pending messages if it's a current user message with pending status
        if (isCurrentUser && (status === 'pending' || status === 'sending' || status === 'failed')) {
            pending[tempId] = messageObj;
        }
        
        return messageObj;
    };

    // Enhanced WebSocket message handler with retry support
    chatSocket.onmessage = (e) => {
        const data = JSON.parse(e.data);

        switch (data.type) {
            // -------------------------------------------------------
            //  MESSAGE RECEIPT / DELIVERY STATUS
            // -------------------------------------------------------
            case "receipt": {
                const { temp_id, status } = data;
                const item = pending[temp_id];
                if (!item) return;

                if (status === "received_by_server") {
                    item.updateStatus("sent");

                } else if (status === "delivered_to_recipients") {
                    item.updateStatus("delivered");

                } else if (status === "failed") {
                    item.updateStatus("failed");
                    item.showRetryButton();
                    
                    // Schedule auto-retry after 5 seconds if still failed
                    // setTimeout(() => {
                    //     if (pending[temp_id] && item.element.dataset.status === 'failed') {
                    //         console.log(`Auto-retrying message ${temp_id}`);
                    //         resend(temp_id, item);
                    //     }
                    // }, 5000);
                }

                if (status === "delivered" || status === "failed") {
                    delete pending[temp_id];
                }
                break;
            }

            // -------------------------------------------------------
            //  NORMAL CHAT MESSAGE (with retry handling)
            // -------------------------------------------------------
            case "chat": {
                const isCurrentUser = Number(userId) === Number(data.sender_id);

                // Handle incoming messages
                if (!isCurrentUser) {
                    const tempId = data.temp_id || `rcv-${Date.now()}`;
                    createMessageElement({
                        tempId,
                        isCurrentUser,
                        senderAvatar: data.sender_avatar,
                        message: data.message,
                        status: "received",
                    });
                    
                    // Send delivery receipt for received messages
                    if (data.temp_id && !data.is_retry) {
                        chatSocket.send(JSON.stringify({
                            type: "receipt",
                            temp_id: data.temp_id,
                            status: "delivered_to_recipient",
                            recipient_id: data.sender_id
                        }));
                    }
                } 
                // Handle our own messages (for retry confirmation)
                else if (data.is_retry && data.temp_id) {
                    const item = pending[data.temp_id];
                    if (item) {
                        item.updateStatus("sending");
                        
                        // Remove the retry button if it exists
                        item.removeRetryButton();
                        
                        // Mark as re-sent
                        console.log(`Message ${data.temp_id} re-sent`);
                    }
                }

                scrollToBottom();
                break;
            }

            // -------------------------------------------------------
            //  SYSTEM MESSAGE (BOT / SERVER NOTIFICATION)
            // -------------------------------------------------------
            case "system": {
                const tempId = data.temp_id || `rcv-${Date.now()}`;
                createMessageElement({
                    tempId,
                    isCurrentUser: false,
                    senderAvatar: userAvatar,
                    message: data.message,
                    status: "delivered",
                });
                break;
            }

            // -------------------------------------------------------
            //  TYPING INDICATOR
            // -------------------------------------------------------
            case "typing": {
                if (Number(data.user_id) === Number(userId)) return;

                showTypingIndicator();

                    clearTimeout(window.typingTimeout);
                    window.typingTimeout = setTimeout(() => {
                    hideTypingIndicator();
                    }, 1200);
                break;
            }

            // -------------------------------------------------------
            //  DEFAULT: No match
            // -------------------------------------------------------
            default:
                console.warn("Unknown WebSocket type:", data.type);
        }
    };

    // Handle WebSocket connection errors and retry logic
    chatSocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        
        // Mark all pending messages as failed
        Object.keys(pending).forEach(tempId => {
            const item = pending[tempId];
            if (item && item.element.dataset.status !== 'delivered') {
                item.updateStatus("failed");
                item.showRetryButton();
            }
        });
    };

    chatSocket.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        
        // Attempt to reconnect
        setTimeout(() => {
            console.log("Attempting to reconnect...");
            connectWebSocket(); // You'll need to implement this function
        }, 3000);
    };

    // Helper function to connect WebSocket
    function connectWebSocket() {
        // Implement your WebSocket connection logic here
        //
    }

    // Past the chatForm function
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const messageInput = document.getElementById("body");
        const messageBody = messageInput.value.trim();

        if (!messageBody) return;

        const temp_id = "tmp-" + Date.now() + "-" + Math.random().toString(36).slice(2,8);
        // Optimistic UI with status "pending"
        const domItem = createMessageElement({ isCurrentUser: true, senderAvatar: userAvatar, message: messageBody, tempId: temp_id, status: "pending" });
        pending[temp_id] = domItem;

        try {
            chatSocket.send(
            JSON.stringify({
                type: "chat",
                temp_id,
                message: messageBody,
                sender_id: userId,
                sender_avatar: userAvatar
            })
            );
            messageInput.value = "";
        } catch (error) {
            console.error("Error sending message:", error);
            domItem.updateStatus("failed");
            domItem.showRetryButton();
            // Show error notification
            showNotification(error.message || "Failed to send message", "bg-red-500");
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

    // Focus input when chat is opened
    if (document.getElementById("body")) {
        document.getElementById("body").focus();
    }
});
