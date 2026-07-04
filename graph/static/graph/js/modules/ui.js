/**
 * UI Controller Module.
 * Coordinates DOM interactions, molecule list rendering, views hot-swapping, and loading states.
 */

import {
    runLayout,
    zoomGraph,
    fitGraph,
    resetGraphSelection,
    exportGraphPNG,
    adjustNodeSizing,
    filterEdgesByImportance,
    searchAndHighlightNode
} from './cytoscape-config.js';

// DOM Element Cache
const DOM = {
    // Views
    selectionView: document.getElementById('selectionView'),
    dashboardView: document.getElementById('dashboardView'),
    
    // Selection screen components
    trainTabBtn: document.getElementById('trainTabBtn'),
    testTabBtn: document.getElementById('testTabBtn'),
    selectionSearch: document.getElementById('selectionSearch'),
    moleculesList: document.getElementById('moleculesList'),
    
    // Global Header & Back Navigation
    backToSelectionBtn: document.getElementById('backToSelectionBtn'),
    
    // Sidebar Prediction Summary Cards
    targetLabel: document.getElementById('targetLabel'),
    predictionLabel: document.getElementById('predictionLabel'),
    trueLabel: document.getElementById('trueLabel'),
    confidenceLabel: document.getElementById('confidenceLabel'),
    
    // Sidebar Controls
    searchBox: document.getElementById('searchBox'),
    searchBtn: document.getElementById('searchBtn'),
    sizingModeSelect: document.getElementById('sizingModeSelect'),
    nodeSizeSlider: document.getElementById('nodeSize'),
    importanceSlider: document.getElementById('importanceSlider'),
    importanceValue: document.getElementById('importanceValue'),
    zoomInBtn: document.getElementById('zoomIn'),
    zoomOutBtn: document.getElementById('zoomOut'),
    fitGraphBtn: document.getElementById('fitGraph'),
    resetGraphBtn: document.getElementById('resetGraph'),
    exportPNGBtn: document.getElementById('exportPNG'),
    
    // Details panel
    detailsPanel: document.getElementById('detailsPanel'),
    detailsContent: document.getElementById('details'),
    detailsCloseBtn: document.getElementById('closeDetailsBtn'),
    
    // Statistics Footer
    nodeCount: document.getElementById('nodeCount'),
    edgeCount: document.getElementById('edgeCount'),
    avgImportance: document.getElementById('avgImportance'),
    maxImportance: document.getElementById('maxImportance'),
    
    // Loading overlay
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingSteps: document.getElementById('loadingSteps')
};

// Internal Cache of molecule data
let moleculesCache = { train: [], test: [] };
let activeTab = 'train'; // 'train' or 'test'

/**
 * Initializes all UI event listeners.
 * @param {Object} handlers - Callbacks for events.
 * @param {Function} handlers.onMoleculeSelect - Called when a molecule is selected for explanation.
 */
