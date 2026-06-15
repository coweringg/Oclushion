(function () {
  const pages = document.querySelectorAll('.page');
  const navLinks = document.querySelectorAll('.nav-link');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');

  function showPage(pageId) {
    pages.forEach(function (p) {
      p.classList.add('hidden');
      p.classList.remove('active');
    });
    var target = document.getElementById('page-' + pageId);
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('active');
    }
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      navLinks.forEach(function (l) { l.classList.remove('active'); });
      link.classList.add('active');
      var page = link.getAttribute('data-page');
      showPage(page);
    });
  });

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value.trim();

    if (username === 'admin' && password === 'secret123') {
      showPage('dashboard');
      document.querySelector('.dashboard-title').textContent = 'Welcome, ' + username + '!';
      navLinks.forEach(function (l) { l.classList.remove('active'); });
      document.querySelector('.nav-link[data-page="dashboard"]').classList.add('active');
    } else {
      loginError.textContent = 'Invalid username or password';
      loginError.classList.remove('hidden');
    }
  });

  var canvas = document.getElementById('chart-canvas');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    var data = [65, 59, 80, 81, 56, 55, 40];
    var labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var barWidth = (canvas.width - 60) / data.length;
    var maxVal = Math.max.apply(null, data);

    ctx.fillStyle = '#4f46e5';
    data.forEach(function (val, i) {
      var barHeight = (val / maxVal) * (canvas.height - 40);
      ctx.fillRect(40 + i * barWidth, canvas.height - barHeight - 20, barWidth - 5, barHeight);
    });

    ctx.fillStyle = '#1e293b';
    ctx.font = '12px sans-serif';
    labels.forEach(function (label, i) {
      ctx.fillText(label, 40 + i * barWidth + 8, canvas.height - 5);
    });
  }

  var saveBtn = document.getElementById('save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      alert('Settings saved!');
    });
  }
})();
