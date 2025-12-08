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
    `ws://127.0.0.1:8001/ws/group/${userId}/${groupId}`
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

  let typingTimeout;

  function sendTypingStatus(isTyping) {
    chatSocket.send(
      JSON.stringify({
        type: "typing",
        is_typing: isTyping,
      })
    );
  }

  // Detect when user is typing
  messageInput.addEventListener("input", () => {
    sendTypingStatus(true);

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      sendTypingStatus(false);
    }, 1000); // stop typing if idle for 1.5s
  });

  function resend(tempId, item) {
    item.updateStatus("sending");

    chatSocket.send(JSON.stringify({
        type: "chat",
        message: item.dom.querySelector("p").textContent,
        temp_id: tempId,
        sender_id: userId
    }));
}


  // Create message container
 const createMessageElement = ({isCurrentUser, senderAvatar, message, tempId, status}) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex gap-2 mb-3 ${isCurrentUser ? "flex-row-reverse" : "justify-start"} ${status}`;
    messageDiv.id = `temp-${tempId}`;
    messageDiv.dataset.tempId = tempId;
    messageDiv.dataset.status = status;

    const timeDisplay = formatTime(Date.now());
    const statusSymbol = renderStatus(status) || renderStatus("pending");
    
    messageDiv.innerHTML = `
      <!-- Avatar -->
      <img
        src="${senderAvatar}" id="temp-${tempId}"
        alt="{{ message.sender.username }}"
        class="w-10 h-10 rounded-full object-cover flex-shrink-0"
        onerror="this.src='/static/images/default-avatar.jpg'"
      />

      <!-- Message Bubble -->  
      <div class="max-w-[65%] rounded-br-[40px] rounded-bl-[40px] px-5 py-2
          ${isCurrentUser ? "rounded-tl-[40px] rounded-tr-[6px] bg-[#005C4B]" : "rounded-tr-[40px] rounded-tl-[6px] bg-[#202C33]"}">
        <p class="text-[#E9EDEF]">${message}</p>
        <p class="text-xs text-[#8696A0] text-right mt-1">${timeDisplay}
            ${isCurrentUser ? `<span class="ml-1 font-bold text-md -tracking-[0.2em] status-indicator">${statusSymbol}</span>` : ""}
        </p>
      </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    // Return helper object for later UI updates
    return {
      element: messageDiv,
      updateStatus(newStatus) {
        const statusIndicator = messageDiv.querySelector('.status-indicator');
        if (statusIndicator) {
          statusIndicator.textContent = renderStatus(newStatus) || newStatus;
          // Use classList to toggle Tailwind class
          newStatus === 'delivered' ? statusIndicator.classList.add('text-[#34B7F1]') : statusIndicator.classList.remove('text-[#34B7F1]');
        }
        messageDiv.dataset.status = newStatus;
      },
      replaceWithConfirmed({ message_id, timestamp, message }) {
        messageDiv.dataset.messageId = message_id;
        messageDiv.querySelector("p").textContent = message;
        this.updateStatus("delivered");
      },
      showRetryButton() {
        const retryBtn = document.createElement("button");
        retryBtn.className = "ml-2 text-xs text-red-400 underline";
        retryBtn.textContent = "Retry";
        retryBtn.onclick = () => {
          const messageText = this.getElementText();
          // Implement retry logic here
          console.log("Retry sending:", messageText);
        };
        const timeContainer = messageDiv.querySelector('.flex.justify-between');
        if (timeContainer) {
          timeContainer.appendChild(retryBtn);
        }
      },
      getElementText() {
        return messageDiv.querySelector("p").textContent;
      }
    };
 };

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

            } else if (status === "delivered_to_recipient") {
                item.updateStatus("delivered");

            } else if (status === "failed") {
                item.updateStatus("failed");
                item.showRetryButton(() => resend(temp_id, item));
            }

            if (status === "delivered" || status === "failed") {
                delete pending[temp_id];
            }
            break;
        }

        // -------------------------------------------------------
        //  SYSTEM MESSAGE (BOT / SERVER NOTIFICATION)
        // -------------------------------------------------------
        case "system": {
            const tempId = data.temp_id || `rcv-${Date.now()}`;

            createMessageElement({
                isCurrentUser: false,
                senderAvatar: userAvatar,
                message: data.message,
                tempId,
                status: "delivered",
            });
            break;
        }

        // -------------------------------------------------------
        //  NORMAL CHAT MESSAGE
        // -------------------------------------------------------
        case "chat": {
            const isCurrentUser = Number(userId) === Number(data.sender_id);

            if (!isCurrentUser) {
                const tempId = data.temp_id || `rcv-${Date.now()}`;
                createMessageElement({
                    isCurrentUser,
                    senderAvatar: data.sender_avatar,
                    message: data.message,
                    tempId,
                    status: "received",
                });
            }

            scrollToBottom();
            break;
        }

        // -------------------------------------------------------
        //  TYPING INDICATOR
        // -------------------------------------------------------
        case "typing": {
            if (Number(data.user_id) === Number(userId)) return;

            const isTyping = data.is_typing;

            if (!typingIndicator) break;

            typingIndicator.style.transition = "opacity 0.2s ease-in-out";

            if (isTyping) {
                typingIndicator.textContent = "typing...";
                typingIndicator.style.opacity = "1";

            } else {
                typingIndicator.style.opacity = "0";
                setTimeout(() => {
                    typingIndicator.textContent = "online";
                    typingIndicator.style.opacity = "1";
                }, 200);
            }
            break;
        }

        // -------------------------------------------------------
        //  DEFAULT: No match
        // -------------------------------------------------------
        default:
            console.warn("Unknown WebSocket type:", data.type);
    }
};

   // WebSocket error handling
  chatSocket.onerror = (error) => {
    console.error('WebSocket error:', error);
    showNotification('Connection error', 'bg-red-500');
  };

  chatSocket.onclose = (event) => {
    console.log('WebSocket closed:', event);
    if (!event.wasClean) {
      showNotification('Connection lost. Reconnecting...', 'bg-yellow-500');
    }
  };

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
