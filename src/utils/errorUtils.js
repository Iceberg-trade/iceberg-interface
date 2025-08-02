/**
 * Frontend-compatible error utilities
 * Replaces the Node.js version for browser compatibility
 */

/**
 * Extract error message from various error types
 * @param {Error|string|any} error - The error object
 * @returns {string} Clean error message
 */
export function getErrorMessage(error) {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object') {
    // Handle ethers errors
    if (error.reason) {
      return error.reason;
    }
    
    // Handle standard errors
    if (error.message) {
      return error.message;
    }
    
    // Handle axios errors
    if (error.response && error.response.data) {
      if (typeof error.response.data === 'string') {
        return error.response.data;
      }
      if (error.response.data.message) {
        return error.response.data.message;
      }
    }
  }
  
  return 'Unknown error occurred';
}

/**
 * Check if error message includes specific text
 * @param {Error|string|any} error - The error object
 * @param {string} searchText - Text to search for
 * @returns {boolean} Whether the error message includes the search text
 */
export function errorMessageIncludes(error, searchText) {
  const message = getErrorMessage(error);
  return message.toLowerCase().includes(searchText.toLowerCase());
}