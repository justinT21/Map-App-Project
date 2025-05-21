// Import PathFinder
import PathFinder from './algorithm.js';

// ===== DOM Elements =====
const elements = {
    canvas: document.getElementById('canvas'),
    ctx: canvas.getContext('2d'),
    searchInput: document.getElementById('search-input'),
    searchButton: document.getElementById('search-button'),
    locationInfo: document.getElementById('location-info'),
    coordinatesDisplay: document.getElementById('coordinates-display'),
    copyButton: document.getElementById('copy-coords-btn'),
    copyStatus: document.getElementById('copy-status'),
    manualLocationButton: document.getElementById('manual-location-btn'),
    placesList: document.getElementById('places-list'),
    locationSelectMode: document.getElementById('location-select-mode'),
    debugInfo: document.getElementById('debug-info'),
    loadingIndicator: document.getElementById('loading'),
    toggleControlsBtn: document.getElementById('toggle-controls-btn'),
    controls: document.getElementById('controls')
};

// ===== State Variables =====
const state = {
    mapImage: new Image(),
    graphData: [],
    places: [],
    userLocation: null,
    selectedPlace: null,
    isLocationSelectMode: false,
    debugMode: false,
    pathToDestination: null,
    pathFinder: null,
    lastMouseX: null,
    lastMouseY: null,
    isControlsVisible: false,
    locationWatchId: null,
    zoomLevel: 1,
    zoomCenter: { x: 0, y: 0 },
    animation: {
        isAnimating: false,
        isResetting: false,
        startTime: 0,
        duration: 1000, // 1 second animation
        startScale: 1,
        targetScale: 1,
        startOffsetX: 0,
        startOffsetY: 0,
        targetOffsetX: 0,
        targetOffsetY: 0
    }
};

const config = {
    // Affine transformation parameters (image → GPS after 90° rotation)
    x_scale: 3.4051570994264277e-06,
    y_scale: 2.513687025854391e-06,
    x_offset: -122.07,
    y_offset: 37.36145018238725,

    // Centroid of rotated image
    centroid: { x: 804.7150285714284, y: -753.7154862337657 },

    // Optional fallback bounds
    mapBounds: {
        lonMin: -122.07,
        lonMax: -122.06,
        latMin: 37.355,
        latMax: 37.365,
        width: 2000,
        height: 1000
    }
};


// ===== Initialization =====
async function init() {
    try {
        // Test coordinate conversion functions
        testCoordinateConversion();
        
        await loadImage('SchoolMap.png');
        resizeCanvas();
        await loadGraphData('data.csv');
        
        if (state.graphData.length === 0) {
            console.log("First attempt to load CSV failed, trying alternative method...");
            await loadGraphDataDirectly();
        }
        
        state.pathFinder = new PathFinder(state.graphData);
        initializePlaces();
        drawMap();
        
        // Prompt for location at startup
        await promptForLocation();
        
        elements.loadingIndicator.style.display = 'none';
    } catch (error) {
        console.error('Error initializing application:', error);
        elements.loadingIndicator.textContent = 'Error loading map data. Please refresh the page.';
    }
}

// ===== Map Loading and Setup =====
function loadImage(src) {
    return new Promise((resolve, reject) => {
        state.mapImage.onload = () => resolve();
        state.mapImage.onerror = () => reject(new Error('Failed to load image'));
        state.mapImage.src = src;
    });
}

function resizeCanvas() {
    elements.canvas.width = window.innerWidth;
    elements.canvas.height = window.innerHeight;
}

