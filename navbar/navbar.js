
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  let navbarPath;
  
  // If we're in a subfolder like /artem/, /ken/, /matt/, /mike/, or /paul/, go up one level
  if (
    currentPath.includes('/artem/') ||
    currentPath.includes('/ken/') ||
    currentPath.includes('/matt/') ||
    currentPath.includes('/mike/') ||
    currentPath.includes('/paul/')
  ) {
    navbarPath = '../../navbar/navbar.html';
  }
  else {
    navbarPath = 'navbar/navbar.html';
  }

  fetch(navbarPath)
    .then(response => response.text())
    .then(data => {
      const navbarPlaceholder = document.getElementById('navbar-placeholder');
      if (navbarPlaceholder) {
        navbarPlaceholder.innerHTML = data;

        const homeLink = document.getElementById('home-link');
        const currentPage = window.location.pathname;

        if (currentPage.endsWith('index.html') || currentPage === '/') {
          homeLink.style.display = 'none';
        }
      } else {
        console.error('Navbar placeholder element not found');
      }
    })
    .catch(error => console.error('Error loading navbar:', error));
});