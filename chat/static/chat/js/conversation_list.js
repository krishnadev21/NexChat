document.addEventListener('DOMContentLoaded', () => {
    const userSearch = document.getElementById('user-search');
    const userItems = document.querySelectorAll('.user-item');
    const notFoundMessage = document.getElementById('not-found-message');
    
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