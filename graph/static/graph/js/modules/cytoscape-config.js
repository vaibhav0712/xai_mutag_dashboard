/**
 * Cytoscape Configuration and Graph Manipulations Module for Molecule Explanations.
 */

let cyInstance = null;
let currentSizingMode = 'element'; // 'element', 'importance', 'uniform'
let currentBaseSize = 50;

// Standard CPK Color Scheme for chemical elements
const atomColors = {
    carbon: '#374151',    // Slate 700
    hydrogen: '#e5e7eb',  // Light grey / White
    oxygen: '#ef4444',    // Red
    nitrogen: '#3b82f6',  // Blue
    sulfur: '#f59e0b',    // Amber / Yellow
    sodium: '#8b5cf6',    // Purple
    phosphorus: '#f97316',// Orange
    chlorine: '#10b981',  // Emerald / Green
    unknown: '#6b7280'    // Grey
};

const atomBorderColors = {
    carbon: '#111827',
    hydrogen: '#9ca3af',
    oxygen: '#991b1b',
    nitrogen: '#1e40af',
    sulfur: '#b45309',
    sodium: '#6d28d9',
    phosphorus: '#c2410c',
    chlorine: '#065f46',
    unknown: '#374151'
};

/**
 * Gets color for a node based on its element.
 */
function getAtomColor(node, type = 'bg') {
    const element = (node.data('element') || '').toLowerCase();
    const colors = type === 'bg' ? atomColors : atomBorderColors;
    
    if (element.startsWith('carbon')) return colors.carbon;
    if (element.startsWith('hydrogen')) return colors.hydrogen;
    if (element.startsWith('oxygen')) return colors.oxygen;
    if (element.startsWith('nitrogen')) return colors.nitrogen;
    if (element.startsWith('sulfur')) return colors.sulfur;
    if (element.startsWith('sodium')) return colors.sodium;
    if (element.startsWith('phosphorus')) return colors.phosphorus;
    if (element.startsWith('chlorine')) return colors.chlorine;
    return colors.unknown;
}

/**
 * Computes node size dynamically based on sizing mode and base size.
 */
function calculateNodeSize(node, sizingMode, baseSize) {
    if (sizingMode === 'element') {
        const element = (node.data('element') || '').toLowerCase();
        if (element.startsWith('hydrogen')) return baseSize * 0.7;
        if (element.startsWith('carbon')) return baseSize * 1.0;
        if (element.startsWith('oxygen') || element.startsWith('nitrogen')) return baseSize * 1.1;
        if (element.startsWith('sulfur')) return baseSize * 1.25;
        return baseSize * 1.0;
    } else if (sizingMode === 'importance') {
        const imp = node.data('importance') || 0.0;
        // Map importance score (0-1) to size multiplier (0.6x to 1.6x)
        return baseSize * (0.6 + imp * 1.0);
    } else {
        // Uniform
        return baseSize;
    }
}

/**
 * Resolves full element name to standard chemical symbol.
 */
function getElementSymbol(elementName) {
    const name = (elementName || '').toLowerCase();
    if (name.startsWith('carbon')) return 'C';
    if (name.startsWith('hydrogen')) return 'H';
    if (name.startsWith('oxygen')) return 'O';
    if (name.startsWith('nitrogen')) return 'N';
    if (name.startsWith('sulfur')) return 'S';
    if (name.startsWith('sodium')) return 'Na';
    if (name.startsWith('phosphorus')) return 'P';
    if (name.startsWith('chlorine')) return 'Cl';
    return name.substring(0, 2).toUpperCase();
}

/**
 * Generates an SVG data URI with the chemical symbol centered.
 */