export function initUIListeners(handlers = {}) {
    // 1. Tab Switching
    DOM.trainTabBtn.addEventListener('click', () => {
        setTab('train');
    });
    DOM.testTabBtn.addEventListener('click', () => {
        setTab('test');
    });
    
    // 2. Search Molecules
    DOM.selectionSearch.addEventListener('input', () => {
        renderMoleculesGrid(handlers.onMoleculeSelect);
    });
    
    // 3. Back Button navigation
    const goBack = () => {
        DOM.dashboardView.style.display = 'none';
        DOM.backToSelectionBtn.style.display = 'none';
        DOM.selectionView.style.display = 'flex';
        DOM.selectionSearch.value = '';
        renderMoleculesGrid(handlers.onMoleculeSelect);
    };
    DOM.backToSelectionBtn.addEventListener('click', goBack);
    
    // 4. Sidebar Controls & Graph Actions
    const performGraphSearch = () => {
        const query = DOM.searchBox.value;
        if (!query.trim()) return;
        
        const found = searchAndHighlightNode(query, (node) => {
            updateDetailsPanel(node);
        });
        
        if (!found) {
            alert('Node not found in current explanation graph.');
        }
    };
    DOM.searchBtn.addEventListener('click', performGraphSearch);
    DOM.searchBox.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performGraphSearch();
    });
    
    DOM.zoomInBtn.addEventListener('click', () => zoomGraph(1.2));
    DOM.zoomOutBtn.addEventListener('click', () => zoomGraph(0.8));
    DOM.fitGraphBtn.addEventListener('click', fitGraph);
    DOM.resetGraphBtn.addEventListener('click', () => {
        resetGraphSelection();
        hideDetailsPanel();
        DOM.searchBox.value = '';
    });
    DOM.exportPNGBtn.addEventListener('click', exportGraphPNG);
    
    // Node Size and Sizing Mode selectors
    const handleNodeSizingUpdate = () => {
        const mode = DOM.sizingModeSelect.value;
        const baseSize = parseInt(DOM.nodeSizeSlider.value);
        adjustNodeSizing(mode, baseSize);
    };
    DOM.sizingModeSelect.addEventListener('change', handleNodeSizingUpdate);
    DOM.nodeSizeSlider.addEventListener('input', handleNodeSizingUpdate);
    
    // Importance threshold slider
    DOM.importanceSlider.addEventListener('input', function() {
        const val = parseFloat(this.value);
        filterEdgesByImportance(val);
        
        const minVal = parseFloat(DOM.importanceSlider.min);
        const maxVal = parseFloat(DOM.importanceSlider.max);
        DOM.importanceValue.innerHTML = `
            Threshold: ${val.toFixed(3)}<br>
            Range: ${minVal.toFixed(1)} - ${maxVal.toFixed(1)}
        `;
    });
    
    // Close Details Panel
    if (DOM.detailsCloseBtn) {
        DOM.detailsCloseBtn.addEventListener('click', hideDetailsPanel);
    }
}

/**
 * Caches and initializes the molecule sets to render them on screen.
 */
export function setupMoleculeLists(molecules, onMoleculeSelect) {
    moleculesCache = molecules;
    setTab('train'); // default to training set
    renderMoleculesGrid(onMoleculeSelect);
}

/**
 * Changes active tab and updates UI state.
 */
function setTab(tab) {
    activeTab = tab;
    if (tab === 'train') {
        DOM.trainTabBtn.classList.add('active');
        DOM.testTabBtn.classList.remove('active');
    } else {
        DOM.testTabBtn.classList.add('active');
        DOM.trainTabBtn.classList.remove('active');
    }
}

/**
 * Renders the molecule cards grid based on active tab and search input.
 */
function renderMoleculesGrid(onSelect) {
    const list = DOM.moleculesList;
    list.innerHTML = '';
    
    const searchVal = DOM.selectionSearch.value.trim().toLowerCase();
    const activeList = moleculesCache[activeTab] || [];
    
    // Filter molecules by search text
    const filtered = activeList.filter(mol => {
        return mol.id.toLowerCase().includes(searchVal);
    });
    
    if (filtered.length === 0) {
        list.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">No molecules match search criteria.</div>`;
        return;
    }
    
    filtered.forEach(mol => {
        const card = document.createElement('div');
        card.className = 'mol-card';
        
        const badgeClass = mol.label === 1 ? 'badge-mutagenic' : 'badge-nonmutagenic';
        const badgeText = mol.label === 1 ? 'Mutagenic' : 'Non-mutagenic';
        
        card.innerHTML = `
            <div class="mol-card-header">
                <span class="mol-id">${mol.id}</span>
                <span class="mol-badge ${badgeClass}">${badgeText}</span>
            </div>
            <button class="btn btn-secondary run-explainer-btn" data-uri="${mol.uri}">
                Run GNN Explainer
            </button>
        `;
        
        const btn = card.querySelector('.run-explainer-btn');
        btn.addEventListener('click', () => {
            if (onSelect) onSelect(mol);
        });
        
        list.appendChild(card);
    });
}

