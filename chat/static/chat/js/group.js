document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const chatForm = document.getElementById("chat-form");
  const messagesContainer = document.getElementById("messages-container");

  // Configuration Data
  const chatData = document.getElementById("chat-container").dataset;
  const groupId = chatData.groupId;

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  scrollToBottom();

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const messageInput = document.getElementById("body");
    const messageBody = messageInput.value.trim();

    if (!messageBody) return;

    const csrfToken = document.querySelector(
      "[name=csrfmiddlewaretoken]"
    ).value;

    try {
      // Optimistic UI update
      const tempId = Date.now();
      messagesContainer.innerHTML += `
          <div class="flex justify-end" id="temp-${tempId}">
              <div class="max-w-[65%] rounded-lg p-3 bg-[#005C4B]">
              <p class="text-[#E9EDEF]">${messageBody}</p>
              <p class="text-xs text-[#8696A0] text-right mt-1">
                  Just now
                  <span class="ml-1">✓</span>
              </p>
              </div>
          </div>
          `;
      scrollToBottom();
      messageInput.value = "";

      const response = await fetch(`/chat/group/${groupId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRFToken": csrfToken,
        },
        body: new URLSearchParams({
          
          body: messageBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send message");
      }

      // Show success notification
      showNotification(`${data.message}`, "bg-green-500");

      // Update message status if needed (e.g., change ✓ to ✓✓ when read)
      // const tempElement = document.getElementById(`temp-${tempId}`);
      // if (tempElement && data.message_id) {
      //   tempElement.dataset.messageId = data.message_id;
      //   // You could update the checkmark status here if you get read status from server
      // }
    } catch (error) {
      console.error("Error:", error);
      // Show error notification
      showNotification(
        error.message || "Failed to send message",
        "bg-red-500"
      );

      // Optionally remove the temporary message if sending failed
      // const tempElement = document.getElementById(`temp-${tempId}`);
      // if (tempElement) tempElement.remove();
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