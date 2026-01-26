import { initPresenceSocket, onPresenceUpdate } from "./presence.js";

document.addEventListener("DOMContentLoaded", async () => {
    const userSearch = document.getElementById("user-search");
    const userItems = document.querySelectorAll(".user-item");
    const notFoundMessage = document.getElementById("not-found-message");

    // 🔹 Logged-in user
    const chatData = document.getElementById("conversations-list-container").dataset;
    const userId = chatData.userId;

    // 🔹 All conversation partner IDs
    const userIds = Array.from(document.querySelectorAll(".user-item"))
        .map(item => String(item.dataset.userId))
        .filter(Boolean);

    // 🔌 Init presence socket ONCE
    // initPresenceSocket(userId);

    // 📡 Fetch initial presence snapshot
    async function fetchUsersPresence(userIds) {
        console.log(`Initial Presence Called ${Date.now()}`);
        
        const res = await fetch("http://127.0.0.1:8001/users/presence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_ids: userIds })
        });

        const data = await res.json();
        console.log("Initial presence:", data, Date.now());
        return data;
    }

    // ✅ IMPORTANT: await here
    const presenceMap = await fetchUsersPresence(userIds);

    // 🎯 Apply initial presence UI
    userIds.forEach(id => {
        const info = presenceMap[String(id)];
        
        if (!info) return;

        const row = document.querySelector(`[data-user-id="${id}"]`);

        if (!row) return;

        const badge = row.querySelector(".presence-dot");
        
        if (!badge) return;

        if (info.status === "online") {
            badge.classList.remove("bg-gray-400");
            badge.classList.add("bg-green-500");
        } else {
            badge.classList.remove("bg-green-500");
            badge.classList.add("bg-gray-400");
        }
    });

    // 🔌 Init presence socket ONCE
    initPresenceSocket(userId);

    onPresenceUpdate((data) => {
        if (data.type !== "presence") return;

        console.log(data);

        const dot = document.querySelector(
            `.presence-dot[data-user-id="${data.user_id}"]`
        );
        if (!dot) return;

        dot.classList.toggle("bg-green-500", data.status === "online");
        dot.classList.toggle("bg-gray-400", data.status !== "online");
    });
    
    // Initially hide the not found message
    notFoundMessage.style.display = 'none';
    
    // Search functionality
    userSearch.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    let foundCount = 0;
    
    userItems.forEach(item => {
        const username = item.querySelector('.username').textContent.toLowerCase();
        if (username.includes(searchTerm)) {
            item.style.display = '';
            foundCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    // Show not found message if no users match the search
    if (foundCount === 0 && searchTerm.length > 0) {
        notFoundMessage.textContent = `No users found for '${userSearch.value}'`
        notFoundMessage.style.display = '';
    } else {
        notFoundMessage.style.display = 'none';
    }
    
    // If search is empty, ensure not found message is hidden
    if (searchTerm.length === 0) {
        notFoundMessage.textContent = ''
        notFoundMessage.style.display = 'none';
    }
    });
});