/**
 * Switches view from selection screen to explanation dashboard.
 */
export function showDashboardView() {
    DOM.selectionView.style.display = 'none';
    DOM.dashboardView.style.display = 'grid';
    DOM.backToSelectionBtn.style.display = 'inline-flex';
}

/**
 * Triggers loading overlay with steps.
 * @param {boolean} show - Whether to display.
 */
export function toggleLoadingOverlay(show) {
    if (show) {
        DOM.loadingOverlay.style.display = 'flex';
        DOM.loadingSteps.innerHTML = '';
    } else {
        DOM.loadingOverlay.style.display = 'none';
    }
}

/**
 * appends a log step in the loader list.
 * @param {string} stepText - The action text to show.
 */
export function addLoadingStep(stepText) {
    if (!DOM.loadingSteps) return;
    const p = document.createElement('p');
    p.textContent = `> ${stepText}`;
    DOM.loadingSteps.appendChild(p);
    DOM.loadingOverlay.scrollTop = DOM.loadingOverlay.scrollHeight; // Auto scroll
}

/**
 * Updates primary summary statistics and info cards on the dashboard.
 */
export function updateDashboardSummary(data) {
    DOM.targetLabel.textContent = data.target_label || 'N/A';
    
    // Color predicted outcomes
    const predVal = data.predicted_class_val;
    const isMut = predVal === 1;
    DOM.predictionLabel.textContent = data.predicted_class;
    DOM.predictionLabel.className = isMut ? 'badge-value badge-mutagenic' : 'badge-value badge-nonmutagenic';
    DOM.predictionLabel.style.borderColor = isMut ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)';
    DOM.predictionLabel.style.color = isMut ? 'var(--accent-rose)' : 'var(--accent-emerald)';
    DOM.predictionLabel.style.background = isMut ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    
    // Set true class
    const trueVal = data.true_class;
    DOM.trueLabel.textContent = trueVal;
    DOM.trueLabel.className = (trueVal === 'Mutagenic') ? 'mol-badge badge-mutagenic' : 'mol-badge badge-nonmutagenic';
    DOM.trueLabel.style.display = 'inline-block';
    DOM.trueLabel.style.marginTop = '4px';
    
    DOM.confidenceLabel.textContent = `${(data.confidence * 100).toFixed(2)}%`;
    
    // Calculate counts
    const nodes = data.graph_data.nodes;
    const edges = data.graph_data.edges;
    
    DOM.nodeCount.textContent = nodes.length;
    DOM.edgeCount.textContent = edges.length;
    
    // Calculate importance stats
    if (edges.length > 0) {
        let totalImp = 0;
        let maxImp = -Infinity;
        let minImp = Infinity;
        
        edges.forEach(edge => {
            const imp = edge.importance_score || 0;
            totalImp += imp;
            if (imp > maxImp) maxImp = imp;
            if (imp < minImp) minImp = imp;
        });
        
        const avgImp = totalImp / edges.length;
        DOM.avgImportance.textContent = avgImp.toFixed(3);
        DOM.maxImportance.textContent = maxImp.toFixed(3);
        
        // Reset importance slider range
        const sliderMin = Math.floor(minImp * 10) / 10;
        const sliderMax = Math.ceil(maxImp * 10) / 10;
        
        DOM.importanceSlider.min = sliderMin;
        DOM.importanceSlider.max = sliderMax;
        DOM.importanceSlider.step = 0.001;
        DOM.importanceSlider.value = sliderMin;
        
        DOM.importanceValue.innerHTML = `
            Threshold: ${sliderMin.toFixed(3)}<br>
            Range: ${sliderMin.toFixed(1)} - ${sliderMax.toFixed(1)}
        `;
    } else {
        DOM.avgImportance.textContent = '0.000';
        DOM.maxImportance.textContent = '0.000';
        DOM.importanceSlider.min = 0;
        DOM.importanceSlider.max = 1;
        DOM.importanceSlider.value = 0;
        DOM.importanceValue.textContent = 'Threshold: 0.000';
    }
    
    // Reset sizing mode to CPK element by default
    DOM.sizingModeSelect.value = 'element';
    DOM.nodeSizeSlider.value = 50;
    
    hideDetailsPanel();
}

