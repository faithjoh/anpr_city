// Dashboard Module for Smart City ANPR Admin Panel

// DOM Elements
const totalVehiclesEl = document.getElementById('totalVehicles');
const activeParkingEl = document.getElementById('activeParking');
const revenueTodayEl = document.getElementById('revenueToday');
const goToPlateReaderBtn = document.getElementById('goToPlateReaderBtn');
const goToDatabaseBtn = document.getElementById('goToDatabaseBtn');

// Initialize Dashboard
function initDashboard() {
    console.log('Dashboard initialized');
    
    // Load the dashboard data
    loadDashboardData();
    
    // Set up event listeners
    setupDashboardListeners();
}

// Load dashboard data from Firebase
async function loadDashboardData() {
    try {
        // Get the current date at midnight for daily stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Reference to Firestore database
        const db = window.firebaseApp.db;
        
        // Get total vehicles (total unique license plates)
        const platesSnapshot = await db.collection('PlateRecognition')
            .get();
            
        // Use a Set to count unique plates
        const uniquePlates = new Set();
        platesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.plate_number) {
                uniquePlates.add(data.plate_number);
            }
        });
        
        // Update the total vehicles display
        totalVehiclesEl.textContent = uniquePlates.size;
        
        // Get active parking (orders with entry time but no exit time)
        const activeOrdersSnapshot = await db.collection('Orders')
            .where('exitTime', '==', null)
            .get();
            
        // Update active parking display
        activeParkingEl.textContent = activeOrdersSnapshot.size;
        
        // Get today's revenue
        const revenueSnapshot = await db.collection('Orders')
            .where('exitTime', '>=', today)
            .get();
            
        // Calculate total revenue for today
        let revenue = 0;
        revenueSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.fee) {
                revenue += data.fee;
            }
        });
        
        // Update revenue display (format as currency)
        revenueTodayEl.textContent = `£${revenue.toFixed(2)}`;
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        
        // Set default values in case of error
        totalVehiclesEl.textContent = '0';
        activeParkingEl.textContent = '0';
        revenueTodayEl.textContent = '£0.00';
        
        // Show error message
        if (typeof showMessage === 'function') {
            showMessage('Error', 'Failed to load dashboard data. Please try again later.');
        }
    }
}

// Set up event listeners for dashboard elements
function setupDashboardListeners() {
    // Quick action buttons
    goToPlateReaderBtn.addEventListener('click', () => {
        // Show plate reader section
        showSection('plateReader');
    });
    
    goToDatabaseBtn.addEventListener('click', () => {
        // Show database section
        showSection('database');
    });
}

// Export the init function
window.initDashboard = initDashboard; 