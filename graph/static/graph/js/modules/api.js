/**
 * API service for communicating with the Django backend.
 */

/**
 * Fetches the lists of training and testing molecules.
 * @returns {Promise<{train: Array, test: Array}>}
 */
export async function fetchMolecules() {
    try {
        const response = await fetch('/api/molecules/');
        if (!response.ok) {
            throw new Error(`Failed to fetch molecules list: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching molecules list:', error);
        throw error;
    }
}

/**
 * Runs GNNExplainer on the given molecule URI and returns the explanation.
 * @param {string} uri - The molecule URI (e.g. 'http://dl-learner.org/carcinogenesis#d76')
 * @returns {Promise<Object>} The normalized explanation graph data.
 */
export async function fetchExplanation(uri) {
    const url = `/api/explain/?uri=${encodeURIComponent(uri)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to run explainer: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error running explainer for ${uri}:`, error);
        throw error;
    }
}