/**
 * Renders details of the clicked node into the details panel and shows it.
 */
export function updateDetailsPanel(node) {
    if (!DOM.detailsPanel || !DOM.detailsContent) return;
    
    const label = node.data('label') || 'N/A';
    const id = node.data('id') || 'N/A';
    const element = node.data('element') || 'Unknown';
    const importance = node.data('importance') || 0.0;
    
    // Get connected edges and build HTML table rows
    let edgeRows = '';
    const getBondName = (type) => {
        const t = String(type);
        if (t === '1') return 'Single Bond';
        if (t === '2') return 'Double Bond';
        if (t === '7') return 'Aromatic Bond';
        return `Bond (${t})`;
    };

    node.connectedEdges().forEach(edge => {
        const rawType = edge.data('bond_type') || edge.data('label') || '1';
        const edgeLabel = getBondName(rawType);
        const imp = edge.data('importance') || 0;
        const isSource = edge.source().id() === node.id();
        const otherNode = isSource ? edge.target() : edge.source();
        const otherLabel = otherNode.data('label') || 'N/A';
        const directionSymbol = '—'; // Bonds are undirected
        
        edgeRows += `
            <tr>
                <td>${directionSymbol} ${edgeLabel}</td>
                <td style="color: var(--text-secondary); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${otherLabel}">${otherLabel}</td>
                <td class="importance-td">${imp.toFixed(3)}</td>
            </tr>
        `;
    });
    
    if (!edgeRows) {
        edgeRows = `<tr><td colspan="3" style="color: var(--text-muted); text-align: center; padding: 12px 0;">No bonds connected</td></tr>`;
    }
    
    DOM.detailsContent.innerHTML = `
        <table class="details-table">
            <tr>
                <td class="label-td">Atom Label</td>
                <td class="value-td">${label}</td>
            </tr>
            <tr>
                <td class="label-td">ID (Atom Index)</td>
                <td class="value-td">${id}</td>
            </tr>
            <tr>
                <td class="label-td">Chemical Element</td>
                <td class="value-td" style="color: var(--accent-blue); font-weight: bold;">${element}</td>
            </tr>
            <tr>
                <td class="label-td">XAI Importance</td>
                <td class="value-td" style="color: var(--accent-amber); font-weight: bold;">${importance.toFixed(4)}</td>
            </tr>
            <tr>
                <td class="label-td">Bonds (Valency)</td>
                <td class="value-td">${node.degree()}</td>
            </tr>
        </table>
        
        <div class="relations-title">Chemical Bonds</div>
        <table class="relations-table">
            <thead>
                <tr>
                    <th align="left">Bond Type</th>
                    <th align="left">Connected To</th>
                    <th align="right">Importance</th>
                </tr>
            </thead>
            <tbody>
                ${edgeRows}
            </tbody>
        </table>
    `;
    
    DOM.detailsPanel.style.display = 'block';
    setTimeout(() => {
        DOM.detailsPanel.classList.add('show');
    }, 10);
}

/**
 * Hides details panel.
 */
export function hideDetailsPanel() {
    if (!DOM.detailsPanel) return;
    DOM.detailsPanel.classList.remove('show');
    setTimeout(() => {
        if (!DOM.detailsPanel.classList.contains('show')) {
            DOM.detailsPanel.style.display = 'none';
        }
    }, 250);
}
