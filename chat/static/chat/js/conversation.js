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
    pending: "●",         // waiting (optimistic)
    received_by_server: "✓", 
    sent: "✓",            // alias
    delivered_to_recipient: "✓✓",
    delivered: "✓✓",      // alias
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
    
    messageDiv.innerHTML = `
      <img
        src="${isCurrentUser ? userAvatar : recipientAvatar}"
        alt="${isCurrentUser ? 'You' : 'Recipient'}"
        class="w-10 h-10 rounded-full object-cover flex-shrink-0"
        onerror="this.src='/static/images/default-avatar.jpg'"
      />
      <div class="max-w-[65%] rounded-br-[30px] rounded-bl-[30px] p-3
          ${isCurrentUser ? "rounded-tl-[30px] bg-[#005C4B]" : "rounded-tr-[30px] bg-[#202C33]"}">
        <p class="text-[#E9EDEF]">${message}</p>
        <p class="text-xs text-[#8696A0] text-right mt-1">${formatTime(tempId)}
            ${isCurrentUser ? '<span class="ml-1 status"></span>' : ""}
        </p>
      </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    // Return helper object for later UI updates
    return {
      messageDiv,
      updateStatus(newStatus) {
        messageDiv.classList.remove("pending", "failed", "sent", "delivered");
        messageDiv.classList.add(newStatus);
        messageDiv.querySelector(".status").textContent = tickSymbols[newStatus];
      },
      replaceWithConfirmed({ message_id, timestamp, message }) {
        messageDiv.dataset.messageId = message_id;
        messageDiv.querySelector("p").textContent = message;
        messageDiv.querySelector(".status").textContent = "delivered";
        messageDiv.classList.remove("pending");
        messageDiv.classList.add("delivered");
      },
      showRetryButton(callback) {
        const btn = document.createElement("button");
        btn.textContent = "Retry";
        btn.onclick = callback;
        messageDiv.appendChild(btn);
      },
      getText() {
        return el.querySelector("p").textContent;
      },
    };
 };

// function renderPendingMessage({ temp_id, message, status }) {
//   const el = document.createElement("div");
//   el.className = `message ${status}`;
//   el.dataset.tempId = temp_id;
//   el.innerHTML = `
//     <p class="text-white">${message}</p>
//     <span class="text-white status">${status}</span>
//   `;
//   messagesContainer.appendChild(el);

//   // Return helper object for later UI updates
//   return {
//     el,
//     updateStatus(newStatus) {
//       el.classList.remove("pending", "failed", "sent", "delivered");
//       el.classList.add(newStatus);
//       el.querySelector(".status").textContent = newStatus;
//     },
//     replaceWithConfirmed({ message_id, timestamp, message }) {
//       el.dataset.messageId = message_id;
//       el.querySelector("p").textContent = message;
//       el.querySelector(".status").textContent = "delivered";
//       el.classList.remove("pending");
//       el.classList.add("delivered");
//     },
//     showRetryButton(callback) {
//       const btn = document.createElement("button");
//       btn.textContent = "Retry";
//       btn.onclick = callback;
//       el.appendChild(btn);
//     },
//     getText() {
//       return el.querySelector("p").textContent;
//     },
//   };
// }


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
    }


    if (data.type === "chat") {
      // Check if the message was sent by the current user
      const isCurrentUser = Number(userId) === Number(data.sender_id);

      // Optimistic UI update helpers
      const tempId = Date.now();
      const displayTime = formatTime(tempId);

      // const dom = createMessageElement({isCurrentUser, message: data.message, temp_id: tempId, status: "print"});
      // console.log(typeof(dom));
      
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
        })
      );
      messageInput.value = "";
    } catch (error) {
        console.error("Error:", error);
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