async function loadGraphData(csvFile) {
    try {
        const response = await fetch(csvFile);
        if (!response.ok) {
            throw new Error(`Failed to load ${csvFile}: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const lines = csvText.split('\n');
        
        console.log(`CSV file loaded: ${lines.length} lines including header`);
        
        // Skip header row and parse data
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const values = line.split(',').map(v => parseFloat(v.trim()));
                if (!isNaN(values[0])) {
                    state.graphData.push({
                        x1: values[0],
                        y1: -values[1], // Invert y1
                        x2: values[2],
                        y2: -values[3], // Invert y2
                        weight: values.length > 4 ? values[4] : 1
                    });
                }
            }
        }
        
        console.log(`Loaded ${state.graphData.length} graph edges from CSV`);
    } catch (error) {
        console.error('Error loading CSV data:', error);
        elements.loadingIndicator.textContent = `Error: ${error.message}`;
        throw error;
    }
}

async function loadGraphDataDirectly() {
    // Hard-coded sample data as fallback
    state.graphData = [
        { x1: 100, y1: -200, x2: 300, y2: -400, weight: 1 },
        { x1: 300, y1: -400, x2: 500, y2: -300, weight: 1 },
        { x1: 500, y1: -300, x2: 700, y2: -500, weight: 1 },
        { x1: 700, y1: -500, x2: 900, y2: -400, weight: 1 },
        { x1: 900, y1: -400, x2: 1100, y2: -600, weight: 1 },
        { x1: 100, y1: -600, x2: 300, y2: -500, weight: 1 },
        { x1: 300, y1: -500, x2: 500, y2: -700, weight: 1 },
        { x1: 500, y1: -700, x2: 700, y2: -600, weight: 1 },
        { x1: 700, y1: -600, x2: 900, y2: -700, weight: 1 }
    ];
    
    console.log(`Loaded ${state.graphData.length} fallback graph edges`);
    return true;
}

// ===== Places Management =====
function initializePlaces() {
    const uniquePoints = new Map();
    
    // Extract unique points from graph data
    state.graphData.forEach(edge => {
        const id1 = `${edge.x1},${edge.y1}`;
        const id2 = `${edge.x2},${edge.y2}`;
        
        if (!uniquePoints.has(id1)) {
            uniquePoints.set(id1, {
                id: id1,
                name: `Location ${uniquePoints.size + 1}`,
                x: edge.x1,
                y: edge.y1,
                imageX: edge.x1,
                imageY: edge.y1
            });
        }
        
        if (!uniquePoints.has(id2)) {
            uniquePoints.set(id2, {
                id: id2,
                name: `Location ${uniquePoints.size + 1}`,
                x: edge.x2,
                y: edge.y2,
                imageX: edge.x2,
                imageY: edge.y2
            });
        }
    });
    
    state.places = Array.from(uniquePoints.values());
    
    // Add named locations
    const namedLocations = [
        { id: 'entrance', name: 'Main Entrance', x: 538.086, y: 332.921 },
        { id: 'cafeteria', name: 'Cafeteria', x: 1761, y: 698.598 },
        { id: 'library', name: 'Library', x: 1236.65, y: 504.378 },
        { id: 'gym', name: 'Gymnasium', x: 643.965, y: 335.5 },
        { id: 'admin', name: 'Administration', x: 950, y: 400 }
    ];
    
    namedLocations.forEach(loc => {
        let closestPlace = null;
        let minDistance = Infinity;
        
        state.places.forEach(place => {
            const distance = Math.sqrt(
                Math.pow(place.x - loc.x, 2) + 
                Math.pow(place.y - loc.y, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPlace = place;
            }
        });
        
        if (closestPlace && minDistance < 50) {
            closestPlace.name = loc.name;
            closestPlace.id = loc.id;
        } else {
            state.places.push({
                id: loc.id,
                name: loc.name,
                x: loc.x,
                y: loc.y,
                imageX: loc.x,
                imageY: loc.y
            });
        }
    });
    
    // Calculate GPS coordinates for each place
    state.places.forEach(place => {
        const gps = imageToGpsCoordinates(place.imageX, place.imageY);
        place.longitude = gps.longitude;
        place.latitude = gps.latitude;
    });
    
    updatePlacesList();
}

function updatePlacesList() {
    elements.placesList.innerHTML = '<h3>Places</h3>';
    
    state.places.forEach(place => {
        if (place.name.startsWith('Location')) return;
        
        const item = document.createElement('div');
        item.className = 'place-item';
        if (state.selectedPlace && state.selectedPlace.id === place.id) {
            item.classList.add('selected');
        }
        
        item.textContent = place.name;
        item.dataset.id = place.id;
        
        item.addEventListener('click', () => selectPlace(place));
        elements.placesList.appendChild(item);
    });
}

function selectPlace(place) {
    state.selectedPlace = place;
    updatePlacesList();
    
    if (state.userLocation) {
        console.log(place)
        findPath(state.userLocation, place);
    }
    
    elements.locationInfo.textContent = `Selected: ${place.name}`;
    drawMap();
}

// ===== Path Finding =====
function findPath(start, end) {
    if (!state.pathFinder) {
        console.error('PathFinder not initialized');
        return;
    }
    
    // Find closest graph nodes to start and end points
    const startNode = findClosestGraphNode(start.imageX, start.imageY);
    console.log(startNode);
    const endNode = findClosestGraphNode(end.imageX, end.imageY);
    console.log(endNode);
    
    if (!startNode || !endNode) {
        console.error('Could not find valid graph nodes');
        return;
    }
    
    // Find path between the closest graph nodes
    const path = state.pathFinder.findPath(startNode.x, startNode.y, endNode.x, endNode.y);
    
    if (path) {
        // Add straight lines from actual points to their closest graph nodes
        const fullPath = [
            { x: start.imageX, y: start.imageY },  // Start point
            { x: startNode.x, y: startNode.y },    // Closest graph node to start
            ...path.slice(1, -1),                  // Path through graph
            { x: endNode.x, y: endNode.y },        // Closest graph node to end
            { x: end.imageX, y: end.imageY }       // End point
        ];
        
        state.pathToDestination = {
            start: start,
            end: end,
            path: fullPath
        };
    } else {
        // Fallback to direct path if no path found
        state.pathToDestination = {
            start: start,
            end: end,
            path: [
                { x: start.imageX, y: start.imageY },
                { x: end.imageX, y: end.imageY }
            ]
        };
    }
    
    drawMap();
}

// Helper function to find the closest graph node to a point
function findClosestGraphNode(x, y) {
    let closestNode = null;
    let minDistance = Infinity;
    
    // Create a set of unique nodes from the graph data
    const nodes = new Set();
    state.graphData.forEach(edge => {
        nodes.add(`${edge.x1},${edge.y1}`);
        nodes.add(`${edge.x2},${edge.y2}`);
    });
    
    // Find the closest node
    nodes.forEach(nodeStr => {
        const [nodeX, nodeY] = nodeStr.split(',').map(Number);
        const distance = Math.sqrt(
            Math.pow(x - nodeX, 2) + 
            Math.pow(y - nodeY, 2)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            closestNode = { x: nodeX, y: nodeY };
        }
    });
    
    // Only return the node if it's within a reasonable distance
    const MAX_DISTANCE = 500; // Adjust this threshold as needed
    return minDistance <= MAX_DISTANCE ? closestNode : null;
}

// ===== Map Drawing =====
function drawMap() {
    // Clear canvas
    elements.ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    
    // Calculate base scale to fit map to window
    const baseScale = Math.min(
        elements.canvas.width / state.mapImage.width,
        elements.canvas.height / state.mapImage.height
    ) * 0.9;
    
    // Apply zoom level if path is selected
    let scale = baseScale;
    let offsetX = (elements.canvas.width - state.mapImage.width * scale) / 2;
    let offsetY = (elements.canvas.height - state.mapImage.height * scale) / 2;
    
    if (state.pathToDestination && state.userLocation && !state.animation.isResetting) {
        // Calculate bounds of the path and user location
        const pathPoints = state.pathToDestination.path;
        let minX = state.userLocation.imageX, minY = state.userLocation.imageY;
        let maxX = state.userLocation.imageX, maxY = state.userLocation.imageY;
        
        pathPoints.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });
        
        // Add larger padding around the path and user location
        const padding = 400; // Increased padding
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        // Calculate the scale needed to fit the path and user location
        const pathWidth = maxX - minX;
        const pathHeight = maxY - minY;
        
        const targetScale = Math.min(
            elements.canvas.width / pathWidth,
            elements.canvas.height / pathHeight
        ) * 0.9;
        
        // Calculate center point, weighted towards user location
        const userWeight = 0.7; // Give more weight to user location
        const pathCenterX = (minX + maxX) / 2;
        const pathCenterY = (minY + maxY) / 2;
        
        const centerX = state.userLocation.imageX * userWeight + pathCenterX * (1 - userWeight);
        const centerY = state.userLocation.imageY * userWeight + pathCenterY * (1 - userWeight);
        
        // Calculate target offsets to center the view
        const targetOffsetX = (elements.canvas.width - state.mapImage.width * targetScale) / 2;
        const targetOffsetY = (elements.canvas.height - state.mapImage.height * targetScale) / 2;
        
        // Adjust offsets to center on the weighted center point
        const finalOffsetX = targetOffsetX - (centerX - state.mapImage.width / 2) * targetScale;
        const finalOffsetY = targetOffsetY - (centerY - state.mapImage.height / 2) * targetScale;
        
        // If we're not already animating, start a new animation
        if (!state.animation.isAnimating) {
            startZoomAnimation(targetScale, finalOffsetX, finalOffsetY, false);
        }
        
        // Use current animation values
        scale = state.zoomLevel;
        offsetX = state.zoomCenter.x;
        offsetY = state.zoomCenter.y;
    } else {
        // Use current animation values
        scale = state.zoomLevel;
        offsetX = state.zoomCenter.x;
        offsetY = state.zoomCenter.y;
    }
    
    // Save context
    elements.ctx.save();
    
    // Draw map image
    elements.ctx.translate(offsetX, offsetY);
    elements.ctx.scale(scale, scale);
    elements.ctx.drawImage(state.mapImage, 0, 0);
    
    // Draw graph edges
    drawGraphEdges(scale);
    
    // Draw path if available
    if (state.pathToDestination) {
        drawPath(scale);
    }
    
    // Draw places
    drawPlaces(scale);
    
    // Draw user location if available
    if (state.userLocation) {
        drawUserLocation(scale);
    }
    
    // Draw location selection indicator if in selection mode
    if (state.isLocationSelectMode) {
        drawLocationSelection(scale, offsetX, offsetY);
    }
    
    // Restore context
    elements.ctx.restore();
    
    // Update debug info if enabled
    if (state.debugMode) {
        updateDebugInfo();
    }
}

function drawGraphEdges(scale) {
    elements.ctx.strokeStyle = 'rgba(0, 0, 255, 0.6)';
    elements.ctx.lineWidth = 2 / scale;
    
    let drawnEdges = 0;
    
    state.graphData.forEach(edge => {
        if (isNaN(edge.x1) || isNaN(edge.y1) || isNaN(edge.x2) || isNaN(edge.y2)) return;
        
        elements.ctx.beginPath();
        elements.ctx.moveTo(edge.x1, edge.y1);
        elements.ctx.lineTo(edge.x2, edge.y2);
        elements.ctx.stroke();
        drawnEdges++;
    });
    
    console.log(`Drew ${drawnEdges} edges out of ${state.graphData.length} total afds`);
}

function drawPath(scale) {
    elements.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    elements.ctx.lineWidth = 3 / scale;
    
    elements.ctx.beginPath();
    elements.ctx.moveTo(state.pathToDestination.path[0].x, state.pathToDestination.path[0].y);
    
    for (let i = 1; i < state.pathToDestination.path.length; i++) {
        elements.ctx.lineTo(state.pathToDestination.path[i].x, state.pathToDestination.path[i].y);
    }
    
    elements.ctx.stroke();
}

function drawPlaces(scale) {
    state.places.forEach(place => {
        if (place.name.startsWith('Location')) return;
        
        // Draw point
        elements.ctx.beginPath();
        elements.ctx.arc(place.imageX, place.imageY, 5 / scale, 0, Math.PI * 2);
        
        if (state.selectedPlace && state.selectedPlace.id === place.id) {
            elements.ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        } else {
            elements.ctx.fillStyle = 'rgba(0, 128, 255, 0.8)';
        }
        
        elements.ctx.fill();
        
        // Draw label
        elements.ctx.font = `${12 / scale}px Arial`;
        elements.ctx.fillStyle = 'black';
        elements.ctx.textAlign = 'center';
        elements.ctx.fillText(place.name, place.imageX, place.imageY - 10 / scale);
    });
}

function drawUserLocation(scale) {
    // Draw outer glow
    const glowRadius = 12 / scale;
    const gradient = elements.ctx.createRadialGradient(
        state.userLocation.imageX, state.userLocation.imageY, 0,
        state.userLocation.imageX, state.userLocation.imageY, glowRadius
    );
    gradient.addColorStop(0, 'rgba(0, 255, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
    
    elements.ctx.beginPath();
    elements.ctx.arc(state.userLocation.imageX, state.userLocation.imageY, glowRadius, 0, Math.PI * 2);
    elements.ctx.fillStyle = gradient;
    elements.ctx.fill();
    
    // Draw position marker
    elements.ctx.beginPath();
    elements.ctx.arc(state.userLocation.imageX, state.userLocation.imageY, 8 / scale, 0, Math.PI * 2);
    elements.ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    elements.ctx.fill();
    elements.ctx.strokeStyle = 'black';
    elements.ctx.lineWidth = 2 / scale;
    elements.ctx.stroke();
    
    // Draw accuracy circle
    elements.ctx.beginPath();
    elements.ctx.arc(state.userLocation.imageX, state.userLocation.imageY, 15 / scale, 0, Math.PI * 2);
    elements.ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
    elements.ctx.lineWidth = 1 / scale;
    elements.ctx.stroke();
    
    // Draw "You are here" label
    elements.ctx.font = `bold ${14 / scale}px Arial`;
    elements.ctx.fillStyle = 'white';
    elements.ctx.textAlign = 'center';
    elements.ctx.textBaseline = 'bottom';
    elements.ctx.lineWidth = 3 / scale;
    elements.ctx.strokeStyle = 'black';
    elements.ctx.strokeText("YOU ARE HERE", state.userLocation.imageX, state.userLocation.imageY - 15 / scale);
    elements.ctx.fillText("YOU ARE HERE", state.userLocation.imageX, state.userLocation.imageY - 15 / scale);
    
    // Show coordinates on map if in debug mode
    if (state.debugMode) {
        elements.ctx.font = `${10 / scale}px monospace`;
        elements.ctx.fillStyle = 'black';
        elements.ctx.textAlign = 'center';
        elements.ctx.textBaseline = 'top';
        elements.ctx.fillText(
            `(${state.userLocation.latitude.toFixed(4)}, ${state.userLocation.longitude.toFixed(4)})`, 
            state.userLocation.imageX, 
            state.userLocation.imageY + 20 / scale
        );
    }
}

function drawLocationSelection(scale, offsetX, offsetY) {
    const mouseX = state.lastMouseX || elements.canvas.width / 2;
    const mouseY = state.lastMouseY || elements.canvas.height / 2;
    
    const imgX = (mouseX - offsetX) / scale;
    const imgY = (mouseY - offsetY) / scale;
    
    if (imgX >= 0 && imgX <= state.mapImage.width && imgY >= 0 && imgY <= state.mapImage.height) {
        elements.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        elements.ctx.lineWidth = 1 / scale;
        
        // Draw crosshair
        elements.ctx.beginPath();
        elements.ctx.moveTo(imgX - 15 / scale, imgY);
        elements.ctx.lineTo(imgX + 15 / scale, imgY);
        elements.ctx.moveTo(imgX, imgY - 15 / scale);
        elements.ctx.lineTo(imgX, imgY + 15 / scale);
        elements.ctx.stroke();
        
        // Draw circle
        elements.ctx.beginPath();
        elements.ctx.arc(imgX, imgY, 10 / scale, 0, Math.PI * 2);
        elements.ctx.stroke();
        
        // Show coordinates
        const potentialGps = imageToGpsCoordinates(imgX, imgY);
        elements.ctx.font = `${10 / scale}px monospace`;
        elements.ctx.fillStyle = 'red';
        elements.ctx.textAlign = 'center';
        elements.ctx.textBaseline = 'top';
        
        // Show GPS coordinates
        elements.ctx.fillText(
            `GPS: (${potentialGps.latitude.toFixed(6)}, ${potentialGps.longitude.toFixed(6)})`, 
            imgX, 
            imgY + 20 / scale
        );
        
        // Show image coordinates if in debug mode
        if (state.debugMode) {
            elements.ctx.fillText(
                `Image: (${imgX.toFixed(1)}, ${imgY.toFixed(1)})`, 
                imgX, 
                imgY + 35 / scale
            );
        }
    }
}

// ===== Location Management =====
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            // Clear any existing watch
            if (state.locationWatchId !== null) {
                navigator.geolocation.clearWatch(state.locationWatchId);
            }

            // Start watching position
            state.locationWatchId = navigator.geolocation.watchPosition(
                position => {
                    console.log('GPS location updated:', position.coords.latitude, position.coords.longitude);
                    
                    const imgCoords = gpsToImageCoordinates(
                        position.coords.longitude,
                        position.coords.latitude
                    );
                    
                    console.log('Converted to image coordinates:', imgCoords);
                    
                    const isInBounds = imgCoords.x > -2000 && imgCoords.x < 3000 && 
                                     imgCoords.y > -2000 && imgCoords.y < 1000;
                    
                    if (!isInBounds) {
                        console.warn('GPS coordinates converted to out-of-bounds image coordinates');
                        setDefaultLocation();
                        // Don't stop watching - keep monitoring for when user comes back in bounds
                    } else {
                        // If we were using default location and now have valid coordinates, update
                        if (state.userLocation && state.userLocation.latitude === 37.3775) {
                            console.log('Valid location detected after being out of bounds');
                        }
                        
                        state.userLocation = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            imageX: imgCoords.x,
                            imageY: imgCoords.y
                        };
                        
                        elements.locationInfo.textContent = 'Your current location:';
                        updateCoordinatesDisplay(position.coords.latitude, position.coords.longitude);
                    }
                    
                    // If we have a selected place, update the path
                    if (state.selectedPlace) {
                        findPath(state.userLocation, state.selectedPlace);
                    }
                    
                    drawMap();
                },
                error => {
                    console.error('Error getting location:', error);
                    elements.locationInfo.textContent = 'Error getting your location. Click map to set manually.';
                    elements.coordinatesDisplay.textContent = '';
                    setDefaultLocation();
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 5000
                }
            );
            
            // Resolve the promise immediately since we're now watching position
            resolve();
        } else {
            elements.locationInfo.textContent = 'Geolocation is not supported by this browser.';
            elements.coordinatesDisplay.textContent = '';
            setDefaultLocation();
            reject(new Error('Geolocation not supported'));
        }
    });
}

function stopWatchingLocation() {
    if (state.locationWatchId !== null) {
        navigator.geolocation.clearWatch(state.locationWatchId);
        state.locationWatchId = null;
    }
}

function setDefaultLocation() {
    state.userLocation = {
        latitude: 37.3775, 
        longitude: -122.0745,
        imageX: 1000,
        imageY: 500
    };
    
    elements.locationInfo.textContent = 'Your location: [Default]';
    updateCoordinatesDisplay(state.userLocation.latitude, state.userLocation.longitude);
    drawMap();
}

function updateCoordinatesDisplay(latitude, longitude) {
    const latDirection = latitude >= 0 ? 'N' : 'S';
    const lonDirection = longitude >= 0 ? 'E' : 'W';
    
    const latFormatted = `${Math.abs(latitude).toFixed(6)}° ${latDirection}`;
    const lonFormatted = `${Math.abs(longitude).toFixed(6)}° ${lonDirection}`;
    
    elements.coordinatesDisplay.innerHTML = `
        <div>Latitude: ${latFormatted}</div>
        <div>Longitude: ${lonFormatted}</div>
    `;
    
    elements.copyButton.style.display = 'block';
}

function gpsToImageCoordinates(longitude, latitude) {
    console.log(`Converting GPS: long ${longitude}, lat ${latitude}`);
    const { x_scale, y_scale, x_offset, y_offset, centroid } = config;

    // Step 1: undo GPS scaling
    const gpsX = (longitude - x_offset) / x_scale;
    const gpsY = (latitude - y_offset) / y_scale;

    // Step 2: rotate 90° counterclockwise around centroid
    const dx = gpsX - centroid.x;
    const dy = gpsY - centroid.y;

    const imageX = centroid.x - dy;  // swapped signs for CCW
    const imageY = -(centroid.y + dx);

    // Sanity check
    if (Math.abs(imageX) > 10000 || Math.abs(imageY) > 10000) {
        console.warn(`Out-of-bounds image coordinates (${imageX}, ${imageY}), using fallback.`);
        const x2 = config.mapBounds.width * (longitude - config.mapBounds.lonMin) / (config.mapBounds.lonMax - config.mapBounds.lonMin);
        const y2 = config.mapBounds.height * (latitude - config.mapBounds.latMin) / (config.mapBounds.latMax - config.mapBounds.latMin);
        return { x: x2, y: y2 };
    }

    return { x: imageX, y: imageY };
}

function imageToGpsCoordinates(x, y) {
    const { x_scale, y_scale, x_offset, y_offset, centroid } = config;

    // Step 0: rotate 90° clockwise around centroid
    const dx = x - centroid.x;
    const dy = -y - centroid.y;  // Negate y to match gpsToImageCoordinates

    const unrotatedX = centroid.x + dy;
    const unrotatedY = centroid.y - dx;

    // Step 1: apply inverse scale and offset
    const longitude = unrotatedX * x_scale + x_offset;
    const latitude = unrotatedY * y_scale + y_offset;

    return { longitude, latitude };
}

// ===== Debug Functions =====
function updateDebugInfo() {
    if (!state.debugMode) return;
    
    let html = '<h3>Debug Info</h3>';
    
    if (state.userLocation) {
        html += '<p><strong>User Location:</strong><br>';
        html += `GPS: ${state.userLocation.latitude.toFixed(8)}° ${state.userLocation.latitude >= 0 ? 'N' : 'S'}, `;
        html += `${Math.abs(state.userLocation.longitude).toFixed(8)}° ${state.userLocation.longitude >= 0 ? 'E' : 'W'}<br>`;
        html += `Image: (${state.userLocation.imageX.toFixed(1)}, ${state.userLocation.imageY.toFixed(1)})</p>`;
    }
    
    if (state.selectedPlace) {
        html += `<p><strong>Selected Place:</strong> ${state.selectedPlace.name}<br>`;
        html += `GPS: ${state.selectedPlace.latitude.toFixed(8)}° ${state.selectedPlace.latitude >= 0 ? 'N' : 'S'}, `;
        html += `${Math.abs(state.selectedPlace.longitude).toFixed(8)}° ${state.selectedPlace.longitude >= 0 ? 'E' : 'W'}<br>`;
        html += `Image: (${state.selectedPlace.imageX.toFixed(1)}, ${state.selectedPlace.imageY.toFixed(1)})</p>`;
    }
    
    html += `<p><strong>Map Data:</strong><br>`;
    html += `Graph: ${state.graphData.length} edges<br>`;
    html += `Places: ${state.places.length} locations</p>`;
    
    elements.debugInfo.innerHTML = html;
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Toggle controls button
    elements.toggleControlsBtn.addEventListener('click', () => {
        state.isControlsVisible = !state.isControlsVisible;
        elements.controls.style.display = state.isControlsVisible ? 'block' : 'none';
        elements.toggleControlsBtn.textContent = state.isControlsVisible ? 'Hide Controls' : 'Show Controls';
    });

    // Search button click
    elements.searchButton.addEventListener('click', () => {
        const searchTerm = elements.searchInput.value.trim().toLowerCase();
        if (!searchTerm) return;
        
        const matches = state.places.filter(place => 
            place.name.toLowerCase().includes(searchTerm)
        );
        
        if (matches.length > 0) {
            selectPlace(matches[0]);
            elements.searchInput.value = '';
        } else {
            alert('No matching places found');
        }
    });
    
    // Search input enter key
    elements.searchInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            elements.searchButton.click();
        }
    });
    
    // Copy coordinates button
    elements.copyButton.addEventListener('click', () => {
        if (!state.userLocation) return;
        
        const latDirection = state.userLocation.latitude >= 0 ? 'N' : 'S';
        const lonDirection = state.userLocation.longitude >= 0 ? 'E' : 'W';
        
        const coordsText = `${Math.abs(state.userLocation.latitude).toFixed(6)}° ${latDirection}, ${Math.abs(state.userLocation.longitude).toFixed(6)}° ${lonDirection}`;
        
        navigator.clipboard.writeText(coordsText).then(() => {
            elements.copyStatus.style.display = 'block';
            setTimeout(() => {
                elements.copyStatus.style.display = 'none';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy coordinates: ', err);
            alert('Could not copy coordinates to clipboard');
        });
    });
    
    // Manual location button
    elements.manualLocationButton.addEventListener('click', () => {
        stopWatchingLocation();
        state.isLocationSelectMode = true;
        elements.locationSelectMode.style.display = 'block';
        elements.canvas.style.cursor = 'crosshair';
        elements.locationInfo.textContent = 'Click anywhere on the map to set your location';
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', event => {
        if (event.key.toLowerCase() === 'l' && event.ctrlKey && event.shiftKey) {
            event.preventDefault();
            toggleLocationSelectMode();
        } else if (event.key.toLowerCase() === 'd') {
            toggleDebugMode();
        } else if (event.key.toLowerCase() === 'l' && !event.ctrlKey && !event.shiftKey) {
            toggleLocationSelectMode();
        }
    });
    
    // Map clicks for location selection
    elements.canvas.addEventListener('click', event => {
        if (!state.isLocationSelectMode) return;
        
        const scale = Math.min(
            elements.canvas.width / state.mapImage.width,
            elements.canvas.height / state.mapImage.height
        ) * 0.9;
        
        const offsetX = (elements.canvas.width - state.mapImage.width * scale) / 2;
        const offsetY = (elements.canvas.height - state.mapImage.height * scale) / 2;
        
        const imageX = (event.clientX - offsetX) / scale;
        const imageY = (event.clientY - offsetY) / scale;
        
        if (imageX >= 0 && imageX <= state.mapImage.width && imageY >= 0 && imageY <= state.mapImage.height) {
            const gps = imageToGpsCoordinates(imageX, imageY);
            
            console.log('Manual location set:', gps);
            
            state.userLocation = {
                latitude: gps.latitude,
                longitude: gps.longitude,
                imageX: imageX,
                imageY: imageY
            };
            
            elements.locationInfo.textContent = 'Your selected location:';
            updateCoordinatesDisplay(gps.latitude, gps.longitude);
            
            if (state.selectedPlace) {
                findPath(state.userLocation, state.selectedPlace);
            }
            
            state.isLocationSelectMode = false;
            elements.locationSelectMode.style.display = 'none';
            elements.canvas.style.cursor = 'default';
            
            if (state.debugMode) {
                updateDebugInfo();
            }
            
            drawMap();
        }
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        resizeCanvas();
        drawMap();
    });
    
    // Mouse move for crosshair
    elements.canvas.addEventListener('mousemove', event => {
        state.lastMouseX = event.clientX;
        state.lastMouseY = event.clientY;
        
        if (state.isLocationSelectMode) {
            drawMap();
        }
    });
}

// ===== Helper Functions =====
function toggleLocationSelectMode() {
    state.isLocationSelectMode = !state.isLocationSelectMode;
    elements.locationSelectMode.style.display = state.isLocationSelectMode ? 'block' : 'none';
    
    if (state.isLocationSelectMode) {
        elements.canvas.style.cursor = 'crosshair';
        elements.locationInfo.textContent = 'LOCATION SELECT MODE: Click anywhere on the map';
    } else {
        elements.canvas.style.cursor = 'default';
        if (state.userLocation) {
            elements.locationInfo.textContent = 'Your location:';
            updateCoordinatesDisplay(state.userLocation.latitude, state.userLocation.longitude);
        } else {
            elements.locationInfo.textContent = 'Your location: Not set';
        }
    }
}

function toggleDebugMode() {
    state.debugMode = !state.debugMode;
    elements.debugInfo.style.display = state.debugMode ? 'block' : 'none';
    
    if (state.debugMode) {
        updateDebugInfo();
    }
}

// ===== Location Management =====
async function promptForLocation() {
    try {
        await getUserLocation();
    } catch (error) {
        console.error('Error getting location:', error);
        setDefaultLocation();
    }
}

// ===== Helper Functions =====
function testCoordinateConversion() {
    // Test points within the map bounds
    const testPoints = [
        { x: 1000, y: 500 },  // Center-ish point
        { x: 538.086, y: 332.921 },  // Main Entrance
        { x: 1761, y: 698.598 },  // Cafeteria
        { x: 1236.65, y: 504.378 },  // Library
        { x: 643.965, y: 335.5 }  // Gymnasium
    ];

    console.log('Testing coordinate conversion functions...');
    console.log('----------------------------------------');

    // Test specific GPS coordinate
    const testGps = {
        latitude: 37.359344,
        longitude: -122.066030
    };
    
    console.log('Testing specific GPS coordinate:');
    console.log(`Input GPS: (${testGps.latitude}, ${testGps.longitude})`);
    
    // Convert GPS to image coordinates
    const imageCoords = gpsToImageCoordinates(testGps.longitude, testGps.latitude);
    console.log(`Converted to image: (${imageCoords.x.toFixed(3)}, ${imageCoords.y.toFixed(3)})`);
    
    // Convert back to GPS
    const backToGps = imageToGpsCoordinates(imageCoords.x, imageCoords.y);
    console.log(`Converted back to GPS: (${backToGps.latitude.toFixed(6)}, ${backToGps.longitude.toFixed(6)})`);
    
    // Calculate differences
    const latDiff = Math.abs(testGps.latitude - backToGps.latitude);
    const lonDiff = Math.abs(testGps.longitude - backToGps.longitude);
    console.log(`GPS coordinate differences: (${latDiff.toFixed(6)}, ${lonDiff.toFixed(6)})`);
    console.log('----------------------------------------');

    // Test image coordinates
    testPoints.forEach((point, index) => {
        // Convert image coordinates to GPS
        const gps = imageToGpsCoordinates(point.x, point.y);
        
        // Convert GPS back to image coordinates
        const imageCoords = gpsToImageCoordinates(gps.longitude, gps.latitude);
        
        // Calculate the difference
        const xDiff = Math.abs(point.x - imageCoords.x);
        const yDiff = Math.abs(point.y - imageCoords.y);
        
        console.log(`Test point ${index + 1}:`);
        console.log(`Original image coordinates: (${point.x}, ${point.y})`);
        console.log(`GPS coordinates: (${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)})`);
        console.log(`Converted back to image: (${imageCoords.x.toFixed(3)}, ${imageCoords.y.toFixed(3)})`);
        console.log(`Difference: (${xDiff.toFixed(3)}, ${yDiff.toFixed(3)})`);
        console.log('----------------------------------------');
    });
}

// ===== Start Application =====
setupEventListeners();
init();

// Add a function to reset zoom
function resetZoom() {
    if (!state.animation.isAnimating) {
        // Clear the path and selection first
        state.pathToDestination = null;
        state.selectedPlace = null;
        elements.locationInfo.textContent = 'Your location:';
        updatePlacesList();
        
        // Then start reset animation
        startZoomAnimation(1, 0, 0, true);
    }
}

// Add a button to reset zoom
const resetZoomButton = document.createElement('button');
resetZoomButton.textContent = 'Reset View';
resetZoomButton.style.cssText = `
    background: #2196F3;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 10px;
    width: 100%;
`;
resetZoomButton.addEventListener('click', resetZoom);
elements.controls.appendChild(resetZoomButton);

// Add animation functions
function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function startZoomAnimation(targetScale, targetOffsetX, targetOffsetY, isResetting = false) {
    state.animation.isAnimating = true;
    state.animation.isResetting = isResetting;
    state.animation.startTime = performance.now();
    state.animation.startScale = state.zoomLevel;
    state.animation.targetScale = targetScale;
    state.animation.startOffsetX = state.zoomCenter.x;
    state.animation.startOffsetY = state.zoomCenter.y;
    state.animation.targetOffsetX = targetOffsetX;
    state.animation.targetOffsetY = targetOffsetY;
    
    requestAnimationFrame(animateZoom);
}

function animateZoom(currentTime) {
    if (!state.animation.isAnimating) return;
    
    const elapsed = currentTime - state.animation.startTime;
    const progress = Math.min(elapsed / state.animation.duration, 1);
    const easedProgress = easeOutExpo(progress);
    
    // Update current zoom and offset
    state.zoomLevel = state.animation.startScale + (state.animation.targetScale - state.animation.startScale) * easedProgress;
    state.zoomCenter.x = state.animation.startOffsetX + (state.animation.targetOffsetX - state.animation.startOffsetX) * easedProgress;
    state.zoomCenter.y = state.animation.startOffsetY + (state.animation.targetOffsetY - state.animation.startOffsetY) * easedProgress;
    
    // Redraw the map with current animation values
    drawMap();
    
    if (progress < 1) {
        requestAnimationFrame(animateZoom);
    } else {
        state.animation.isAnimating = false;
        if (state.animation.isResetting) {
            // Clear the path and selection after animation completes
            state.pathToDestination = null;
            state.selectedPlace = null;
            elements.locationInfo.textContent = 'Your location:';
            updatePlacesList();
            state.animation.isResetting = false;
        }
    }
} 