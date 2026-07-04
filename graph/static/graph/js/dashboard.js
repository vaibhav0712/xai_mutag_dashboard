/**
 * Main dashboard application entry point.
 * Wires together the API service, Cytoscape graph, and UI elements.
 */

import { fetchMolecules, fetchExplanation } from './modules/api.js';
import { initCytoscape, updateGraphData } from './modules/cytoscape-config.js';
import {
    initUIListeners,
    setupMoleculeLists,
    showDashboardView,
    toggleLoadingOverlay,
    addLoadingStep,
    updateDashboardSummary,
    updateDetailsPanel,
    hideDetailsPanel
} from './modules/ui.js';

let cyInstanceInitialized = false;

/**
 * Formats backend normalized graph data into Cytoscape-compatible format.
 * @param {Object} graphData - Normalized graph data with nodes and edges.
 * @returns {Array} List of elements for Cytoscape.
 */
function formatCytoscapeElements(graphData) {
    const elements = [];
    
    if (graphData.nodes) {
        graphData.nodes.forEach(node => {
            elements.push({
                data: {
                    id: String(node.id),
                    label: node.label,
                    role: 'evidence', // Uniform node styling, element colors handled by stylesheet functions
                    isTarget: false,
                    isPrediction: false,
                    element: node.element || 'Unknown',
                    importance: parseFloat(node.importance_score || 0)
                }
            });
        });
    }
    
    if (graphData.edges) {
        graphData.edges.forEach(edge => {
            elements.push({
                data: {
                    id: edge.id,
                    source: String(edge.source),
                    target: String(edge.target),
                    label: edge.label,
                    bond_type: String(edge.label),
                    importance: parseFloat(edge.importance_score || 0)
                }
            });
        });
    }
    
    return elements;
}

/**
 * Executes explainer run for a selected molecule, showing loading steps and updating view.
 * @param {Object} mol - The molecule item.
 */
function handleMoleculeSelect(mol) {
    // Show loader
    toggleLoadingOverlay(true);
    addLoadingStep("Establishing connection with Django backend...");
    
    // Start backend explain task
    const apiPromise = fetchExplanation(mol.uri);
    
    // Add visual pipeline feedback steps
    setTimeout(() => addLoadingStep("Loading Mutagenicity GNN model & stripped RDF Knowledge Graph..."), 200);
    setTimeout(() => addLoadingStep(`Running model prediction for molecule ID: ${mol.id}...`), 450);
    setTimeout(() => addLoadingStep("Executing PyG GNNExplainer (node attribute mask optimization: 200 epochs)..."), 700);
    
    // Ensure loader displays for at least 1.2s for clean readability of steps
    const minDelayPromise = new Promise(resolve => setTimeout(resolve, 1200));
    
    Promise.all([apiPromise, minDelayPromise])
        .then(([data]) => {
            addLoadingStep("Explanation payload generated successfully! Building graph...");
            
            setTimeout(() => {
                // Hide loader and show dashboard panels
                toggleLoadingOverlay(false);
                showDashboardView();
                
                // Format graph data for cytoscape
                const cyElements = formatCytoscapeElements(data.graph_data || {});
                
                // Initialize or update Cytoscape canvas
                if (!cyInstanceInitialized) {
                    const cyContainer = document.getElementById('cy');
                    initCytoscape(cyContainer, cyElements, {
                        onNodeSelect: (node) => updateDetailsPanel(node),
                        onSelectionClear: () => hideDetailsPanel()
                    });
                    cyInstanceInitialized = true;
                } else {
                    updateGraphData(cyElements, 'fcose');
                }
                
                // Update stats and labels in UI
                updateDashboardSummary(data);
            }, 300);
        })
        .catch(error => {
            console.error(error);
            toggleLoadingOverlay(false);
            alert(`Failed to run GNNExplainer: ${error.message}`);
        });
}

// Initialise application on DOM load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing Molecule XAI Explainer...');
        
        // Hide dashboard and show selector initially (default HTML state)
        toggleLoadingOverlay(true);
        addLoadingStep("Fetching dataset splits...");
        
        // Fetch molecule splits from endpoint
        const molecules = await fetchMolecules();
        
        toggleLoadingOverlay(false);
        
        // Setup initial list grid rendering
        setupMoleculeLists(molecules, handleMoleculeSelect);
        
        // Configure sidebar and viewport event actions
        initUIListeners({
            onMoleculeSelect: handleMoleculeSelect
        });
        
    } catch (error) {
        console.error('Initialization error:', error);
        toggleLoadingOverlay(false);
        alert(`Failed to load molecule dataset lists: ${error.message}`);
    }
});
