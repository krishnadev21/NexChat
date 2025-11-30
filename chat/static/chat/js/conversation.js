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

  const tickSymbols = {
    pending: "⏲",
    received_by_server: "🗸",  // Use the character directly
    sent: "🗸",               // alias
    delivered_to_recipient: "🗸🗸", // Remove space between them
    delivered: "🗸🗸",        // alias
    failed: "⚠"
};


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

  // Create message container
 const createMessageElement = ({isCurrentUser, message, tempId, status}) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex gap-2 mb-3 ${isCurrentUser ? "flex-row-reverse" : "justify-start"} ${status}`;
    messageDiv.id = `temp-${tempId}`;
    messageDiv.dataset.tempId = tempId;
    messageDiv.dataset.status = status;

    const timeDisplay = formatTime(Date.now());
    const statusSymbol = tickSymbols[status] || tickSymbols.pending;
    
    messageDiv.innerHTML = `
      <!-- Avatar -->
      <img
        src="${isCurrentUser ? userAvatar : recipientAvatar}" id="temp-${tempId}"
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
          statusIndicator.textContent = tickSymbols[newStatus] || newStatus;
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
    // Parse the received message
    const data = JSON.parse(e.data);

    if (data.type === "receipt") {
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

      // Remove from pending if final status
      if (status === "delivered" || status === "failed") {
        delete pending[temp_id];
      }
    }

    if (data.type === "chat") {
      // Check if the message was sent by the current user
      const isCurrentUser = Number(userId) === Number(data.sender_id);

      // Only create message element for messages from others
      // or for confirmed messages from self
      if (!isCurrentUser) { // || data.temp_id
        const tempId = data.temp_id || `rcv-${Date.now()}`;
        createMessageElement({
          isCurrentUser,
          message: data.message,
          tempId: tempId,
          status: isCurrentUser ? "delivered" : "received"
        });
      }

      // Optimistic UI update helpers
      // const tempId = Date.now();
      // const displayTime = formatTime(tempId);

      // const dom = createMessageElement({isCurrentUser, message: data.message, temp_id: tempId, status: "print"});
      
      // Scroll after new message is added
      scrollToBottom();
    }

    if (data.type === "typing") {
      // Ignore if the current user is the one typing
      if (Number(data.user_id) === Number(userId)) return;

      // const userId = data.user_id;
      const isTyping = data.is_typing;

      if (typingIndicator) {
        typingIndicator.style.transition = "opacity 0.2s ease-in-out";

        if (isTyping) {
          // Fade in "typing..."
          typingIndicator.textContent = "typing...";
          typingIndicator.style.opacity = "1";
        } else {
          // Fade out → Update → Fade in
          typingIndicator.style.opacity = "0";

          setTimeout(() => {
            typingIndicator.textContent = "online";
            typingIndicator.style.opacity = "1";
          }, 200);
        }
      }
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

    if (!messageBody || !recipientId) return;

    const temp_id = "tmp-" + Date.now() + "-" + Math.random().toString(36).slice(2,8);
    // render optimistic message in UI with status "pending"
    // const domItem = renderPendingMessage({ isCurrentUser: true, message: messageBody, temp_id, status: "pending" });
    const domItem = createMessageElement({ isCurrentUser: true, message: messageBody, tempId: temp_id, status: "pending" });
    pending[temp_id] = domItem;

    try {
      chatSocket.send(
        JSON.stringify({
          type: "chat",
          temp_id,
          message: messageBody,
          sender_id: userId,
          recipient_id: recipientId
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
