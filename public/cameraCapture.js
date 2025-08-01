document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('video');
  const captureBtn = document.getElementById('captureBtn');
  const retakeBtn = document.getElementById('retakeBtn');
  const canvas = document.getElementById('canvas');
  const capturedPhoto = document.getElementById('capturedPhoto');
  const photoDataInput = document.getElementById('photoData');

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Tidak dapat mengakses kamera. Pastikan kamera terhubung dan izinkan akses.');
    }
  }

  captureBtn.addEventListener('click', () => {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    capturedPhoto.src = dataUrl;
    capturedPhoto.classList.remove('hidden');
    video.classList.add('hidden');
    captureBtn.classList.add('hidden');
    retakeBtn.classList.remove('hidden');
    photoDataInput.value = dataUrl;
  });

  retakeBtn.addEventListener('click', () => {
    capturedPhoto.src = '';
    capturedPhoto.classList.add('hidden');
    video.classList.remove('hidden');
    captureBtn.classList.remove('hidden');
    retakeBtn.classList.add('hidden');
    photoDataInput.value = '';
  });

  startCamera();
});
