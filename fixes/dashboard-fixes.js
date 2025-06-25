// Fix for dashboard.ejs template literal issues
// This file contains the corrected JavaScript functions

// Function to fix template literal issues in dashboard
function fixDashboardTemplates() {
    // Find all instances where deviceId is used without quotes
    const fixes = [
        {
            old: 'onclick="scanQR(${deviceId})"',
            new: 'onclick="scanQR(\'${deviceId}\')"'
        },
        {
            old: 'onclick="scanQR(${device.id})"',
            new: 'onclick="scanQR(\'${device.id}\')"'
        },
        {
            old: 'onclick="deleteDevice(${deviceId})"',
            new: 'onclick="deleteDevice(\'${deviceId}\')"'
        }
    ];
    
    return fixes;
}

// Updated campaign creation function with better error handling
function createCampaign(campaignDate) {
    const form = document.getElementById('campaignForm');
    const formData = new FormData(form);
    
    // Ensure date is in correct format
    const campaignData = {
        campaign_date: campaignDate,
        title: formData.get('title'),
        niche: formData.get('niche'),
        message: formData.get('message'),
        image_url: formData.get('image_url'),
        scheduled_time: formData.get('scheduled_time')
    };
    
    // Validate required fields
    if (!campaignData.title || !campaignData.message) {
        alert('Title and message are required!');
        return;
    }
    
    fetch('/api/campaigns', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(campaignData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => Promise.reject(err));
        }
        return response.json();
    })
    .then(data => {
        if (data.code === 'SUCCESS') {
            $('#campaignModal').modal('hide');
            loadCampaigns(); // Reload campaigns
            showAlert('success', 'Campaign created successfully!');
        } else {
            throw new Error(data.message || 'Failed to create campaign');
        }
    })
    .catch(error => {
        console.error('Campaign creation error:', error);
        showAlert('danger', error.message || 'Failed to create campaign. Please try again.');
    });
}

module.exports = { fixDashboardTemplates, createCampaign };
