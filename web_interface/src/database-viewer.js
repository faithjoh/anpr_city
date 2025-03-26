// Database Viewer Module for Smart City ANPR Admin Panel

// DOM Elements
const dateFilter = document.getElementById('dateFilter');
const plateFilter = document.getElementById('plateFilter');
const applyFilterBtn = document.getElementById('applyFilterBtn');
const resetFilterBtn = document.getElementById('resetFilterBtn');
const databaseTable = document.getElementById('databaseTable');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const paginationInfo = document.getElementById('paginationInfo');

// Pagination state
const pageSize = 10;
let currentPage = 1;
let totalPages = 1;
let lastDoc = null;
let firstDoc = null;
let activeFilters = {};

// Initialize Database Viewer
function initDatabaseViewer() {
    console.log('Database Viewer initialized');
    
    // Set today's date as default for date filter
    const today = new Date().toISOString().split('T')[0];
    dateFilter.value = today;
    
    // Set up event listeners
    setupDatabaseViewerListeners();
    
    // Load initial data
    loadDatabaseData();
}

// Set up event listeners for database viewer elements
function setupDatabaseViewerListeners() {
    // Filter buttons
    applyFilterBtn.addEventListener('click', handleApplyFilter);
    resetFilterBtn.addEventListener('click', handleResetFilter);
    
    // Pagination buttons
    prevPageBtn.addEventListener('click', handlePrevPage);
    nextPageBtn.addEventListener('click', handleNextPage);
}

// Handle applying filters
function handleApplyFilter() {
    // Get filter values
    const date = dateFilter.value ? new Date(dateFilter.value) : null;
    const plate = plateFilter.value.trim();
    
    // Set active filters
    activeFilters = {};
    
    if (date) {
        // Set the start of the selected day
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        
        // Set the end of the selected day
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        
        activeFilters.dateRange = {
            start: startDate,
            end: endDate
        };
    }
    
    if (plate) {
        activeFilters.plate = plate;
    }
    
    // Reset pagination and load data with filters
    resetPagination();
    loadDatabaseData();
}

// Handle resetting filters
function handleResetFilter() {
    // Clear filter inputs
    dateFilter.value = new Date().toISOString().split('T')[0];
    plateFilter.value = '';
    
    // Clear active filters
    activeFilters = {};
    
    // Reset pagination and reload data
    resetPagination();
    loadDatabaseData();
}

// Handle previous page button
function handlePrevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadDatabaseData(false, true);
    }
}

// Handle next page button
function handleNextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadDatabaseData(true);
    }
}

// Reset pagination state
function resetPagination() {
    currentPage = 1;
    totalPages = 1;
    lastDoc = null;
    firstDoc = null;
    updatePaginationUI();
}

// Update pagination UI
function updatePaginationUI() {
    paginationInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

// Load database data from Firebase
async function loadDatabaseData(next = false, prev = false) {
    try {
        // Show loading state
        databaseTable.innerHTML = '<tr><td colspan="7">Loading data...</td></tr>';
        
        // Reference to Firestore database
        const db = window.firebaseApp.db;
        
        // Get total count for pagination
        await updateTotalPages(db);
        
        // Fetch data from both Orders and PlateRecognition collections
        const ordersPromise = fetchOrdersData(db, next, prev);
        const plateRecognitionPromise = fetchPlateRecognitionData(db, next, prev);
        
        // Wait for both queries to complete
        const [ordersData, plateRecognitionData] = await Promise.all([ordersPromise, plateRecognitionPromise]);
        
        // Combine the results
        const combinedData = [...ordersData, ...plateRecognitionData];
        
        // Sort by timestamp (newest first)
        combinedData.sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.seconds : 0;
            const timeB = b.timestamp ? b.timestamp.seconds : 0;
            return timeB - timeA;
        });
        
        // Clear the table
        databaseTable.innerHTML = '';
        
        // Check if we have results
        if (combinedData.length === 0) {
            databaseTable.innerHTML = '<tr><td colspan="7">No data found matching your criteria.</td></tr>';
            return;
        }
        
        // Display the results
        combinedData.forEach(item => {
            const row = document.createElement('tr');
            
            if (item.type === 'order') {
                // Format dates for order
                const entryTime = item.entryTime ? formatDate(item.entryTime) : 'N/A';
                const exitTime = item.exitTime ? formatDate(item.exitTime) : 'In Progress';
                const fee = item.fee ? `£${item.fee.toFixed(2)}` : '£0.00';
                
                row.innerHTML = `
                    <td>${item.userID || 'Anonymous'}</td>
                    <td>${item.licensePlate || 'Unknown'}</td>
                    <td>N/A</td>
                    <td>${entryTime}</td>
                    <td>${exitTime}</td>
                    <td>${fee}</td>
                    <td>
                        <button class="btn small-btn outline-btn view-btn" data-id="${item.id}" data-type="order">View</button>
                    </td>
                `;
            } else if (item.type === 'plateRecognition') {
                // Format data for plate recognition
                const entryTime = item.timestamp ? formatDate(item.timestamp) : 'N/A';
                const confidencePercent = item.confidence ? `${Math.round(item.confidence * 100)}%` : 'N/A';
                
                // Calculate exit time
                let exitTimeDisplay = 'N/A';
                if (item.timestamp && item.exit_after_seconds) {
                    const exitTime = new Date(item.timestamp.toDate().getTime() + (item.exit_after_seconds * 1000));
                    exitTimeDisplay = formatDate(exitTime);
                }
                
                // Format fee
                const feeDisplay = item.fee ? `£${item.fee.toFixed(2)}` : 'N/A';
                
                row.innerHTML = `
                    <td>System</td>
                    <td>${item.plate_number || 'Unknown'}</td>
                    <td>${item.country_identifier || 'UNKNOWN'}</td>
                    <td>${entryTime}</td>
                    <td>${exitTimeDisplay}</td>
                    <td>${feeDisplay}</td>
                    <td>
                        <button class="btn small-btn outline-btn view-btn" data-id="${item.id}" data-type="plate">View</button>
                    </td>
                `;
            }
            
            databaseTable.appendChild(row);
        });
        
        // Add event listeners to view buttons
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(button => {
            button.addEventListener('click', () => handleViewDetails(button.dataset.id, button.dataset.type));
        });
        
        // Update pagination UI
        updatePaginationUI();
        
    } catch (error) {
        console.error('Error loading database data:', error);
        databaseTable.innerHTML = '<tr><td colspan="7">Error loading data. Please try again.</td></tr>';
        
        // Show error message
        if (typeof showMessage === 'function') {
            showMessage('Error', 'Failed to load database data. Please try again later.');
        }
    }
}

