async function fetchAndDisplay(url, containerId) {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();

    let html = '';
    // Simple generic rendering (customize per endpoint)
    if (Array.isArray(data)) {
      data.forEach(item => {
        html += `<div>${JSON.stringify(item)}</div>`;
      });
    } else {
      html = JSON.stringify(data);
    }

    document.getElementById(containerId).innerHTML = html;
  } catch (error) {
    console.error(`Error loading ${containerId}:`, error);
    document.getElementById(containerId).innerHTML = '<p>Failed to load data</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchAndDisplay('/api/tourist/purchases', 'purchaseHistory');
  fetchAndDisplay('/api/tourist/saved-itineraries', 'savedItineraries');
  fetchAndDisplay('/api/tourist/bookings', 'bookingsHistory');
  fetchAndDisplay('/api/tourist/wishlist', 'wishlist');
  fetchAndDisplay('/api/tourist/community-posts', 'communityPosts');
});
