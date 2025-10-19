// Initialize the map and layer variables
let map;
let facilityLayers = {};
let activeLayers = new Set();

// Define facility configurations
const facilityConfigs = {
    mrf: {
        file: 'facilities-data/PaperFacilities.geojson',
        color: '#FF6B6B',
        name: 'MRF',
        description: 'Material Recovery Facilities',
        filter: (feature) => feature.properties.Infra_Type === 'MRF'
    },
    glass: {
        file: 'facilities-data/GlassFacilities.geojson',
        color: '#4ECDC4',
        name: 'Glass Recycling',
        description: 'Glass Recycling Facilities',
        filter: (feature) => feature.properties.Infra_Type === 'Glass Recycling Facility'
    },
    'glass-secondary': {
        file: 'facilities-data/GlassSecondaryFacilities.geojson',
        color: '#45B7D1',
        name: 'Glass Secondary',
        description: 'Glass Secondary Processors',
        filter: (feature) => feature.properties.Infra_Type === 'Glass Secondary Processors'
    },
    plastic: {
        file: null, // No plastic-specific file found in the data
        color: '#96CEB4',
        name: 'Plastic Recycling',
        description: 'Plastic Recycling Facilities',
        filter: () => false // No data available
    },
    paper: {
        file: 'facilities-data/PaperSecondaryFacilities.geojson',
        color: '#FFEAA7',
        name: 'Paper',
        description: 'Paper Recycling Facilities',
        filter: (feature) => feature.properties.Infra_Type === 'Paper Recycling Facility'
    },
    'paper-secondary': {
        file: 'facilities-data/PaperSecondaryFacilities.geojson',
        color: '#DDA0DD',
        name: 'Paper Secondary',
        description: 'Paper Secondary Processors',
        filter: (feature) => feature.properties.Infra_Type === 'Paper Recycling Facility'
    },
    electronics: {
        file: 'facilities-data/ElectronicsFacilities.geojson',
        color: '#FFB347',
        name: 'Electronics',
        description: 'Electronics Recycling Facilities',
        filter: (feature) => feature.properties.Infra_Type === 'Electronics Recycler'
    },
    wood: {
        file: 'facilities-data/WoodFacilities.geojson',
        color: '#8B4513',
        name: 'Wood Recycling',
        description: 'Wood Recycling Facilities',
        filter: (feature) => feature.properties.Infra_Type === 'Wood Recycling Facility'
    },
    'wood-secondary': {
        file: 'facilities-data/WoodSecondaryFacilities.geojson',
        color: '#A0522D',
        name: 'Wood Secondary',
        description: 'Wood Secondary Processors',
        filter: (feature) => feature.properties.Infra_Type === 'Wood Secondary Processors'
    },
    transfer: {
        file: null, // No transfer station specific data found
        color: '#708090',
        name: 'Transfer Stations',
        description: 'Transfer Stations',
        filter: () => false // No data available
    }
};

// Initialize the map when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupFilterButtons();
    loadAllFacilities();
});

function initializeMap() {
    // Initialize the map centered on the United States
    map = L.map('map').setView([39.8283, -98.5795], 4);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    console.log('Map initialized');
}

function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const layerType = this.getAttribute('data-layer');
            toggleLayer(layerType, this);
        });
    });
}

async function loadAllFacilities() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.innerHTML = '<div class="spinner"></div>';
    document.getElementById('map').appendChild(loadingDiv);

    try {
        // Load all facility layers and update button states
        const loadPromises = Object.keys(facilityConfigs).map(async (layerType) => {
            try {
                await loadFacilityLayer(layerType);
                updateButtonState(layerType);
            } catch (error) {
                console.warn(`Failed to load ${layerType}:`, error);
                updateButtonState(layerType, false);
            }
        });

        await Promise.all(loadPromises);
        
        // Remove loading indicator
        document.getElementById('map').removeChild(loadingDiv);
        
        console.log('All facilities loaded successfully');
    } catch (error) {
        console.error('Error loading facilities:', error);
        document.getElementById('map').removeChild(loadingDiv);
    }
}

function updateButtonState(layerType, hasData = true) {
    const button = document.querySelector(`[data-layer="${layerType}"]`);
    const config = facilityConfigs[layerType];
    
    if (!button) return;
    
    if (!config.file || !hasData) {
        button.disabled = true;
        button.classList.add('disabled');
        button.title = 'No data available for this facility type';
    } else {
        button.disabled = false;
        button.classList.remove('disabled');
        button.title = `Click to toggle ${config.description}`;
    }
}