function getElementSvgUri(elementName) {
    const symbol = getElementSymbol(elementName);
    const name = (elementName || '').toLowerCase();
    
    // Choose text color based on node background color
    let textColor = '#ffffff';
    if (name.startsWith('hydrogen') || name.startsWith('sulfur')) {
        textColor = '#1e293b'; // Dark slate for light nodes
    }
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50">
        <text x="25" y="25" dominant-baseline="central" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="18" fill="${textColor}" text-anchor="middle">${symbol}</text>
    </svg>`;
    
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Cytoscape style rules for molecules
const cyStyles = [
    // Standard Nodes (Styled as Atoms)
    {
        selector: 'node',
        style: {
            'shape': 'ellipse',
            'background-color': (node) => getAtomColor(node, 'bg'),
            'border-width': 2.5,
            'border-color': (node) => getAtomColor(node, 'border'),
            'width': (node) => calculateNodeSize(node, currentSizingMode, currentBaseSize),
            'height': (node) => calculateNodeSize(node, currentSizingMode, currentBaseSize),
            'background-image': (node) => getElementSvgUri(node.data('element')),
            'background-fit': 'contain',
            'background-clip': 'node',
            'label': (node) => (node.data('importance') || 0.0).toFixed(3),
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'font-size': 10,
            'font-family': 'Inter, sans-serif',
            'font-weight': 600,
            'color': '#0f172a', // Dark slate text for light mode
            'transition-property': 'width height border-width opacity border-color background-color',
            'transition-duration': '0.2s'
        }
    },
    // Selected Node State
    {
        selector: 'node.selected',
        style: {
            'border-width': 5,
            'border-color': '#f59e0b', // Glow outline
            'overlay-opacity': 0.15,
            'overlay-color': '#f59e0b'
        }
    },
    // Highlight Neighborhood State
    {
        selector: '.highlight',
        style: {
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'border-color': '#f59e0b'
        }
    },
    // Faded State
    {
        selector: '.faded',
        style: {
            'opacity': 0.15
        }
    },
    // Chemical Bonds (Edges)
    {
        selector: 'edge',
        style: {
            'curve-style': 'bezier',
            'target-arrow-shape': 'none', // Chemical bonds are bidirectional
            'line-color': '#4b5563', // Slate 600
            'line-style': (edge) => {
                const type = String(edge.data('bond_type') || '');
                if (type === '2') return 'double';
                if (type === '7') return 'dashed';
                return 'solid';
            },
            'width': function(edge) {
                // Map importance score (typically 0.0 to 1.0) to width 2 to 10
                const imp = edge.data('importance') || 0.5;
                return 2 + (imp * 6);
            },
            'label': (edge) => (edge.data('importance') || 0.0).toFixed(3),
            'font-size': 8.5,
            'font-family': 'Inter, sans-serif',
            'font-weight': 600,
            'color': '#475569', // Dark grey edge labels
            'text-background-color': '#ffffff', // White card bg
            'text-background-opacity': 0.95,
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            'text-border-width': 1,
            'text-border-color': '#cbd5e1', // Light border
            'text-border-opacity': 0.8,
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
            'transition-property': 'opacity line-color width',
            'transition-duration': '0.2s'
        }
    }
];

/**
 * Initializes Cytoscape in the given container.
 */
export function initCytoscape(container, elements, callbacks = {}) {
    cyInstance = cytoscape({
        container: container,
        elements: elements,
        style: cyStyles,
        layout: {
            name: 'fcose',
            quality: 'proof',
            animate: true,
            fit: true,
            padding: 50,
            randomize: true
        }
    });

    cyInstance.ready(() => {
        cyInstance.fit(50);
        cyInstance.center();
    });

    // Hover Node expansion
    cyInstance.on('mouseover', 'node', (evt) => {
        const node = evt.target;
        const width = node.width();
        const height = node.height();
        
        node.data('originalWidth', width);
        node.data('originalHeight', height);
        
        node.animate({
            style: {
                width: width + 8,
                height: height + 8
            }
        }, {
            duration: 100
        });
    });

    cyInstance.on('mouseout', 'node', (evt) => {
        const node = evt.target;
        const origWidth = node.data('originalWidth');
        const origHeight = node.data('originalHeight');
        
        if (origWidth && origHeight) {
            node.animate({
                style: {
                    width: origWidth,
                    height: origHeight
                }
            }, {
                duration: 100
            });
        }
    });

    // Selection click handlers
    cyInstance.on('tap', 'node', (evt) => {
        const node = evt.target;
        
        cyInstance.nodes().removeClass('selected');
        cyInstance.elements().removeClass('highlight');
        cyInstance.elements().removeClass('faded');
        
        node.addClass('selected');
        
        const neighborhood = node.closedNeighborhood();
        neighborhood.addClass('highlight');
        cyInstance.elements().difference(neighborhood).addClass('faded');
        
        cyInstance.animate({
            fit: {
                eles: neighborhood,
                padding: 80
            },
            duration: 500
        });

        if (callbacks.onNodeSelect) {
            callbacks.onNodeSelect(node);
        }
    });

    // Clear selection
    cyInstance.on('tap', (evt) => {
        if (evt.target === cyInstance) {
            resetGraphSelection();
            if (callbacks.onSelectionClear) {
                callbacks.onSelectionClear();
            }
        }
    });

    return cyInstance;
}

/**
 * Loads new elements and triggers layout.
 */
export function updateGraphData(elements, layoutName = 'fcose') {
    if (!cyInstance) return;
    cyInstance.elements().remove();
    cyInstance.add(elements);
    runLayout(layoutName);
}

/**
 * Runs a specific Cytoscape layout.
 */
export function runLayout(layoutName) {
    if (!cyInstance) return;
    
    let options = {
        name: layoutName,
        animate: true,
        fit: true,
        padding: 50
    };
    
    if (layoutName === 'fcose') {
        options = {
            ...options,
            quality: 'proof',
            randomize: true
        };
    }
    
    cyInstance.layout(options).run();
}

/**
 * Resets selection state.
 */
export function resetGraphSelection() {
    if (!cyInstance) return;
    cyInstance.elements().removeClass('selected highlight faded');
}

/**
 * Search and highlight a node.
 */
export function searchAndHighlightNode(query, onNodeFound) {
    if (!cyInstance || !query) return false;
    
    const formattedQuery = query.trim().toLowerCase();
    
    const matchedNode = cyInstance.nodes().filter(n => {
        const label = n.data('label') || '';
        return label.toLowerCase().includes(formattedQuery);
    }).first();
    
    if (matchedNode.length === 0) {
        return false;
    }
    
    cyInstance.nodes().removeClass('selected');
    cyInstance.elements().removeClass('highlight');
    cyInstance.elements().removeClass('faded');
    
    matchedNode.addClass('selected');
    const neighborhood = matchedNode.closedNeighborhood();
    neighborhood.addClass('highlight');
    cyInstance.elements().difference(neighborhood).addClass('faded');
    
    cyInstance.animate({
        fit: {
            eles: neighborhood,
            padding: 80
        },
        duration: 500
    });
    
    if (onNodeFound) {
        onNodeFound(matchedNode);
    }
    
    return true;
}

/**
 * Zooms.
 */
export function zoomGraph(factor) {
    if (!cyInstance) return;
    cyInstance.zoom({
        level: cyInstance.zoom() * factor,
        renderedPosition: {
            x: cyInstance.width() / 2,
            y: cyInstance.height() / 2
        }
    });
}

/**
 * Fits graph.
 */
export function fitGraph() {
    if (!cyInstance) return;
    cyInstance.fit(60);
}

/**
 * Export to PNG.
 */
export function exportGraphPNG() {
    if (!cyInstance) return;
    
    const png = cyInstance.png({
        full: true,
        scale: 3,
        bg: '#ffffff' // Light background
    });
    
    const link = document.createElement('a');
    link.href = png;
    link.download = 'MoleculeExplanationGraph.png';
    link.click();
}

/**
 * Dynamically adjusts node base sizes and sizing mode.
 */
export function adjustNodeSizing(mode, baseSize) {
    if (!cyInstance) return;
    
    if (mode !== undefined) currentSizingMode = mode;
    if (baseSize !== undefined) currentBaseSize = baseSize;
    
    cyInstance.nodes().forEach(node => {
        const size = calculateNodeSize(node, currentSizingMode, currentBaseSize);
        node.style({
            'width': size,
            'height': size
        });
    });
}

/**
 * Filters edges by importance.
 */
export function filterEdgesByImportance(threshold) {
    if (!cyInstance) return;
    
    cyInstance.edges().forEach(edge => {
        const importance = edge.data('importance') || 0;
        if (importance >= threshold) {
            edge.style({
                'opacity': 1.0,
                'pointer-events': 'auto'
            });
        } else {
            edge.style({
                'opacity': 0.05,
                'pointer-events': 'none'
            });
        }
    });
}
