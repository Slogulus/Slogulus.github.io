
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  let navbarPath;

  if (currentPath.includes('/about') || currentPath.includes('/contact') || currentPath.includes('/projects') || currentPath.includes('/previous-work')) {
    navbarPath = '../navbar/navbar.html';
  } else {
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