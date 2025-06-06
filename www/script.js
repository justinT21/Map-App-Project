// Import PathFinder
import PathFinder from './algorithm.js';

// ===== DOM Elements =====
const elements = {
    canvas: document.getElementById('canvas'),
    ctx: canvas.getContext('2d'),
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
    calculatedPaths: {}, // Store calculated paths
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    lastDragPosition: { x: 0, y: 0 }
};

async function loadLocations() {
    try {
        const response = await fetch('./locations.json');
        if (!response.ok) {
            throw new Error(`Failed to load locations.json: ${response.status} ${response.statusText}`);
        }
        const locations = await response.json();
        return locations;
    } catch (error) {
        console.error('Error loading locations.json:', error);
        return [];
    }
}

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
        lonMin: -122.06885,
        lonMax: -122.06500,
        latMin: 37.35687,
        latMax: 37.36138,
        width: 2000,
        height: 1000
    },

    // Default location when GPS is unavailable or out of bounds
    defaultLocation: {
        latitude: 37.3775,
        longitude: -122.0745,
        imageX: 1000,
        imageY: 500
    },

    // Zoom levels for different scenarios
    zoom: {
        singlePoint: 1.2,  // Zoom level when focusing on a single point
        base: 0.9,        // Base zoom level multiplier for fitting map to window
        minPathScale: 0.3, // Minimum scale factor for path view (prevents zooming out too far)
        buttonStep: 0.3,   // How much to zoom in/out per button click
        wheelStep: 0.6,    // Step for mouse wheel zooming
        max: 3.0,         // Maximum zoom level
        min: 0.3,         // Minimum zoom level
        mobileMultiplier: 2.0  // Additional zoom multiplier for mobile devices
    },

    // Path and view settings
    view: {
        playerWeight: 0.0,  // Weight given to player location when calculating view center
        pathPadding: 300    // Padding around path when calculating view bounds
    }
};

// Add mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Adjust zoom levels for mobile
if (isMobile) {
    config.zoom.singlePoint *= config.zoom.mobileMultiplier;
    config.zoom.base *= config.zoom.mobileMultiplier;
    config.zoom.max *= config.zoom.mobileMultiplier;
}

// ===== Initialization =====
async function init() {
    try {
        // Load locations from JSON file
        const locations = await loadLocations();

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
        initializePlaces(locations);
        
        // Load saved zoom state first
        const savedState = localStorage.getItem('mapZoomState');
        if (savedState) {
            try {
                const { zoomLevel, zoomCenter } = JSON.parse(savedState);
                // Only restore if the values are valid numbers
                if (!isNaN(zoomLevel) && !isNaN(zoomCenter.x) && !isNaN(zoomCenter.y)) {
                    state.zoomLevel = zoomLevel;
                    state.zoomCenter = zoomCenter;
                }
            } catch (e) {
                console.error('Error loading saved zoom state:', e);
            }
        }

        // If no valid saved state, set initial zoom
        if (!savedState || isNaN(state.zoomLevel) || isNaN(state.zoomCenter.x) || isNaN(state.zoomCenter.y)) {
            const baseScale = Math.min(
                elements.canvas.width / state.mapImage.width,
                elements.canvas.height / state.mapImage.height
            ) * config.zoom.base;

            state.zoomLevel = baseScale;
            state.zoomCenter.x = (elements.canvas.width - state.mapImage.width * baseScale) / 2;
            state.zoomCenter.y = (elements.canvas.height - state.mapImage.height * baseScale) / 2;
        }

        drawMap();

        // Set up mobile-friendly controls
        setupMobileControls();

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
function initializePlaces(locations) {
    state.places = locations.map(loc => ({
        id: loc.id,
        name: loc.name,
        x: loc.x,
        y: loc.y,
        imageX: loc.x,
        imageY: loc.y
    }));

    // Sort the places alphabetically by name
    state.places.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate GPS coordinates for each place
    state.places.forEach(place => {
        const gps = imageToGpsCoordinates(place.imageX, place.imageY);
        place.longitude = gps.longitude;
        place.latitude = gps.latitude;
    });

    updatePlacesList();
}

function updatePlacesList() {
    elements.placesList.innerHTML = `
        <h3>Places</h3>
        <input type="text" id="places-search" class="places-search" placeholder="Search places...">
        <div class="places-list-scrollable"></div>
    `;

    const searchInput = document.getElementById('places-search');
    const placesListScrollable = document.querySelector('.places-list-scrollable');

    function populatePlaces(places) {
        placesListScrollable.innerHTML = '';
        places.forEach(place => {
            const item = document.createElement('div');
            item.className = 'place-item';
            if (state.selectedPlace && state.selectedPlace.id === place.id) {
                item.classList.add('selected');
            }

            item.textContent = place.name;
            item.dataset.id = place.id;

            item.addEventListener('click', () => selectPlace(place));
            placesListScrollable.appendChild(item);
        });
    }

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.trim().toLowerCase();
        const filteredPlaces = state.places.filter(place =>
            place.name.toLowerCase().includes(searchTerm)
        );
        populatePlaces(filteredPlaces);
    });

    populatePlaces(state.places);
}