// Fetch orders data from Firebase
async function fetchOrdersData(db, next, prev) {
    try {
        // Start with the Orders collection
        let query = db.collection('Orders');
        
        // Apply date filter if active
        if (activeFilters.dateRange) {
            query = query.where('entryTime', '>=', activeFilters.dateRange.start)
                         .where('entryTime', '<=', activeFilters.dateRange.end);
        }
        
        // Order by entry time
        query = query.orderBy('entryTime', 'desc');
        
        // Apply pagination
        if (next && lastDoc) {
            query = query.startAfter(lastDoc);
        } else if (prev && firstDoc) {
            query = query.endBefore(firstDoc).limitToLast(pageSize);
        }
        
        // Limit results to page size
        query = query.limit(pageSize);
        
        // Execute the query
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return [];
        }
        
        // Process results
        const results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Filter by plate number if needed
            if (activeFilters.plate && data.licensePlate && 
                !data.licensePlate.toLowerCase().includes(activeFilters.plate.toLowerCase())) {
                return;
            }
            
            results.push({
                ...data,
                id: doc.id,
                type: 'order'
            });
        });
        
        return results;
    } catch (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
}

// Fetch plate recognition data from Firebase
async function fetchPlateRecognitionData(db, next, prev) {
    try {
        // Start with the PlateRecognition collection
        let query = db.collection('PlateRecognition');
        
        // Apply date filter if active
        if (activeFilters.dateRange) {
            query = query.where('timestamp', '>=', activeFilters.dateRange.start)
                         .where('timestamp', '<=', activeFilters.dateRange.end);
        }
        
        // Order by timestamp
        query = query.orderBy('timestamp', 'desc');
        
        // Apply pagination
        if (next && lastDoc) {
            query = query.startAfter(lastDoc);
        } else if (prev && firstDoc) {
            query = query.endBefore(firstDoc).limitToLast(pageSize);
        }
        
        // Limit results to page size
        query = query.limit(pageSize);
        
        // Execute the query
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return [];
        }
        
        // Process results
        const results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Filter by plate number if needed
            if (activeFilters.plate && data.plate_number && 
                !data.plate_number.toLowerCase().includes(activeFilters.plate.toLowerCase())) {
                return;
            }
            
            results.push({
                ...data,
                id: doc.id,
                type: 'plateRecognition'
            });
        });
        
        return results;
    } catch (error) {
        console.error('Error fetching plate recognition data:', error);
        return [];
    }
}

// Update total pages for pagination
async function updateTotalPages(db) {
    try {
        // Count documents in both collections
        let ordersCount = 0;
        let plateRecognitionCount = 0;
        
        // Count Orders documents
        let ordersQuery = db.collection('Orders');
        if (activeFilters.dateRange) {
            ordersQuery = ordersQuery.where('entryTime', '>=', activeFilters.dateRange.start)
                                   .where('entryTime', '<=', activeFilters.dateRange.end);
        }
        const ordersSnapshot = await ordersQuery.get();
        ordersCount = ordersSnapshot.size;
        
        // Count PlateRecognition documents
        let plateQuery = db.collection('PlateRecognition');
        if (activeFilters.dateRange) {
            plateQuery = plateQuery.where('timestamp', '>=', activeFilters.dateRange.start)
                                 .where('timestamp', '<=', activeFilters.dateRange.end);
        }
        const plateSnapshot = await plateQuery.get();
        plateRecognitionCount = plateSnapshot.size;
        
        // Calculate total pages
        const totalCount = ordersCount + plateRecognitionCount;
        totalPages = Math.ceil(totalCount / pageSize) || 1;
        
        // Update pagination UI
        updatePaginationUI();
        
    } catch (error) {
        console.error('Error counting documents:', error);
        totalPages = 1;
    }
}

// Handle view details button
function handleViewDetails(id, type) {
    let message = '';
    
    if (type === 'order') {
        message = `Viewing details for order ${id}. In a real implementation, this would show detailed information about the order.`;
    } else if (type === 'plate') {
        message = `Viewing details for plate recognition ${id}. In a real implementation, this would show the detailed recognition results and the original image.`;
    }
    
    // Show details message
    showMessage('Item Details', message);
}

// Format date for display
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    // Handle Firestore Timestamp objects
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date);
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDatabaseViewer);
} else {
    initDatabaseViewer();
}

// Export for use in main.js
window.initDatabaseViewer = initDatabaseViewer; 