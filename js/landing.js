// Landing Page Interactions

document.addEventListener('DOMContentLoaded', () => {
  // Handle "Join the Hearth" button clicks
  const joinButtons = document.querySelectorAll('#join-btn, #cta-join-btn');
  
  joinButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Navigate to onboarding
      window.location.href = 'onboarding.html';
    });
  });

  // Sample toggle interaction on design preview
  const sampleToggle = document.getElementById('sample-toggle');
  if (sampleToggle) {
    sampleToggle.addEventListener('change', (e) => {
      console.log('Toggle state:', e.target.checked);
    });
  }

  // Add smooth entrance animations
  const observeElements = document.querySelectorAll('.rule-card, .feature-item');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, {
    threshold: 0.1
  });

  observeElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
});