function selectPlace(place) {
    state.selectedPlace = place;
    updatePlacesList();

    if (state.userLocation) {
        const cacheKey = `${state.userLocation.latitude},${state.userLocation.longitude}-${place.latitude},${place.longitude}`;

        if (state.calculatedPaths[cacheKey]) {
            console.log('Path found in cache.');
            state.pathToDestination = state.calculatedPaths[cacheKey];
            drawMap();
        } else {
            console.log('Calculating new path.');
            findPath(state.userLocation, place);
        }
    }

    elements.locationInfo.textContent = `Selected: ${place.name}`;
    drawMap();
}

// ===== Path Finding =====
function findPath(start, end) {
    const cacheKey = `${start.latitude},${start.longitude}-${end.latitude},${end.longitude}`;

    if (!state.pathFinder) {
        console.error('PathFinder not initialized');
        return;
    }

    // Find closest graph nodes to start and end points
    const startNode = findClosestGraphNode(start.imageX, start.imageY);
    const endNode = findClosestGraphNode(end.imageX, end.imageY);

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

        state.calculatedPaths[cacheKey] = state.pathToDestination;

        // Get bounds of the path
        const bounds = state.pathFinder.getPathBounds(
            fullPath,
            start.imageX,
            start.imageY,
            end.imageX,
            end.imageY
        );

        // Add padding around the path
        const padding = config.view.pathPadding;
        bounds.minX -= padding;
        bounds.minY -= padding;
        bounds.maxX += padding;
        bounds.maxY += padding;

        // Calculate the scale needed to fit the path
        const pathWidth = bounds.maxX - bounds.minX;
        const pathHeight = bounds.maxY - bounds.minY;

        // Calculate scale with minimum limit
        const targetScale = Math.max(
            Math.min(
                elements.canvas.width / pathWidth,
                elements.canvas.height / pathHeight
            ),
            config.zoom.minPathScale
        );

        // Calculate center point, weighted towards user location
        const userWeight = config.view.playerWeight;
        const pathCenterX = (bounds.minX + bounds.maxX) / 2;
        const pathCenterY = (bounds.minY + bounds.maxY) / 2;

        const centerX = start.imageX * userWeight + pathCenterX * (1 - userWeight);
        const centerY = start.imageY * userWeight + pathCenterY * (1 - userWeight);

        // Calculate target offsets to center the view
        const targetOffsetX = (elements.canvas.width - state.mapImage.width * targetScale) / 2;
        const targetOffsetY = (elements.canvas.height - state.mapImage.height * targetScale) / 2;

        // Adjust offsets to center on the weighted center point
        const finalOffsetX = targetOffsetX - (centerX - state.mapImage.width / 2) * targetScale;
        const finalOffsetY = targetOffsetY - (centerY - state.mapImage.height / 2) * targetScale;

        // Apply changes immediately
        state.zoomLevel = targetScale;
        state.zoomCenter.x = finalOffsetX;
        state.zoomCenter.y = finalOffsetY;

        // Save the new zoom state
        saveZoomState();
        drawMap();
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

        // Calculate zoom to fit the direct path
        const midX = (start.imageX + end.imageX) / 2;
        const midY = (start.imageY + end.imageY) / 2;
        const pathWidth = Math.abs(end.imageX - start.imageX);
        const pathHeight = Math.abs(end.imageY - start.imageY);

        // Calculate scale with padding
        const targetScale = Math.max(
            Math.min(
                elements.canvas.width / (pathWidth + config.view.pathPadding * 2),
                elements.canvas.height / (pathHeight + config.view.pathPadding * 2)
            ),
            config.zoom.minPathScale
        );

        // Calculate offsets to center the path
        const targetOffsetX = (elements.canvas.width - state.mapImage.width * targetScale) / 2;
        const targetOffsetY = (elements.canvas.height - state.mapImage.height * targetScale) / 2;

        // Adjust offsets to center on the midpoint
        const finalOffsetX = targetOffsetX - (midX - state.mapImage.width / 2) * targetScale;
        const finalOffsetY = targetOffsetY - (midY - state.mapImage.height / 2) * targetScale;

        // Apply changes immediately
        state.zoomLevel = targetScale;
        state.zoomCenter.x = finalOffsetX;
        state.zoomCenter.y = finalOffsetY;

        // Save the new zoom state
        saveZoomState();
        drawMap();
    }
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
    ) * config.zoom.base;

    // Apply zoom level
    let scale = state.zoomLevel;
    let offsetX = state.zoomCenter.x;
    let offsetY = state.zoomCenter.y;

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
    // elements.ctx.strokeStyle = 'rgba(0, 0, 255, 0.6)';
    // elements.ctx.lineWidth = 2 / scale;

    // let drawnEdges = 0;

    // state.graphData.forEach(edge => {
    //     if (isNaN(edge.x1) || isNaN(edge.y1) || isNaN(edge.x2) || isNaN(edge.y2)) return;

    //     elements.ctx.beginPath();
    //     elements.ctx.moveTo(edge.x1, edge.y1);
    //     elements.ctx.lineTo(edge.x2, edge.y2);
    //     elements.ctx.stroke();
    //     drawnEdges++;
    // });

    // console.log(`Drew ${drawnEdges} edges out of ${state.graphData.length} total afds`);
}

