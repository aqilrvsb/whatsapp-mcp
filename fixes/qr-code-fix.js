// Complete fix for QR code functionality in dashboard.ejs

// This replaces the broken scanQR function starting at line 1259
function scanQR(deviceId) {
    const modal = new bootstrap.Modal(document.getElementById('qrModal'));
    modal.show();
    
    // Show loading spinner
    const qrContainer = document.getElementById('qrCode');
    qrContainer.innerHTML = `
        <div class="text-center">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p>Connecting to WhatsApp...</p>
        </div>
    `;
    
    // Socket connection for real-time QR updates
    const socket = io();
    let qrReceived = false;
    
    // Listen for QR code updates
    socket.on('qr', (data) => {
        if (data.deviceId === deviceId && data.qr) {
            qrReceived = true;
            qrContainer.innerHTML = `
                <div class="text-center">
                    <img src="${data.qr}" 
                         alt="WhatsApp QR Code" 
                         class="img-fluid"
                         style="max-width: 256px; max-height: 256px; width: 100%; height: auto; background: white; padding: 10px; border-radius: 8px;">
                    <p class="mt-3 text-muted small">
                        Open WhatsApp on your phone<br>
                        Settings > Linked Devices > Link a Device
                    </p>
                </div>
            `;
        }
    });
    
    // Listen for successful connection
    socket.on('device-connected', (data) => {
        if (data.deviceId === deviceId) {
            qrContainer.innerHTML = `
                <div class="text-center">
                    <i class="bi bi-check-circle-fill text-success" style="font-size: 48px;"></i>
                    <p class="mt-3 text-success">Device connected successfully!</p>
                </div>
            `;
            setTimeout(() => {
                modal.hide();
                location.reload(); // Reload to show updated device status
            }, 2000);
        }
    });
    
    // Listen for QR timeout
    socket.on('qr-timeout', (data) => {
        if (data.deviceId === deviceId) {
            qrContainer.innerHTML = `
                <div class="text-center">
                    <i class="bi bi-clock-history text-warning" style="font-size: 48px;"></i>
                    <p class="mt-2 text-warning">QR code expired</p>
                    <button class="btn btn-primary" onclick="scanQR('${deviceId}')">Generate New QR</button>
                </div>
            `;
        }
    });
    
    // Listen for connection errors
    socket.on('connection-error', (data) => {
        if (data.deviceId === deviceId) {
            qrContainer.innerHTML = `
                <div class="text-center">
                    <i class="bi bi-exclamation-triangle text-danger" style="font-size: 48px;"></i>
                    <p class="mt-2 text-danger">Connection failed</p>
                    <p class="small text-muted">${data.error || 'Unknown error'}</p>
                    <button class="btn btn-primary" onclick="scanQR('${deviceId}')">Try Again</button>
                </div>
            `;
        }
    });
    
    // Emit connect request to server
    socket.emit('connect-device', { deviceId });
    
    // Also try the HTTP endpoint as fallback
    setTimeout(() => {
        if (!qrReceived) {
            pollForQR(deviceId, qrContainer);
        }
    }, 1000);
    
    // Clean up socket when modal closes
    document.getElementById('qrModal').addEventListener('hidden.bs.modal', function cleanup() {
        socket.disconnect();
        document.getElementById('qrModal').removeEventListener('hidden.bs.modal', cleanup);
    }, { once: true });
}

// Helper function to poll for QR via HTTP
function pollForQR(deviceId, qrContainer) {
    fetch(`/app/login?deviceId=${deviceId}`, {
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.code === 'SUCCESS' && data.results && data.results.qr_link) {
            qrContainer.innerHTML = `
                <div class="text-center">
                    <img src="${data.results.qr_link}" 
                         alt="WhatsApp QR Code" 
                         class="img-fluid"
                         style="max-width: 256px; max-height: 256px; width: 100%; height: auto; background: white; padding: 10px; border-radius: 8px;">
                    <p class="mt-3 text-muted small">
                        Open WhatsApp on your phone<br>
                        Settings > Linked Devices > Link a Device
                    </p>
                </div>
            `;
        } else if (data.code === 'PENDING') {
            // Retry after specified time
            setTimeout(() => pollForQR(deviceId, qrContainer), data.retry_after || 2000);
        } else if (data.code === 'ERROR') {
            qrContainer.innerHTML = `
                <div class="text-center">
                    <i class="bi bi-exclamation-triangle text-warning" style="font-size: 48px;"></i>
                    <p class="mt-2">${data.message || 'Failed to generate QR code'}</p>
                    <button class="btn btn-primary" onclick="scanQR('${deviceId}')">Try Again</button>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Error loading QR code:', error);
        qrContainer.innerHTML = `
            <div class="text-center">
                <i class="bi bi-wifi-off text-danger" style="font-size: 48px;"></i>
                <p class="mt-2">Connection error</p>
                <p class="small text-muted">${error.message}</p>
                <button class="btn btn-primary" onclick="scanQR('${deviceId}')">Try Again</button>
            </div>
        `;
    });
}
