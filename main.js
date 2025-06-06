const DEFAULT_EMAIL = 'admin@karaoke.jp';
const DEFAULT_PASSWORD = '12345678';

document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem('email')) {
    localStorage.setItem('email', DEFAULT_EMAIL);
    localStorage.setItem('password', DEFAULT_PASSWORD);
  }

  const form = document.getElementById('login-form');
  const errorMessage = document.getElementById('error-message');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const storedEmail = localStorage.getItem('email');
    const storedPassword = localStorage.getItem('password');

    if (email === storedEmail && password === storedPassword) {
      window.location.href = 'main.html';
    } else {
      errorMessage.textContent = "メールアドレスまたはパスワードが正しくありません";
    }
  });
});