async function loadFacilityLayer(layerType) {
    const config = facilityConfigs[layerType];
    
    // Skip loading if no file is specified (like plastic and transfer stations)
    if (!config.file) {
        console.log(`No data file available for ${config.name}`);
        facilityLayers[layerType] = L.layerGroup(); // Create empty layer
        return;
    }
    
    try {
        const response = await fetch(config.file);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Filter features if needed
        let features = data.features;
        if (config.filter) {
            features = features.filter(config.filter);
        }
        
        // Transform coordinates from Web Mercator (EPSG:3857) to WGS84 (EPSG:4326) if needed
        if (data.crs && data.crs.properties && data.crs.properties.name === 'EPSG:3857') {
            features = features.map(feature => {
                if (feature.geometry && feature.geometry.type === 'Point') {
                    const coords = feature.geometry.coordinates;
                    // Transform from Web Mercator (meters) to WGS84 (degrees)
                    const x = coords[0];
                    const y = coords[1];
                    
                    // Web Mercator to WGS84 conversion
                    const lng = x / 20037508.34 * 180;
                    let lat = y / 20037508.34 * 180;
                    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
                    
                    feature.geometry.coordinates = [lng, lat];
                }
                return feature;
            });
        }
        
        // Create GeoJSON layer
        const layer = L.geoJSON(features, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: config.color,
                    color: '#fff',
                    weight: 2,
                    opacity: 0.9,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: function(feature, layer) {
                // Create popup content
                const props = feature.properties;
                const popupContent = `
                    <div class="facility-popup">
                        <h4>${props.Name || 'Unknown Facility'}</h4>
                        ${props.Infra_Type ? `<p><strong>Type:</strong> ${props.Infra_Type}</p>` : ''}
                        ${props.Street ? `<p><strong>Address:</strong> ${props.Street}${props.City ? ', ' + props.City : ''}${props.State ? ', ' + props.State : ''}${props.Zip_Code ? ' ' + props.Zip_Code : ''}</p>` : ''}
                        ${props.TELEPHONE ? `<p><strong>Phone:</strong> ${props.TELEPHONE}</p>` : ''}
                        ${props.Email ? `<p><strong>Email:</strong> <a href="mailto:${props.Email}">${props.Email}</a></p>` : ''}
                        ${props.Website ? `<p><strong>Website:</strong> <a href="${props.Website}" target="_blank">${props.Website}</a></p>` : ''}
                        ${props.Feedstock ? `<p><strong>Feedstock:</strong> ${props.Feedstock}</p>` : ''}
                    </div>
                `;
                layer.bindPopup(popupContent);
                
                // Add hover effect
                layer.on('mouseover', function(e) {
                    this.setStyle({
                        radius: 10,
                        fillOpacity: 1
                    });
                });
                layer.on('mouseout', function(e) {
                    this.setStyle({
                        radius: 8,
                        fillOpacity: 0.8
                    });
                });
            }
        });

        // Store the layer
        facilityLayers[layerType] = layer;
        
        console.log(`Loaded ${features.length} ${config.name} facilities`);
        
    } catch (error) {
        console.error(`Error loading ${layerType} facilities:`, error);
        // Create empty layer on error
        facilityLayers[layerType] = L.layerGroup();
    }
}

function toggleLayer(layerType, buttonElement) {
    // Don't toggle if button is disabled
    if (buttonElement.disabled || buttonElement.classList.contains('disabled')) {
        return;
    }
    
    const layer = facilityLayers[layerType];
    
    if (!layer) {
        console.warn(`Layer ${layerType} not found`);
        return;
    }

    if (activeLayers.has(layerType)) {
        // Remove layer from map
        map.removeLayer(layer);
        activeLayers.delete(layerType);
        buttonElement.classList.remove('active');
        console.log(`Hid ${layerType} layer`);
    } else {
        // Add layer to map
        layer.addTo(map);
        activeLayers.add(layerType);
        buttonElement.classList.add('active');
        console.log(`Showed ${layerType} layer`);
        
        // Fit map to show the layer bounds if it's the first layer
        // if (activeLayers.size === 1) {
        //     setTimeout(() => {
        //         try {
        //             map.fitBounds(layer.getBounds(), { padding: [20, 20] });
        //         } catch (e) {
        //             console.log('Could not fit bounds for layer:', layerType);
        //         }
        //     }, 100);
        // }
    }
}

// Add some utility functions
function showAllLayers() {
    Object.keys(facilityLayers).forEach(layerType => {
        if (!activeLayers.has(layerType)) {
            const button = document.querySelector(`[data-layer="${layerType}"]`);
            if (button) {
                toggleLayer(layerType, button);
            }
        }
    });
}

function hideAllLayers() {
    const activeLayersArray = Array.from(activeLayers);
    activeLayersArray.forEach(layerType => {
        const button = document.querySelector(`[data-layer="${layerType}"]`);
        if (button) {
            toggleLayer(layerType, button);
        }
    });
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Press 'A' to show all layers
    if (e.key.toLowerCase() === 'a' && e.ctrlKey) {
        e.preventDefault();
        showAllLayers();
    }
    // Press 'H' to hide all layers
    if (e.key.toLowerCase() === 'h' && e.ctrlKey) {
        e.preventDefault();
        hideAllLayers();
    }
});

// Handle map resize
window.addEventListener('resize', function() {
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
});