function drawPath(scale) {
    elements.ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
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
        if (state.selectedPlace && state.selectedPlace.id === place.id) {
            elements.ctx.beginPath();
            elements.ctx.arc(place.imageX, place.imageY, 5 / scale, 0, Math.PI * 2);

            if (state.selectedPlace && state.selectedPlace.id === place.id) {
                elements.ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            }

            elements.ctx.fill();
            elements.ctx.font = `${12 / scale}px Arial`;
            elements.ctx.fillStyle = 'black';
            elements.ctx.textAlign = 'center';
            elements.ctx.fillText(place.name, place.imageX, place.imageY - 10 / scale);
        }
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

                    const isInBounds = position.coords.longitude >= config.mapBounds.lonMin &&
                        position.coords.longitude <= config.mapBounds.lonMax &&
                        position.coords.latitude >= config.mapBounds.latMin &&
                        position.coords.latitude <= config.mapBounds.latMax;

                    if (!isInBounds) {
                        console.warn('GPS coordinates outside map bounds');
                        setDefaultLocation();
                        // Don't stop watching - keep monitoring for when user comes back in bounds
                    } else {
                        // If we were using default location and now have valid coordinates, update
                        if (state.userLocation &&
                            state.userLocation.latitude === config.defaultLocation.latitude &&
                            state.userLocation.longitude === config.defaultLocation.longitude) {
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
        latitude: config.defaultLocation.latitude,
        longitude: config.defaultLocation.longitude,
        imageX: config.defaultLocation.imageX,
        imageY: config.defaultLocation.imageY
    };

    elements.locationInfo.textContent = 'Your location: [Default]';
    updateCoordinatesDisplay(state.userLocation.latitude, state.userLocation.longitude);
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

    // Reset view button
    document.getElementById('reset-view-btn').addEventListener('click', resetZoom);


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

        // Get the canvas rect to account for any canvas positioning
        const rect = elements.canvas.getBoundingClientRect();

        // Calculate mouse position relative to canvas
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Use current zoom level
        const scale = state.zoomLevel;
        const offsetX = state.zoomCenter.x;
        const offsetY = state.zoomCenter.y;

        // Calculate image coordinates using current zoom
        const imageX = (mouseX - offsetX) / scale;
        const imageY = (mouseY - offsetY) / scale;

        if (imageX >= 0 && imageX <= state.mapImage.width && imageY >= 0 && imageY <= state.mapImage.height) {
            const gps = imageToGpsCoordinates(imageX, imageY);

            console.log('Manual location set:', gps);
            console.log('Mouse position:', mouseX, mouseY);
            console.log('Image coordinates:', imageX, imageY);
            console.log('Scale:', scale);
            console.log('Offset:', offsetX, offsetY);

            state.userLocation = {
                latitude: gps.latitude,
                longitude: gps.longitude,
                imageX: imageX,
                imageY: imageY
            };

            elements.locationInfo.textContent = 'Your selected location:';
            updateCoordinatesDisplay(gps.latitude, gps.longitude);

            // Exit location select mode first
            state.isLocationSelectMode = false;
            elements.locationSelectMode.style.display = 'none';
            elements.canvas.style.cursor = 'default';

            // Then update path and zoom if there's a selected place
            if (state.selectedPlace) {
                findPath(state.userLocation, state.selectedPlace);
            } else {
                // If no place is selected, just zoom to the user location
                const baseScale = Math.min(
                    elements.canvas.width / state.mapImage.width,
                    elements.canvas.height / state.mapImage.height
                ) * config.zoom.base;

                const targetScale = baseScale * config.zoom.singlePoint;
                
                // Calculate new offsets to center on the user location
                const centerX = elements.canvas.width / 2;
                const centerY = elements.canvas.height / 2;
                const newOffsetX = centerX - imageX * targetScale;
                const newOffsetY = centerY - imageY * targetScale;

                // Apply changes immediately
                state.zoomLevel = targetScale;
                state.zoomCenter.x = newOffsetX;
                state.zoomCenter.y = newOffsetY;

                drawMap();
            }

            if (state.debugMode) {
                updateDebugInfo();
            }
        }
    });

    // Window resize
    window.addEventListener('resize', () => {
        // Save current zoom state before resize
        const savedZoomLevel = state.zoomLevel;
        const savedCenterX = state.zoomCenter.x;
        const savedCenterY = state.zoomCenter.y;

        resizeCanvas();

        // Restore zoom state after resize
        state.zoomLevel = savedZoomLevel;
        state.zoomCenter.x = savedCenterX;
        state.zoomCenter.y = savedCenterY;

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

    // Mouse wheel zoom
    elements.canvas.addEventListener('wheel', (event) => {
        event.preventDefault();

        const delta = -event.deltaY * 0.001;
        const zoomFactor = Math.exp(delta * config.zoom.wheelStep);

        const newScale = state.zoomLevel * zoomFactor;
        const clampedScale = Math.min(Math.max(newScale, config.zoom.min), config.zoom.max);

        if (clampedScale !== state.zoomLevel) {
            const rect = elements.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            const imageX = (mouseX - state.zoomCenter.x) / state.zoomLevel;
            const imageY = (mouseY - state.zoomCenter.y) / state.zoomLevel;
            
            const newOffsetX = mouseX - imageX * clampedScale;
            const newOffsetY = mouseY - imageY * clampedScale;

            state.zoomLevel = clampedScale;
            state.zoomCenter.x = newOffsetX;
            state.zoomCenter.y = newOffsetY;
            drawMap();
            saveZoomState();
        }
    });

    // Drag functionality
    elements.canvas.addEventListener('mousedown', (event) => {
        if (event.button === 0 && !state.isLocationSelectMode) { // Left mouse button and not in location select mode
            state.isDragging = true;
            state.dragStart = { x: event.clientX, y: event.clientY };
            state.lastDragPosition = { x: state.zoomCenter.x, y: state.zoomCenter.y };
            elements.canvas.style.cursor = 'grabbing';
        }
    });

    elements.canvas.addEventListener('mousemove', (event) => {
        if (state.isDragging) {
            const dx = event.clientX - state.dragStart.x;
            const dy = event.clientY - state.dragStart.y;

            state.zoomCenter.x = state.lastDragPosition.x + dx;
            state.zoomCenter.y = state.lastDragPosition.y + dy;
            drawMap();
        }
    });

    elements.canvas.addEventListener('mouseup', () => {
        if (state.isDragging) {
            state.isDragging = false;
            elements.canvas.style.cursor = 'grab';
        }
    });

    elements.canvas.addEventListener('mouseleave', () => {
        if (state.isDragging) {
            state.isDragging = false;
            elements.canvas.style.cursor = 'grab';
        }
    });

    // Enhanced touch state management
    let touchState = {
        isPinching: false,
        initialDistance: 0,
        initialScale: 1,
        lastTouchX: 0,
        lastTouchY: 0,
        startX: 0,
        startY: 0,
        lastCenterX: 0,
        lastCenterY: 0,
        lastScale: 1,
        velocityX: 0,
        velocityY: 0,
        lastTouchTime: 0,
        isDragging: false,
        lastPinchCenter: { x: 0, y: 0 },
        touchStartTime: 0,
        lastTouchDistance: 0,
        pinchVelocity: 0
    };

    // Enhanced touch event handlers
    elements.canvas.addEventListener('touchstart', (event) => {
        if (event.touches.length === 2) {
            event.preventDefault();
            touchState.isPinching = true;
            touchState.isDragging = false;
            
            // Calculate initial distance between two touches
            touchState.initialDistance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );
            touchState.lastTouchDistance = touchState.initialDistance;
            touchState.initialScale = state.zoomLevel;
            touchState.lastScale = state.zoomLevel;
            touchState.touchStartTime = performance.now();
            touchState.pinchVelocity = 0;

            // Calculate center point of the pinch
            const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
            const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
            
            // Store the center point in image coordinates
            touchState.lastCenterX = (centerX - state.zoomCenter.x) / state.zoomLevel;
            touchState.lastCenterY = (centerY - state.zoomCenter.y) / state.zoomLevel;
            touchState.lastPinchCenter = { x: centerX, y: centerY };
        } else if (event.touches.length === 1 && !state.isLocationSelectMode) {
            const touch = event.touches[0];
            touchState.isDragging = true;
            touchState.startX = touch.clientX;
            touchState.startY = touch.clientY;
            touchState.lastTouchX = state.zoomCenter.x;
            touchState.lastTouchY = state.zoomCenter.y;
            touchState.lastTouchTime = performance.now();
            touchState.velocityX = 0;
            touchState.velocityY = 0;
            touchState.touchStartTime = performance.now();
        }
    });

    elements.canvas.addEventListener('touchmove', (event) => {
        if (event.touches.length === 2 && touchState.isPinching) {
            event.preventDefault();
            
            const currentTime = performance.now();
            const deltaTime = currentTime - touchState.lastTouchTime;
            
            // Calculate current distance between touches
            const currentDistance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );

            // Calculate pinch velocity
            if (deltaTime > 0) {
                touchState.pinchVelocity = (currentDistance - touchState.lastTouchDistance) / deltaTime;
            }
            touchState.lastTouchDistance = currentDistance;
            touchState.lastTouchTime = currentTime;

            // Calculate new scale with smoothing and velocity
            const rawScale = touchState.initialScale * (currentDistance / touchState.initialDistance);
            const smoothedScale = touchState.lastScale + (rawScale - touchState.lastScale) * 0.3;
            const clampedScale = Math.min(Math.max(smoothedScale, config.zoom.min), config.zoom.max);

            if (Math.abs(clampedScale - state.zoomLevel) > 0.001) {
                // Calculate current center point of the pinch
                const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
                const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;

                // Calculate new offsets to keep the pinch center point fixed
                const newOffsetX = centerX - touchState.lastCenterX * clampedScale;
                const newOffsetY = centerY - touchState.lastCenterY * clampedScale;

                // Apply changes with smoothing
                state.zoomLevel = clampedScale;
                state.zoomCenter.x = newOffsetX;
                state.zoomCenter.y = newOffsetY;
                touchState.lastScale = clampedScale;
                touchState.lastPinchCenter = { x: centerX, y: centerY };
                drawMap();
                saveZoomState();
            }
        } else if (event.touches.length === 1 && touchState.isDragging && !touchState.isPinching) {
            event.preventDefault();
            const touch = event.touches[0];
            const currentTime = performance.now();
            const deltaTime = currentTime - touchState.lastTouchTime;
            
            if (deltaTime > 0) {
                const dx = touch.clientX - touchState.startX;
                const dy = touch.clientY - touchState.startY;
                
                // Calculate velocity with smoothing
                const newVelocityX = dx / deltaTime;
                const newVelocityY = dy / deltaTime;
                touchState.velocityX = touchState.velocityX * 0.5 + newVelocityX * 0.5;
                touchState.velocityY = touchState.velocityY * 0.5 + newVelocityY * 0.5;
                
                // Apply movement with smoothing
                state.zoomCenter.x = touchState.lastTouchX + dx;
                state.zoomCenter.y = touchState.lastTouchY + dy;
                
                touchState.lastTouchTime = currentTime;
                drawMap();
                saveZoomState();
            }
        }
    });

    elements.canvas.addEventListener('touchend', (event) => {
        if (event.touches.length < 2) {
            touchState.isPinching = false;
            
            // Apply momentum for both panning and zooming
            const momentum = () => {
                let hasMomentum = false;
                
                // Pan momentum
                if (Math.abs(touchState.velocityX) > 0.1 || Math.abs(touchState.velocityY) > 0.1) {
                    state.zoomCenter.x += touchState.velocityX * 16;
                    state.zoomCenter.y += touchState.velocityY * 16;
                    
                    // Apply friction
                    touchState.velocityX *= 0.95;
                    touchState.velocityY *= 0.95;
                    hasMomentum = true;
                }
                
                // Zoom momentum
                if (Math.abs(touchState.pinchVelocity) > 0.1) {
                    const zoomFactor = 1 + touchState.pinchVelocity * 0.1;
                    const newScale = state.zoomLevel * zoomFactor;
                    const clampedScale = Math.min(Math.max(newScale, config.zoom.min), config.zoom.max);
                    
                    if (clampedScale !== state.zoomLevel) {
                        // Calculate center point for zoom
                        const centerX = elements.canvas.width / 2;
                        const centerY = elements.canvas.height / 2;
                        
                        // Convert center to image coordinates
                        const imageX = (centerX - state.zoomCenter.x) / state.zoomLevel;
                        const imageY = (centerY - state.zoomCenter.y) / state.zoomLevel;
                        
                        // Calculate new offsets
                        const newOffsetX = centerX - imageX * clampedScale;
                        const newOffsetY = centerY - imageY * clampedScale;
                        
                        state.zoomLevel = clampedScale;
                        state.zoomCenter.x = newOffsetX;
                        state.zoomCenter.y = newOffsetY;
                        hasMomentum = true;
                    }
                    
                    // Apply friction to zoom velocity
                    touchState.pinchVelocity *= 0.95;
                }
                
                if (hasMomentum) {
                    drawMap();
                    saveZoomState();
                    requestAnimationFrame(momentum);
                }
            };
            
            requestAnimationFrame(momentum);
        }
        
        if (event.touches.length === 0) {
            touchState.isDragging = false;
            touchState.startX = 0;
            touchState.startY = 0;
            touchState.lastTouchX = 0;
            touchState.lastTouchY = 0;
            touchState.velocityX = 0;
            touchState.velocityY = 0;
            touchState.lastPinchCenter = { x: 0, y: 0 };
            touchState.pinchVelocity = 0;
        }
    });

    elements.canvas.addEventListener('touchcancel', (event) => {
        touchState.isPinching = false;
        touchState.isDragging = false;
        touchState.startX = 0;
        touchState.startY = 0;
        touchState.lastTouchX = 0;
        touchState.lastTouchY = 0;
        touchState.velocityX = 0;
        touchState.velocityY = 0;
        touchState.lastPinchCenter = { x: 0, y: 0 };
        touchState.pinchVelocity = 0;
    });

    // Add touch-action CSS to prevent browser handling
    elements.canvas.style.touchAction = 'none';

    // Zoom controls
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');

    // Function to handle zoom
    function handleZoom(isZoomIn) {
        const zoomFactor = isZoomIn ? (1 + config.zoom.buttonStep) : (1 / (1 + config.zoom.buttonStep));
        const newScale = state.zoomLevel * zoomFactor;
        const clampedScale = isZoomIn ? 
            Math.min(newScale, config.zoom.max) : 
            Math.max(newScale, config.zoom.min);

        if (clampedScale !== state.zoomLevel) {
            // Get the center of the screen
            const centerX = elements.canvas.width / 2;
            const centerY = elements.canvas.height / 2;
            
            // Convert screen center to image coordinates
            const imageX = (centerX - state.zoomCenter.x) / state.zoomLevel;
            const imageY = (centerY - state.zoomCenter.y) / state.zoomLevel;
            
            // Calculate new offsets to keep the center point fixed
            const newOffsetX = centerX - imageX * clampedScale;
            const newOffsetY = centerY - imageY * clampedScale;

            // Apply changes immediately without animation
            state.zoomLevel = clampedScale;
            state.zoomCenter.x = newOffsetX;
            state.zoomCenter.y = newOffsetY;
            drawMap();
        }
    }

    // Add click and touch events for zoom in
    zoomIn.addEventListener('click', () => handleZoom(true));
    zoomIn.addEventListener('touchend', () => {
        handleZoom(true);
    });

    // Add click and touch events for zoom out
    zoomOut.addEventListener('click', () => handleZoom(false));
    zoomOut.addEventListener('touchend', () => {
        handleZoom(false);
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
    if (state.userLocation) {
        // Clear the path and selection first
        state.pathToDestination = null;
        state.selectedPlace = null;
        elements.locationInfo.textContent = 'Your location:';
        updatePlacesList();

        // Calculate new zoom level centered on user location
        const baseScale = Math.min(
            elements.canvas.width / state.mapImage.width,
            elements.canvas.height / state.mapImage.height
        ) * config.zoom.base;

        const targetScale = baseScale * config.zoom.singlePoint;
        const targetOffsetX = (elements.canvas.width - state.mapImage.width * targetScale) / 2;
        const targetOffsetY = (elements.canvas.height - state.mapImage.height * targetScale) / 2;

        // Adjust offsets to center on the user location
        const finalOffsetX = targetOffsetX - (state.userLocation.imageX - state.mapImage.width / 2) * targetScale;
        const finalOffsetY = targetOffsetY - (state.userLocation.imageY - state.mapImage.height / 2) * targetScale;

        // Apply changes immediately
        state.zoomLevel = targetScale;
        state.zoomCenter.x = finalOffsetX;
        state.zoomCenter.y = finalOffsetY;
        drawMap();
        
        // Clear saved zoom state
        localStorage.removeItem('mapZoomState');
    }
}

// Add mobile-friendly controls setup
function setupMobileControls() {
    // Make controls visible by default on mobile
    if (isMobile) {
        state.isControlsVisible = true;
        elements.controls.style.display = 'block';
        elements.toggleControlsBtn.textContent = 'Hide Controls';
    }
}

// Add zoom state persistence
function saveZoomState() {
    try {
        // Only save if we have valid numbers
        if (!isNaN(state.zoomLevel) && !isNaN(state.zoomCenter.x) && !isNaN(state.zoomCenter.y)) {
            localStorage.setItem('mapZoomState', JSON.stringify({
                zoomLevel: state.zoomLevel,
                zoomCenter: {
                    x: state.zoomCenter.x,
                    y: state.zoomCenter.y
                }
            }));
        }
    } catch (e) {
        console.error('Error saving zoom state:', e);
    }
}

function loadZoomState() {
    const savedState = localStorage.getItem('mapZoomState');
    if (savedState) {
        const { zoomLevel, zoomCenter } = JSON.parse(savedState);
        state.zoomLevel = zoomLevel;
        state.zoomCenter = zoomCenter;
        return true;
    }
    return false;
}
